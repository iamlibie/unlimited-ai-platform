import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
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
    take: 200,
  });

  return NextResponse.json({ data: users });
}
