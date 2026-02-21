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
  });

  return NextResponse.json({ data: channels });
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

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const group = typeof body?.group === "string" ? body.group.trim() : "默认通道";
  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  const baseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";
  const modelName = typeof body?.modelName === "string" ? body.modelName.trim() : "";
  const systemApiKey =
    typeof body?.systemApiKey === "string" ? body.systemApiKey.trim() : "";
  const systemPrompt =
    typeof body?.systemPrompt === "string" ? body.systemPrompt.trim() : "";
  const isActive = Boolean(body?.isActive ?? true);

  if (!name || !baseUrl || !modelName) {
    return NextResponse.json(
      { error: "name, baseUrl, modelName are required" },
      { status: 400 },
    );
  }

  const channel = await prisma.channel.create({
    data: {
      name,
      group,
      summary: summary || null,
      baseUrl,
      modelName,
      systemApiKey: systemApiKey || null,
      systemPrompt: systemPrompt || null,
      isActive,
    },
  });

  return NextResponse.json({ data: channel });
}
