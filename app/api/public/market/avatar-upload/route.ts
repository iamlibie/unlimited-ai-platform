import { randomUUID } from "crypto";
import path from "path";
import { writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import sharp from "sharp";

import { authOptions } from "@/lib/auth";
import { buildRoleUploadUrl, resolveRoleUploadDir } from "@/lib/role-upload";

export const runtime = "nodejs";

const MAX_UPLOAD_SIZE = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "\u4ec5\u652f\u6301 PNG/JPEG/WEBP" },
      { status: 400 },
    );
  }

  if (file.size <= 0 || file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: "\u56fe\u7247\u5927\u5c0f\u9700\u5728 2MB \u4ee5\u5185" },
      { status: 400 },
    );
  }

  let sourceBuffer: Buffer;
  try {
    sourceBuffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json(
      { error: "\u8bfb\u53d6\u56fe\u7247\u5931\u8d25" },
      { status: 400 },
    );
  }

  let processedBuffer: Buffer;
  try {
    processedBuffer = await sharp(sourceBuffer, {
      failOn: "error",
      limitInputPixels: 4096 * 4096,
    })
      .rotate()
      .resize(512, 512, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      {
        error:
          "\u56fe\u7247\u5904\u7406\u5931\u8d25\uff0c\u8bf7\u66f4\u6362\u56fe\u7247\u91cd\u8bd5",
      },
      { status: 400 },
    );
  }

  const fileName = `${Date.now()}-${randomUUID()}.webp`;
  const uploadDir = await resolveRoleUploadDir("role-avatars");
  const filePath = path.join(uploadDir, fileName);

  try {
    await writeFile(filePath, processedBuffer);
  } catch {
    return NextResponse.json(
      { error: "\u5934\u50cf\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: {
      url: buildRoleUploadUrl("role-avatars", fileName),
      size: processedBuffer.length,
      mimeType: "image/webp",
    },
  });
}
