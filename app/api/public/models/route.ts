import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}

function buildModelsUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (/\/models$/i.test(normalized)) return normalized;
  if (/\/v1$/i.test(normalized)) return `${normalized}/models`;
  return `${normalized}/v1/models`;
}

function parseModelList(payload: any) {
  const modelSet = new Set<string>();

  if (Array.isArray(payload?.data)) {
    payload.data.forEach((item: any) => {
      if (typeof item?.id === "string" && item.id.trim()) {
        modelSet.add(item.id.trim());
      } else if (typeof item?.name === "string" && item.name.trim()) {
        modelSet.add(item.name.trim());
      }
    });
  }

  if (Array.isArray(payload?.models)) {
    payload.models.forEach((item: any) => {
      if (typeof item === "string" && item.trim()) {
        modelSet.add(item.trim());
      } else if (typeof item?.name === "string" && item.name.trim()) {
        modelSet.add(item.name.trim());
      } else if (typeof item?.id === "string" && item.id.trim()) {
        modelSet.add(item.id.trim());
      }
    });
  }

  return Array.from(modelSet);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  const baseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";

  if (!baseUrl) {
    return NextResponse.json({ error: "Base URL is required" }, { status: 400 });
  }

  const modelsUrl = buildModelsUrl(baseUrl);
  const headers = new Headers();
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }

  let upstream: Response;
  try {
    upstream = await fetch(modelsUrl, {
      method: "GET",
      headers,
    });
  } catch {
    return NextResponse.json({ error: "请求模型列表失败" }, { status: 502 });
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: text || `上游返回 ${upstream.status}` },
      { status: 502 },
    );
  }

  let payload: any = null;
  try {
    payload = await upstream.json();
  } catch {
    return NextResponse.json({ error: "模型列表响应格式无效" }, { status: 502 });
  }

  return NextResponse.json({ data: parseModelList(payload) });
}
