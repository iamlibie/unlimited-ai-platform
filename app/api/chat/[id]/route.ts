import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function normalizeContent(content: unknown) {
  if (typeof content === "string") return content;
  if (typeof content === "number") return String(content);
  if (content && typeof content === "object") {
    const maybeText = (content as { text?: string }).text;
    if (typeof maybeText === "string") return maybeText;
  }
  try {
    return JSON.stringify(content);
  } catch {
    return "";
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chat = await prisma.chat.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!chat) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  if (chat.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await prisma.message.findMany({
    where: { chatId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    data: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: normalizeContent(message.content),
    })),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chat = await prisma.chat.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!chat) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  if (chat.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.chat.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
