import { readFile } from "fs/promises";
import path from "path";
import mime from "mime";

import { getRoleUploadReadRoots, parseRoleUploadAssetPath } from "@/lib/role-upload";

export const runtime = "nodejs";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { path: segments } = await context.params;
  const parsed = parseRoleUploadAssetPath(segments);

  if (!parsed) {
    return new Response("Not Found", { status: 404 });
  }

  const roots = await getRoleUploadReadRoots();
  const contentType = mime.getType(parsed.fileName) ?? "application/octet-stream";

  for (const root of roots) {
    const filePath = path.join(root, parsed.bucket, parsed.fileName);
    try {
      const fileBuffer = await readFile(filePath);
      return new Response(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      // continue to next candidate
    }
  }

  return new Response("Not Found", { status: 404 });
}
