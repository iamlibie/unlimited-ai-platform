import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-auth";
import { getBillingStatus, grantPremiumCredits, grantVipSubscription } from "@/lib/billing";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type ActionType = "grant_credits" | "grant_vip";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: userId } = await params;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action: ActionType | undefined =
    body?.action === "grant_credits" || body?.action === "grant_vip"
      ? body.action
      : undefined;

  if (action === "grant_credits") {
    const amount =
      typeof body?.amount === "number" && Number.isFinite(body.amount)
        ? Math.floor(body.amount)
        : 0;
    if (amount <= 0) {
      return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
    }

    await grantPremiumCredits({
      userId,
      amount,
      note: `admin:${admin.id}`,
    });

    const billing = await getBillingStatus(userId);
    return NextResponse.json({ data: billing });
  }

  if (action === "grant_vip") {
    const months =
      typeof body?.months === "number" && Number.isFinite(body.months)
        ? Math.floor(body.months)
        : 1;
    const monthlyQuota =
      typeof body?.monthlyQuota === "number" && Number.isFinite(body.monthlyQuota)
        ? Math.floor(body.monthlyQuota)
        : 0;

    if (months <= 0) {
      return NextResponse.json({ error: "months must be > 0" }, { status: 400 });
    }

    await grantVipSubscription({
      userId,
      months,
      monthlyQuota,
      note: `admin:${admin.id}`,
    });

    const billing = await getBillingStatus(userId);
    return NextResponse.json({ data: billing });
  }

  const role =
    body?.role === "ADMIN" || body?.role === "USER" ? body.role : undefined;
  const status =
    body?.status === "ACTIVE" ||
    body?.status === "SUSPENDED" ||
    body?.status === "BANNED"
      ? body.status
      : undefined;

  if (!role && !status) {
    return NextResponse.json(
      { error: "role or status is required" },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      role,
      status,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      wallet: {
        select: {
          stamina: true,
        },
      },
      vipSubscriptions: {
        where: { active: true },
        orderBy: { expiresAt: "desc" },
        take: 1,
        select: {
          id: true,
          active: true,
          expiresAt: true,
          monthlyQuota: true,
          monthlyUsed: true,
        },
      },
    },
  });

  return NextResponse.json({ data: user });
}

