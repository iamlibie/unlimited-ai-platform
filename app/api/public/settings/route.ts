import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userSettings = await prisma.userSettings.findUnique({ where: { userId } });

  return NextResponse.json({
    data: {
      apiKey: "",
      baseUrl: "",
      historyLength: userSettings?.historyLength ?? 20,
      contextCompression: userSettings?.contextCompression ?? 0,
    },
  });
}

export async function PATCH(req: NextRequest) {
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

  const historyLength =
    typeof body?.historyLength === "number" && Number.isFinite(body.historyLength)
      ? Math.max(1, Math.min(50, body.historyLength))
      : undefined;
  const contextCompression =
    typeof body?.contextCompression === "number" && Number.isFinite(body.contextCompression)
      ? Math.max(0, Math.min(100, body.contextCompression))
      : undefined;

  // Enforce local-only custom API config: never persist user API key / base URL in DB.
  const settings = await prisma.$transaction(async (tx) => {
    await tx.userApiKey.deleteMany({ where: { userId } });
    return tx.userSettings.upsert({
      where: { userId },
      update: {
        allowOverrideBaseUrl: false,
        customBaseUrl: null,
        historyLength,
        contextCompression,
      },
      create: {
        userId,
        allowOverrideBaseUrl: false,
        customBaseUrl: null,
        historyLength: historyLength ?? 20,
        contextCompression: contextCompression ?? 0,
      },
    });
  });

  return NextResponse.json({
    data: {
      apiKey: "",
      baseUrl: "",
      historyLength: settings.historyLength,
      contextCompression: settings.contextCompression,
    },
  });
}
