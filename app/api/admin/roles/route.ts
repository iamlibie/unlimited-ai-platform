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

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roles = await prisma.roleMarket.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: roles });
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
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const author = typeof body?.author === "string" ? body.author.trim() : "系统";
  const category = typeof body?.category === "string" ? body.category.trim() : "General";
  const avatarUrl = typeof body?.avatarUrl === "string" ? body.avatarUrl.trim() : "";
  const backgroundUrl =
    typeof body?.backgroundUrl === "string" ? body.backgroundUrl.trim() : "";
  const isPublic = Boolean(body?.isPublic ?? true);

  if (!name || !description || !prompt) {
    return NextResponse.json(
      { error: "name, description, prompt are required" },
      { status: 400 },
    );
  }
  if (!isAllowedImageUrl(avatarUrl, "avatar")) {
    return NextResponse.json({ error: "avatarUrl is invalid" }, { status: 400 });
  }
  if (!isAllowedImageUrl(backgroundUrl, "background")) {
    return NextResponse.json({ error: "backgroundUrl is invalid" }, { status: 400 });
  }

  const role = await prisma.roleMarket.create({
    data: {
      name,
      description,
      prompt,
      author,
      category,
      avatarUrl: avatarUrl || null,
      backgroundUrl: backgroundUrl || null,
      isPublic,
      publicRequested: isPublic,
      reviewStatus: "APPROVED",
      createdByUserId: null,
    },
  });

  return NextResponse.json({ data: role });
}
