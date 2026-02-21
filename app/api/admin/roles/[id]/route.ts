import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function isAllowedImageUrl(url: string, kind: "avatar" | "background") {
  if (!url) return true;
  if (kind === "avatar" && url.startsWith("/uploads/role-avatars/")) {
    return true;
  }
  if (kind === "background" && url.startsWith("/uploads/role-backgrounds/")) {
    return true;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    if (parsed.username || parsed.password) {
      return false;
    }
    return parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

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
  if (typeof body?.author === "string") data.author = body.author.trim();
  if (typeof body?.category === "string") data.category = body.category.trim();
  if (typeof body?.avatarUrl === "string") {
    const avatarUrl = body.avatarUrl.trim();
    if (!isAllowedImageUrl(avatarUrl, "avatar")) {
      return NextResponse.json({ error: "avatarUrl is invalid" }, { status: 400 });
    }
    data.avatarUrl = avatarUrl || null;
  }
  if (typeof body?.backgroundUrl === "string") {
    const backgroundUrl = body.backgroundUrl.trim();
    if (!isAllowedImageUrl(backgroundUrl, "background")) {
      return NextResponse.json({ error: "backgroundUrl is invalid" }, { status: 400 });
    }
    data.backgroundUrl = backgroundUrl || null;
  }
  if (typeof body?.publicRequested === "boolean") data.publicRequested = body.publicRequested;

  const reviewAction =
    body?.reviewAction === "approve" || body?.reviewAction === "reject"
      ? body.reviewAction
      : null;

  if (reviewAction === "approve") {
    data.isPublic = true;
    data.publicRequested = true;
    data.reviewStatus = "APPROVED";
  } else if (reviewAction === "reject") {
    data.isPublic = false;
    data.publicRequested = false;
    data.reviewStatus = "REJECTED";
  } else if (typeof body?.isPublic === "boolean") {
    data.isPublic = body.isPublic;
    data.reviewStatus = body.isPublic ? "APPROVED" : "REJECTED";
  }

  const role = await prisma.roleMarket.update({
    where: { id },
    data,
  });

  return NextResponse.json({ data: role });
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
  await prisma.roleMarket.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
