import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function GET(req: NextRequest) {
  const mine = req.nextUrl.searchParams.get("mine") === "1";
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (mine) {
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = await prisma.roleMarket.findMany({
      where: { createdByUserId: userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: roles });
  }

  const roles = await prisma.roleMarket.findMany({
    where: {
      isPublic: true,
      reviewStatus: "APPROVED",
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: roles });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; name?: string | null; email?: string | null } | undefined;
  const userId = user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = normalizeText(body?.name, 64);
  const description = normalizeText(body?.description, 4000);
  const prompt = normalizeText(body?.prompt, 12000);
  const category = normalizeText(body?.category, 32) || "General";
  const avatarUrl = normalizeText(body?.avatarUrl, 300);
  const backgroundUrl = normalizeText(body?.backgroundUrl, 300);
  const visibility =
    body?.visibility === "public" || body?.visibility === "private"
      ? body.visibility
      : "private";

  if (!name || !description || !prompt) {
    return NextResponse.json(
      { error: "name, description, prompt are required" },
      { status: 400 },
    );
  }

  if (avatarUrl && !avatarUrl.startsWith("/uploads/role-avatars/")) {
    return NextResponse.json({ error: "avatarUrl is invalid" }, { status: 400 });
  }
  if (backgroundUrl && !backgroundUrl.startsWith("/uploads/role-backgrounds/")) {
    return NextResponse.json({ error: "backgroundUrl is invalid" }, { status: 400 });
  }

  const wantsPublic = visibility === "public";
  const author = normalizeText(user.name || user.email || "User", 64) || "User";

  const role = await prisma.roleMarket.create({
    data: {
      name,
      description,
      prompt,
      author,
      category,
      avatarUrl: avatarUrl || null,
      backgroundUrl: backgroundUrl || null,
      isPublic: false,
      publicRequested: wantsPublic,
      reviewStatus: wantsPublic ? "PENDING" : "APPROVED",
      createdByUserId: userId,
    },
  });

  return NextResponse.json({
    data: role,
    message: wantsPublic
      ? "Submitted for review. It will be public after admin approval."
      : "Saved as private role card.",
  });
}
