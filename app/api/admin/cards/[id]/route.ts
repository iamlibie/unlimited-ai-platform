import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body?.title === "string") {
    data.title = body.title.trim() || null;
  }
  if (typeof body?.vipMonths === "number" && Number.isFinite(body.vipMonths)) {
    data.vipMonths = Math.max(0, Math.min(120, Math.floor(body.vipMonths)));
  }
  if (typeof body?.vipMonthlyQuota === "number" && Number.isFinite(body.vipMonthlyQuota)) {
    data.vipMonthlyQuota = Math.max(0, Math.min(100000, Math.floor(body.vipMonthlyQuota)));
  }
  if (body?.vipMonthlyQuota === null) {
    data.vipMonthlyQuota = null;
  }
  if (typeof body?.points === "number" && Number.isFinite(body.points)) {
    data.points = Math.max(0, Math.min(1000000, Math.floor(body.points)));
  }
  if (typeof body?.maxUses === "number" && Number.isFinite(body.maxUses)) {
    data.maxUses = Math.max(1, Math.min(100000, Math.floor(body.maxUses)));
  }
  if (typeof body?.enabled === "boolean") {
    data.enabled = body.enabled;
  }
  if (typeof body?.expiresAt === "string") {
    const value = body.expiresAt.trim();
    if (!value) {
      data.expiresAt = null;
    } else {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "expiresAt is invalid" }, { status: 400 });
      }
      data.expiresAt = parsed;
    }
  }
  if (body?.expiresAt === null) {
    data.expiresAt = null;
  }

  const card = await prisma.redeemCard.update({
    where: { id },
    data,
  });

  return NextResponse.json({ data: card });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.redeemCard.delete({
    where: { id },
  });
  return NextResponse.json({ ok: true });
}
