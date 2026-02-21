import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { getBillingStatusWithOptions } from "@/lib/billing";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = typeof body?.code === "string" ? normalizeCode(body.code) : "";
  if (!code) {
    return NextResponse.json({ error: "请输入有效卡密" }, { status: 400 });
  }

  try {
    const redeemed = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const card = await tx.redeemCard.findUnique({ where: { code } });

      if (!card || !card.enabled) {
        return { ok: false as const, status: 404, error: "卡密不存在或已停用" };
      }
      if (card.expiresAt && card.expiresAt <= now) {
        return { ok: false as const, status: 400, error: "卡密已过期" };
      }
      if (card.usedCount >= card.maxUses) {
        return { ok: false as const, status: 400, error: "卡密已被用完" };
      }

      const alreadyRedeemed = await tx.cardRedemption.findFirst({
        where: {
          cardId: card.id,
          userId,
        },
      });
      if (alreadyRedeemed) {
        return { ok: false as const, status: 400, error: "你已兑换过该卡密" };
      }

      const pointsGranted = Math.max(0, Math.floor(card.points));
      const vipMonthsGranted = Math.max(0, Math.floor(card.vipMonths));
      const vipQuotaFromCard = card.vipMonthlyQuota;

      const consumeResult = await tx.redeemCard.updateMany({
        where: {
          id: card.id,
          enabled: true,
          usedCount: { lt: card.maxUses },
        },
        data: {
          usedCount: { increment: 1 },
        },
      });
      if (consumeResult.count <= 0) {
        return { ok: false as const, status: 400, error: "卡密已被用完" };
      }

      if (pointsGranted > 0) {
        const wallet = await tx.userWallet.upsert({
          where: { userId },
          update: {
            stamina: { increment: pointsGranted },
            staminaUpdatedAt: now,
          },
          create: {
            userId,
            stamina: pointsGranted,
            premiumCredits: 0,
            staminaUpdatedAt: now,
            lastDailyRefillAt: null,
            lastLoginBonusAt: null,
          },
        });

        await tx.walletLedger.create({
          data: {
            userId,
            walletId: wallet.id,
            type: "CREDIT_GRANT",
            amount: pointsGranted,
            note: `redeem card ${card.code}`,
          },
        });
      }

      if (vipMonthsGranted > 0) {
        const config = await tx.appConfig.findFirst();
        const monthlyQuota = Math.max(
          0,
          Math.floor(vipQuotaFromCard ?? config?.vipDefaultMonthlyQuota ?? 200),
        );

        const active = await tx.vipSubscription.findFirst({
          where: {
            userId,
            active: true,
            expiresAt: { gt: now },
          },
          orderBy: { expiresAt: "desc" },
        });
        const nextExpires = addMonthsUTCAligned(active?.expiresAt ?? now, vipMonthsGranted);

        let vipSubscriptionId: string;
        if (active) {
          const normalizedCycleStart =
            active.quotaResetAt < active.startedAt
              ? active.startedAt
              : active.quotaResetAt;
          const updated = await tx.vipSubscription.update({
            where: { id: active.id },
            data: {
              expiresAt: nextExpires,
              monthlyQuota,
              active: true,
              quotaResetAt: normalizedCycleStart,
            },
          });
          vipSubscriptionId = updated.id;
        } else {
          const created = await tx.vipSubscription.create({
            data: {
              userId,
              active: true,
              startedAt: now,
              expiresAt: nextExpires,
              monthlyQuota,
              monthlyUsed: 0,
              quotaResetAt: now,
            },
          });
          vipSubscriptionId = created.id;
        }

        await tx.walletLedger.create({
          data: {
            userId,
            vipSubscriptionId,
            type: "VIP_GRANT",
            amount: vipMonthsGranted,
            note: `redeem card ${card.code}`,
          },
        });
      }

      await tx.cardRedemption.create({
        data: {
          cardId: card.id,
          userId,
          pointsGranted,
          vipMonthsGranted,
        },
      });

      return {
        ok: true as const,
        pointsGranted,
        vipMonthsGranted,
      };
    });

    if (!redeemed.ok) {
      return NextResponse.json({ error: redeemed.error }, { status: redeemed.status });
    }

    const billing = await getBillingStatusWithOptions(
      userId,
      { applyDailyLoginBonus: false },
    );

    return NextResponse.json({
      data: {
        pointsGranted: redeemed.pointsGranted,
        vipMonthsGranted: redeemed.vipMonthsGranted,
        billing,
      },
    });
  } catch {
    return NextResponse.json({ error: "兑换失败，请稍后再试" }, { status: 500 });
  }
}
