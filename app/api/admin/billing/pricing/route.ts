import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const channels = await prisma.channel.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      pricing: true,
    },
  });

  const normalizedChannels = channels.map((channel) => {
    const pricing = channel.pricing;
    if (!pricing) return channel;
    if (pricing.tier === "FREE") {
      return {
        ...channel,
        pricing: {
          ...pricing,
          vipQuotaCost: 0,
          creditCost: 0,
          vipOnly: false,
        },
      };
    }
    return {
      ...channel,
      pricing: {
        ...pricing,
        staminaCost: 0,
        vipOnly: true,
      },
    };
  });

  return NextResponse.json({ data: normalizedChannels });
}

export async function PATCH(req: NextRequest) {
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

  const channelId = typeof body?.channelId === "string" ? body.channelId.trim() : "";
  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  const tier = body?.tier === "FREE" || body?.tier === "ADVANCED" ? body.tier : undefined;
  const staminaCost =
    typeof body?.staminaCost === "number" && Number.isFinite(body.staminaCost)
      ? Math.max(0, Math.min(20, Math.floor(body.staminaCost)))
      : undefined;
  const vipQuotaCost =
    typeof body?.vipQuotaCost === "number" && Number.isFinite(body.vipQuotaCost)
      ? Math.max(0, Math.min(100, Math.floor(body.vipQuotaCost)))
      : undefined;
  const creditCost =
    typeof body?.creditCost === "number" && Number.isFinite(body.creditCost)
      ? Math.max(0, Math.min(10000, Math.floor(body.creditCost)))
      : undefined;
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : undefined;
  const normalizedTier = tier ?? "FREE";
  const normalizedStaminaCost = normalizedTier === "FREE" ? (staminaCost ?? 1) : 0;
  const normalizedVipQuotaCost = normalizedTier === "ADVANCED" ? (vipQuotaCost ?? 1) : 0;
  const normalizedCreditCost = normalizedTier === "ADVANCED" ? (creditCost ?? 10) : 0;
  const normalizedVipOnly = normalizedTier === "ADVANCED";

  const existing = await prisma.modelPricing.findUnique({ where: { channelId } });
  const pricing = await prisma.modelPricing.upsert({
    where: { channelId },
    update: {
      tier: normalizedTier,
      staminaCost: normalizedStaminaCost,
      vipQuotaCost: normalizedVipQuotaCost,
      creditCost: normalizedCreditCost,
      vipOnly: normalizedVipOnly,
      enabled,
    },
    create: {
      channelId,
      tier: normalizedTier,
      staminaCost: normalizedStaminaCost,
      vipQuotaCost: normalizedVipQuotaCost,
      creditCost: normalizedCreditCost,
      vipOnly: normalizedVipOnly,
      enabled: enabled ?? true,
    },
  });

  return NextResponse.json({ data: pricing, created: !existing });
}
