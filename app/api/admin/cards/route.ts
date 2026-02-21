import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

function createRandomCode() {
  return `VIP-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cards = await prisma.redeemCard.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          redemptions: true,
        },
      },
    },
  });

  return NextResponse.json({
    data: cards.map((card) => ({
      ...card,
      redemptionCount: card._count.redemptions,
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const inputCode = typeof body?.code === "string" ? normalizeCode(body.code) : "";
  const code = inputCode || createRandomCode();

  const vipMonths =
    typeof body?.vipMonths === "number" && Number.isFinite(body.vipMonths)
      ? Math.max(0, Math.min(120, Math.floor(body.vipMonths)))
      : 0;
  const vipMonthlyQuota =
    typeof body?.vipMonthlyQuota === "number" && Number.isFinite(body.vipMonthlyQuota)
      ? Math.max(0, Math.min(100000, Math.floor(body.vipMonthlyQuota)))
      : null;
  const points =
    typeof body?.points === "number" && Number.isFinite(body.points)
      ? Math.max(0, Math.min(1000000, Math.floor(body.points)))
      : 0;
  const maxUses =
    typeof body?.maxUses === "number" && Number.isFinite(body.maxUses)
      ? Math.max(1, Math.min(100000, Math.floor(body.maxUses)))
      : 1;
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : true;

  let expiresAt: Date | null = null;
  if (typeof body?.expiresAt === "string" && body.expiresAt.trim()) {
    const parsed = new Date(body.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "expiresAt is invalid" }, { status: 400 });
    }
    expiresAt = parsed;
  }

  if (!code) {
    return NextResponse.json({ error: "code is invalid" }, { status: 400 });
  }

  if (vipMonths <= 0 && points <= 0) {
    return NextResponse.json(
      { error: "会员月数或点数至少设置一个大于 0" },
      { status: 400 },
    );
  }

  try {
    const card = await prisma.redeemCard.create({
      data: {
        title: title || null,
        code,
        vipMonths,
        vipMonthlyQuota,
        points,
        maxUses,
        usedCount: 0,
        expiresAt,
        enabled,
      },
    });
    return NextResponse.json({ data: card });
  } catch (error) {
    const message =
      error instanceof Error && /unique/i.test(error.message)
        ? "卡密已存在，请更换后重试"
        : "创建卡密失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
