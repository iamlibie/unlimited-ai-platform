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
  if (typeof body?.name === "string") data.name = body.name.trim();
  if (typeof body?.group === "string") data.group = body.group.trim();
  if (typeof body?.summary === "string") data.summary = body.summary.trim() || null;
  if (typeof body?.baseUrl === "string") data.baseUrl = body.baseUrl.trim();
  if (typeof body?.modelName === "string") data.modelName = body.modelName.trim();
  if (typeof body?.systemApiKey === "string") {
    data.systemApiKey = body.systemApiKey.trim() || null;
  }
  if (typeof body?.systemPrompt === "string") {
    data.systemPrompt = body.systemPrompt.trim() || null;
  }
  if (typeof body?.isActive === "boolean") data.isActive = body.isActive;

  const channel = await prisma.channel.update({
    where: { id },
    data,
  });

  return NextResponse.json({ data: channel });
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
  await prisma.channel.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
