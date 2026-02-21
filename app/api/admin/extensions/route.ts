import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const extensions = await prisma.extension.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: extensions });
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
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const isPublic = Boolean(body?.isPublic ?? true);

  if (!name || !description || !prompt) {
    return NextResponse.json(
      { error: "name, description, prompt are required" },
      { status: 400 },
    );
  }

  const extension = await prisma.extension.create({
    data: {
      name,
      description,
      prompt,
      isPublic,
    },
  });

  return NextResponse.json({ data: extension });
}
