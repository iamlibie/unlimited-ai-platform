import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const extensions = await prisma.extension.findMany({
    where: { isPublic: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: extensions });
}
