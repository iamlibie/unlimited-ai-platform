import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let config = await prisma.appConfig.findFirst();
  if (!config) {
    config = await prisma.appConfig.create({
      data: {
        id: "global",
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

  return NextResponse.json({
    data: {
      loginDailyPoints: config.loginDailyPoints,
      pointsStackLimit: config.pointsStackLimit,
      vipDefaultMonthlyQuota: config.vipDefaultMonthlyQuota,
      globalSystemPrompt: config.globalSystemPrompt ?? "",
    },
  });
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

  const loginDailyPoints =
    typeof body?.loginDailyPoints === "number" && Number.isFinite(body.loginDailyPoints)
      ? Math.max(0, Math.min(100000, Math.floor(body.loginDailyPoints)))
      : undefined;
  const pointsStackLimit =
    typeof body?.pointsStackLimit === "number" && Number.isFinite(body.pointsStackLimit)
      ? Math.max(1, Math.min(1000000, Math.floor(body.pointsStackLimit)))
      : undefined;
  const vipDefaultMonthlyQuota =
    typeof body?.vipDefaultMonthlyQuota === "number" &&
    Number.isFinite(body.vipDefaultMonthlyQuota)
      ? Math.max(0, Math.min(100000, Math.floor(body.vipDefaultMonthlyQuota)))
      : undefined;
  const globalSystemPrompt =
    typeof body?.globalSystemPrompt === "string"
      ? body.globalSystemPrompt.trim().slice(0, 8000)
      : undefined;

  const updateData = {
    loginDailyPoints,
    pointsStackLimit,
    vipDefaultMonthlyQuota,
    globalSystemPrompt,
  };

  const config = await prisma.appConfig.upsert({
    where: { id: "global" },
    update: updateData,
    create: {
      id: "global",
      allowUserApiKey: true,
      allowUserBaseUrlOverride: false,
      defaultBaseUrl: "https://api.openai.com",
      loginDailyPoints: loginDailyPoints ?? 80,
      pointsStackLimit: pointsStackLimit ?? 300,
      staminaMax: 50,
      staminaRecoverIntervalMinutes: 10,
      staminaRecoverAmount: 1,
      staminaRecoveryMode: "INTERVAL_ONLY",
      dailyRefillHour: 0,
      vipDefaultMonthlyQuota: vipDefaultMonthlyQuota ?? 200,
      globalSystemPrompt: globalSystemPrompt ?? "",
    },
  });

  return NextResponse.json({
    data: {
      loginDailyPoints: config.loginDailyPoints,
      pointsStackLimit: config.pointsStackLimit,
      vipDefaultMonthlyQuota: config.vipDefaultMonthlyQuota,
      globalSystemPrompt: config.globalSystemPrompt ?? "",
    },
  });
}
