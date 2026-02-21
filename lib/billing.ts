import { Prisma, PrismaClient, StaminaRecoveryMode } from "@prisma/client";

import { prisma } from "@/lib/db";

const GLOBAL_APP_CONFIG_ID = "global";

type Tx = Prisma.TransactionClient;

export type BillingErrorCode =
  | "INSUFFICIENT_POINTS"
  | "INSUFFICIENT_STAMINA"
  | "INSUFFICIENT_PREMIUM_CREDITS"
  | "MODEL_DISABLED"
  | "VIP_REQUIRED";

export type BillingConsumeResult =
  | {
      ok: true;
      billing: BillingStatus;
    }
  | {
      ok: false;
      status: number;
      code: BillingErrorCode;
      message: string;
      billing: BillingStatus;
    };

export type BillingStatus = {
  points: number;
  pointsCap: number;
  dailyLoginPoints: number;
  dailyLoginGranted: number;
  stamina: number;
  staminaMax: number;
  premiumCredits: number;
  recoveryMode: StaminaRecoveryMode;
  recoveryIntervalMinutes: number;
  recoveryAmount: number;
  dailyRefillHour: number;
  vip: {
    active: boolean;
    expiresAt: string | null;
    monthlyQuota: number;
    monthlyUsed: number;
    monthlyRemaining: number;
  };
};

function addMonthsUTCAligned(date: Date, months: number) {
  const sourceYear = date.getUTCFullYear();
  const sourceMonth = date.getUTCMonth();
  const sourceDay = date.getUTCDate();

  const targetMonthRaw = sourceMonth + months;
  const targetYear = sourceYear + Math.floor(targetMonthRaw / 12);
  const normalizedTargetMonth = ((targetMonthRaw % 12) + 12) % 12;
  const maxTargetDay = new Date(
    Date.UTC(targetYear, normalizedTargetMonth + 1, 0),
  ).getUTCDate();
  const day = Math.min(sourceDay, maxTargetDay);

  return new Date(
    Date.UTC(
      targetYear,
      normalizedTargetMonth,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

function sameDayUTC(dateA: Date, dateB: Date) {
  return (
    dateA.getUTCFullYear() === dateB.getUTCFullYear() &&
    dateA.getUTCMonth() === dateB.getUTCMonth() &&
    dateA.getUTCDate() === dateB.getUTCDate()
  );
}

async function getOrCreateConfig(tx: Tx) {
  const existing = await tx.appConfig.findFirst();
  if (existing) return existing;

  return tx.appConfig.create({
    data: {
      id: GLOBAL_APP_CONFIG_ID,
      allowUserApiKey: true,
      allowUserBaseUrlOverride: false,
      defaultBaseUrl: "https://api.openai.com",
      loginDailyPoints: 80,
      pointsStackLimit: 300,
      staminaMax: 50,
      staminaRecoverIntervalMinutes: 10,
      staminaRecoverAmount: 1,
      staminaRecoveryMode: "INTERVAL_ONLY",
      dailyRefillHour: 0,
      vipDefaultMonthlyQuota: 200,
      globalSystemPrompt: "",
    },
  });
}

async function getOrCreateWallet(tx: Tx, userId: string, now: Date) {
  const existing = await tx.userWallet.findUnique({ where: { userId } });
  if (existing) return existing;

  return tx.userWallet.create({
    data: {
      userId,
      stamina: 0,
      premiumCredits: 0,
      staminaUpdatedAt: now,
      lastDailyRefillAt: null,
      lastLoginBonusAt: null,
    },
  });
}

async function syncVipSubscription(tx: Tx, userId: string, now: Date) {
  const activeVip = await tx.vipSubscription.findFirst({
    where: { userId, active: true },
    orderBy: [{ expiresAt: "desc" }, { createdAt: "desc" }],
  });

  if (!activeVip) return null;

  if (activeVip.expiresAt <= now) {
    const expired = await tx.vipSubscription.update({
      where: { id: activeVip.id },
      data: { active: false },
    });

    await tx.walletLedger.create({
      data: {
        userId,
        vipSubscriptionId: expired.id,
        type: "VIP_EXPIRE",
        amount: 0,
        note: "VIP expired",
      },
    });

    return null;
  }

  const rawCycleStart = activeVip.quotaResetAt ?? activeVip.startedAt ?? now;
  const cycleStart =
    rawCycleStart < activeVip.startedAt ? activeVip.startedAt : rawCycleStart;
  let nextCycleStart = cycleStart;
  let nextCycleEnd = addMonthsUTCAligned(nextCycleStart, 1);

  if (now >= nextCycleEnd) {
    while (now >= nextCycleEnd) {
      nextCycleStart = nextCycleEnd;
      nextCycleEnd = addMonthsUTCAligned(nextCycleStart, 1);
    }

    return tx.vipSubscription.update({
      where: { id: activeVip.id },
      data: {
        monthlyUsed: 0,
        quotaResetAt: nextCycleStart,
      },
    });
  }

  return activeVip;
}

async function applyDailyLoginBonus(
  tx: Tx,
  userId: string,
  wallet: {
    id: string;
    stamina: number;
    premiumCredits: number;
    staminaUpdatedAt: Date;
    lastDailyRefillAt: Date | null;
    lastLoginBonusAt: Date | null;
  },
  config: {
    loginDailyPoints: number;
    pointsStackLimit: number;
    staminaRecoveryMode: StaminaRecoveryMode;
    staminaRecoverIntervalMinutes: number;
    staminaRecoverAmount: number;
    dailyRefillHour: number;
  },
  now: Date,
) {
  const alreadyGrantedToday = wallet.lastLoginBonusAt
    ? sameDayUTC(wallet.lastLoginBonusAt, now)
    : false;

  if (alreadyGrantedToday) {
    return {
      wallet,
      granted: 0,
    };
  }

  const reward = Math.max(0, Math.floor(config.loginDailyPoints));
  const cap = Math.max(1, Math.floor(config.pointsStackLimit));
  const nextPoints =
    wallet.stamina >= cap ? wallet.stamina : Math.min(cap, wallet.stamina + reward);
  const granted = nextPoints - wallet.stamina;

  const updated = await tx.userWallet.update({
    where: { id: wallet.id },
    data: {
      stamina: nextPoints,
      staminaUpdatedAt: now,
      lastLoginBonusAt: now,
    },
  });

  if (granted > 0) {
    await tx.walletLedger.create({
      data: {
        userId,
        walletId: wallet.id,
        type: "DAILY_LOGIN_BONUS",
        amount: granted,
        note: "daily login bonus",
      },
    });
  }

  return {
    wallet: updated,
    granted,
  };
}

function buildBillingStatus(params: {
  wallet: { stamina: number; premiumCredits: number };
  dailyLoginGranted?: number;
  config: {
    loginDailyPoints: number;
    pointsStackLimit: number;
    staminaRecoveryMode: StaminaRecoveryMode;
    staminaRecoverIntervalMinutes: number;
    staminaRecoverAmount: number;
    dailyRefillHour: number;
  };
  vip: {
    active: boolean;
    expiresAt: Date;
    monthlyQuota: number;
    monthlyUsed: number;
  } | null;
}): BillingStatus {
  const vip = params.vip;
  const monthlyRemaining = vip ? Math.max(0, vip.monthlyQuota - vip.monthlyUsed) : 0;

  return {
    points: params.wallet.stamina,
    pointsCap: Math.max(1, params.config.pointsStackLimit),
    dailyLoginPoints: Math.max(0, params.config.loginDailyPoints),
    dailyLoginGranted: Math.max(0, params.dailyLoginGranted ?? 0),
    stamina: params.wallet.stamina,
    staminaMax: Math.max(1, params.config.pointsStackLimit),
    premiumCredits: 0,
    recoveryMode: params.config.staminaRecoveryMode,
    recoveryIntervalMinutes: params.config.staminaRecoverIntervalMinutes,
    recoveryAmount: params.config.staminaRecoverAmount,
    dailyRefillHour: params.config.dailyRefillHour,
    vip: {
      active: Boolean(vip?.active),
      expiresAt: vip?.expiresAt?.toISOString() ?? null,
      monthlyQuota: vip?.monthlyQuota ?? 0,
      monthlyUsed: vip?.monthlyUsed ?? 0,
      monthlyRemaining,
    },
  };
}

export async function getBillingStatus(userId: string, db: PrismaClient = prisma) {
  return getBillingStatusWithOptions(userId, { applyDailyLoginBonus: true }, db);
}

type BillingStatusOptions = {
  applyDailyLoginBonus?: boolean;
};

export async function getBillingStatusWithOptions(
  userId: string,
  options: BillingStatusOptions = {},
  db: PrismaClient = prisma,
) {
  const shouldApplyDailyLoginBonus = options.applyDailyLoginBonus !== false;
  return db.$transaction(async (tx) => {
    const now = new Date();
    const config = await getOrCreateConfig(tx);
    const wallet = await getOrCreateWallet(tx, userId, now);
    const bonusResult = shouldApplyDailyLoginBonus
      ? await applyDailyLoginBonus(tx, userId, wallet, config, now)
      : { wallet, granted: 0 };
    const vip = await syncVipSubscription(tx, userId, now);

    return buildBillingStatus({
      wallet: bonusResult.wallet,
      dailyLoginGranted: bonusResult.granted,
      config,
      vip,
    });
  });
}

export async function consumeChatQuota(
  params: { userId: string; channelId: string },
  db: PrismaClient = prisma,
): Promise<BillingConsumeResult> {
  return db.$transaction(async (tx) => {
    const now = new Date();
    const [config, pricing] = await Promise.all([
      getOrCreateConfig(tx),
      tx.modelPricing.findUnique({ where: { channelId: params.channelId } }),
    ]);

    const wallet = await getOrCreateWallet(tx, params.userId, now);
    const bonusResult = await applyDailyLoginBonus(tx, params.userId, wallet, config, now);
    const bonusWallet = bonusResult.wallet;
    const vip = await syncVipSubscription(tx, params.userId, now);

    const effectivePricing = pricing ?? {
      tier: "FREE" as const,
      staminaCost: 1,
      vipQuotaCost: 1,
      creditCost: 10,
      enabled: true,
      vipOnly: false,
    };

    if (!effectivePricing.enabled) {
      return {
        ok: false,
        status: 403,
        code: "MODEL_DISABLED",
        message: "当前模型已关闭",
        billing: buildBillingStatus({
          wallet: bonusWallet,
          config,
          vip,
        }),
      };
    }

    let nextWallet = bonusWallet;
    let nextVip = vip;
    const vipActive = Boolean(vip?.active && vip.expiresAt > now);

    if (effectivePricing.tier === "FREE") {
      // 普通模型：VIP 用户不扣点数；非 VIP 用户按普通点数扣费。
      if (vipActive) {
        return {
          ok: true,
          billing: buildBillingStatus({
            wallet: nextWallet,
            config,
            vip: nextVip,
          }),
        };
      }

      const pointsCost = Math.max(0, effectivePricing.staminaCost);
      if (pointsCost > 0) {
        if (nextWallet.stamina < pointsCost) {
          return {
            ok: false,
            status: 402,
            code: "INSUFFICIENT_POINTS",
            message: "点数不足，请明日登录领取或开通 VIP",
            billing: buildBillingStatus({
              wallet: nextWallet,
              config,
              vip: nextVip,
            }),
          };
        }

        nextWallet = await tx.userWallet.update({
          where: { id: nextWallet.id },
          data: {
            stamina: { decrement: pointsCost },
          },
        });

        await tx.walletLedger.create({
          data: {
            userId: params.userId,
            walletId: nextWallet.id,
            channelId: params.channelId,
            type: "STAMINA_CONSUME",
            amount: -pointsCost,
            note: "chat consume (normal model)",
          },
        });
      }

      return {
        ok: true,
        billing: buildBillingStatus({
          wallet: nextWallet,
          config,
          vip: nextVip,
        }),
      };
    }

    // VIP 模型：仅 VIP 可用，优先扣 VIP 月配额，不足时扣兜底点数。
    if (!vipActive) {
      return {
        ok: false,
        status: 403,
        code: "VIP_REQUIRED",
        message: "该模型仅限 VIP 用户使用",
        billing: buildBillingStatus({
          wallet: nextWallet,
          config,
          vip: nextVip,
        }),
      };
    }

    const vipQuotaCost = Math.max(0, effectivePricing.vipQuotaCost);
    const fallbackPointsCost = Math.max(0, effectivePricing.creditCost);
    const vipRemaining = vip ? Math.max(0, vip.monthlyQuota - vip.monthlyUsed) : 0;

    if (vipQuotaCost > 0 && vip && vipRemaining >= vipQuotaCost) {
      nextVip = await tx.vipSubscription.update({
        where: { id: vip.id },
        data: {
          monthlyUsed: { increment: vipQuotaCost },
        },
      });

      await tx.walletLedger.create({
        data: {
          userId: params.userId,
          vipSubscriptionId: vip.id,
          channelId: params.channelId,
          type: "VIP_QUOTA_CONSUME",
          amount: -vipQuotaCost,
          note: "chat consume (vip quota)",
        },
      });

      return {
        ok: true,
        billing: buildBillingStatus({
          wallet: nextWallet,
          config,
          vip: nextVip,
        }),
      };
    }

    if (fallbackPointsCost > 0) {
      if (nextWallet.stamina < fallbackPointsCost) {
        return {
          ok: false,
          status: 402,
          code: "INSUFFICIENT_POINTS",
          message: "VIP 月配额已用尽，兜底点数不足",
          billing: buildBillingStatus({
            wallet: nextWallet,
            config,
            vip: nextVip,
          }),
        };
      }

      nextWallet = await tx.userWallet.update({
        where: { id: nextWallet.id },
        data: {
          stamina: { decrement: fallbackPointsCost },
        },
      });

      await tx.walletLedger.create({
        data: {
          userId: params.userId,
          walletId: nextWallet.id,
          channelId: params.channelId,
          type: "CREDIT_CONSUME",
          amount: -fallbackPointsCost,
          note: "chat consume (vip model fallback points)",
        },
      });
    }

    return {
      ok: true,
      billing: buildBillingStatus({
        wallet: nextWallet,
        config,
        vip: nextVip,
      }),
    };
  });
}

export async function grantPremiumCredits(
  params: { userId: string; amount: number; note?: string },
  db: PrismaClient = prisma,
) {
  return db.$transaction(async (tx) => {
    const now = new Date();
    const wallet = await getOrCreateWallet(tx, params.userId, now);

    const amount = Math.max(0, Math.floor(params.amount));
    if (amount <= 0) return wallet;

    const updated = await tx.userWallet.update({
      where: { id: wallet.id },
      data: {
        stamina: { increment: amount },
        staminaUpdatedAt: now,
      },
    });

    await tx.walletLedger.create({
      data: {
        userId: params.userId,
        walletId: wallet.id,
        type: "CREDIT_GRANT",
        amount,
        note: params.note || "admin grant points",
      },
    });

    return updated;
  });
}

export async function grantVipSubscription(
  params: { userId: string; months: number; monthlyQuota: number; note?: string },
  db: PrismaClient = prisma,
) {
  return db.$transaction(async (tx) => {
    const config = await getOrCreateConfig(tx);
    const now = new Date();
    const baseQuota = Math.max(0, Math.floor(params.monthlyQuota || config.vipDefaultMonthlyQuota));
    const months = Math.max(1, Math.floor(params.months || 1));

    const active = await tx.vipSubscription.findFirst({
      where: { userId: params.userId, active: true, expiresAt: { gt: now } },
      orderBy: { expiresAt: "desc" },
    });

    const nextExpires = addMonthsUTCAligned(active?.expiresAt ?? now, months);

    let subscription;
    if (active) {
      const normalizedCycleStart =
        active.quotaResetAt < active.startedAt ? active.startedAt : active.quotaResetAt;
      subscription = await tx.vipSubscription.update({
        where: { id: active.id },
        data: {
          expiresAt: nextExpires,
          monthlyQuota: baseQuota,
          active: true,
          quotaResetAt: normalizedCycleStart,
        },
      });
    } else {
      subscription = await tx.vipSubscription.create({
        data: {
          userId: params.userId,
          active: true,
          startedAt: now,
          expiresAt: nextExpires,
          monthlyQuota: baseQuota,
          monthlyUsed: 0,
          quotaResetAt: now,
        },
      });
    }

    await tx.walletLedger.create({
      data: {
        userId: params.userId,
        vipSubscriptionId: subscription.id,
        type: "VIP_GRANT",
        amount: months,
        note: params.note || "admin grant vip",
      },
    });

    return subscription;
  });
}

export function isBillingErrorCode(value: string): value is BillingErrorCode {
  return (
    value === "INSUFFICIENT_POINTS" ||
    value === "INSUFFICIENT_STAMINA" ||
    value === "INSUFFICIENT_PREMIUM_CREDITS" ||
    value === "MODEL_DISABLED" ||
    value === "VIP_REQUIRED"
  );
}
