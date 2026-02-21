import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-auth";
import { readAnnouncementConfig, writeAnnouncementConfig } from "@/lib/announcement-config";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const announcement = await readAnnouncementConfig();
    return NextResponse.json({ data: announcement });
  } catch {
    return NextResponse.json({ error: "读取公告失败" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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

  try {
    const next = await writeAnnouncementConfig({
      enabled: Boolean(body?.enabled),
      title: typeof body?.title === "string" ? body.title : "",
      content: typeof body?.content === "string" ? body.content : "",
    });
    return NextResponse.json({ data: next });
  } catch {
    return NextResponse.json({ error: "保存公告失败" }, { status: 500 });
  }
}
