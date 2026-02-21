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
  if (typeof body?.description === "string") data.description = body.description.trim();
  if (typeof body?.prompt === "string") data.prompt = body.prompt.trim();
  if (typeof body?.isPublic === "boolean") data.isPublic = body.isPublic;

  const extension = await prisma.extension.update({
    where: { id },
    data,
  });

  return NextResponse.json({ data: extension });
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
  await prisma.extension.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
