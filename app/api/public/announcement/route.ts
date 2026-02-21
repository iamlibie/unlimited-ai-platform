import { NextResponse } from "next/server";

import { readAnnouncementConfig } from "@/lib/announcement-config";

export const runtime = "nodejs";

export async function GET() {
  const announcement = await readAnnouncementConfig();

  if (!announcement.enabled || !announcement.content.trim()) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({
    data: {
      title: announcement.title,
      content: announcement.content,
      updatedAt: announcement.updatedAt,
    },
  });
}
