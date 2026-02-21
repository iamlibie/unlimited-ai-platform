import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const channels = await prisma.channel.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      group: true,
      summary: true,
      modelName: true,
      pricing: {
        select: {
          tier: true,
          vipOnly: true,
          enabled: true,
        },
      },
    },
  });

  return NextResponse.json({
    data: channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      group: channel.group,
      summary: channel.summary,
      modelName: channel.modelName,
      pricingTier: channel.pricing?.tier ?? "FREE",
      vipOnly:
        (channel.pricing?.tier ?? "FREE") === "ADVANCED"
          ? true
          : channel.pricing?.vipOnly ?? false,
      pricingEnabled: channel.pricing?.enabled ?? true,
    })),
  });
}
