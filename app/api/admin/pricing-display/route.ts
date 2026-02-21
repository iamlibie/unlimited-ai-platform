import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-auth";
import {
  readPricingDisplayConfig,
  writePricingDisplayConfig,
} from "@/lib/pricing-display-config";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const config = await readPricingDisplayConfig();
    return NextResponse.json({ data: config });
  } catch {
    return NextResponse.json({ error: "读取价格配置失败" }, { status: 500 });
  }
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

  try {
    const config = await writePricingDisplayConfig({
      vipMonthlyPrice: body?.vipMonthlyPrice,
      vipQuarterlyPrice: body?.vipQuarterlyPrice,
      vipYearlyPrice: body?.vipYearlyPrice,
      pointsPerYuan: body?.pointsPerYuan,
    });
    return NextResponse.json({ data: config });
  } catch {
    return NextResponse.json({ error: "保存价格配置失败" }, { status: 500 });
  }
}
