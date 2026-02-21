import { NextResponse } from "next/server";

import { readPricingDisplayConfig } from "@/lib/pricing-display-config";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = await readPricingDisplayConfig();
    return NextResponse.json({ data: config });
  } catch {
    return NextResponse.json({ error: "读取价格配置失败" }, { status: 500 });
  }
}
