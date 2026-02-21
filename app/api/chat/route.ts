import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { consumeChatQuota } from "@/lib/billing";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function buildCompletionsUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (/\/chat\/completions$/i.test(normalized)) {
    return normalized;
  }
  if (/\/v1$/i.test(normalized)) {
    return `${normalized}/chat/completions`;
  }
  return `${normalized}/v1/chat/completions`;
}

function collectUserMessage(messages: unknown[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i] as { role?: string; content?: unknown };
    if (message?.role === "user") {
      return message.content ?? "";
    }
  }
  return "";
}

async function readAssistantContent(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const lines = part.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") {
          return content;
        }
        try {
          const payload = JSON.parse(data);
          const delta = payload?.choices?.[0]?.delta?.content;
          if (typeof delta === "string") {
            content += delta;
          }
        } catch {
          // ignore parse error
        }
      }
    }
  }

  return content;
}

function extractDeltaText(part: string) {
  const deltas: string[] = [];
  const lines = part.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;

    const data = trimmed.slice(5).trim();
    if (!data) continue;
    if (data === "[DONE]") {
      return { done: true, deltas };
    }

    try {
      const payload = JSON.parse(data);
      const delta = payload?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        deltas.push(delta);
      }
    } catch {
      // ignore parse error
    }
  }

  return { done: false, deltas };
}

function streamOpenAIEventToText(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = stream.getReader();
      let buffer = "";

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const { done: streamDone, deltas } = extractDeltaText(part);
            for (const delta of deltas) {
              controller.enqueue(encoder.encode(delta));
            }
            if (streamDone) {
              controller.close();
              return;
            }
          }
        }

        if (buffer.trim()) {
          const { deltas } = extractDeltaText(buffer);
          for (const delta of deltas) {
            controller.enqueue(encoder.encode(delta));
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

function extractAssistantFromPayload(payload: any): string {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item?.text === "string") return item.text;
        if (typeof item === "string") return item;
        return "";
      })
      .join("");
  }

  if (typeof payload?.output_text === "string") {
    return payload.output_text;
  }

  return "";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? 100);
  const take = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(500, Math.floor(limitParam)))
    : 100;

  const chats = await prisma.chat.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      roleId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    data: chats.map((chat) => ({
      id: chat.id,
      title: chat.title || `\u4f1a\u8bdd ${chat.id.slice(0, 6)}`,
      roleId: chat.roleId ?? undefined,
      createdAt: chat.createdAt.getTime(),
    })),
  });
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

  const customModel =
    typeof body?.customModel === "string" ? body.customModel.trim() : "";
  const isCustomMode = customModel.length > 0;
  const modelId: string | undefined =
    typeof body?.modelId === "string" ? body.modelId : undefined;
  if (!isCustomMode && !modelId) {
    return NextResponse.json({ error: "modelId is required" }, { status: 400 });
  }
  const customApiKeyFromBody =
    typeof body?.customApiKey === "string" ? body.customApiKey.trim() : "";
  const customBaseUrlFromBody =
    typeof body?.customBaseUrl === "string" ? body.customBaseUrl.trim() : "";
  const isRegenerate = body?.isRegenerate === true;
  const localSystemPrompt =
    typeof body?.localSystemPrompt === "string"
      ? body.localSystemPrompt.trim().slice(0, 8000)
      : "";

  const now = new Date();
  const activeVip = await prisma.vipSubscription.findFirst({
    where: {
      userId,
      active: true,
      expiresAt: { gt: now },
    },
    select: { id: true },
  });
  const canPersistCloudChat = Boolean(activeVip);

  const rawChatId = typeof body?.chatId === "string" ? body.chatId : undefined;
  const chatId = canPersistCloudChat ? rawChatId : undefined;
  const roleId = typeof body?.roleId === "string" ? body.roleId : undefined;
  const incomingTitle = typeof body?.title === "string" ? body.title.trim() : "";

  let validatedRole: { id: string; prompt: string } | null = null;
  if (roleId) {
    const role = await prisma.roleMarket.findFirst({
      where: {
        id: roleId,
        OR: [
          {
            isPublic: true,
            reviewStatus: "APPROVED",
          },
          { createdByUserId: userId },
        ],
      },
      select: { id: true, prompt: true },
    });
    if (!role) {
      return NextResponse.json({ error: "Role forbidden" }, { status: 403 });
    }
    validatedRole = role;
  }

  if (chatId) {
    const existingChat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (existingChat && existingChat.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (existingChat) {
      const updates: { roleId?: string; title?: string } = {};
      if (validatedRole?.id && existingChat.roleId !== validatedRole.id) {
        updates.roleId = validatedRole.id;
      }
      if (incomingTitle && !existingChat.title) {
        updates.title = incomingTitle;
      }
      if (Object.keys(updates).length > 0) {
        await prisma.chat.update({
          where: { id: chatId },
          data: updates,
        });
      }
    } else {
      await prisma.chat.create({
        data: {
          id: chatId,
          userId,
          roleId: validatedRole?.id ?? null,
          title: incomingTitle || null,
        },
      });
    }
  }

  const [channel, appConfig] = await Promise.all([
    modelId ? prisma.channel.findFirst({ where: { id: modelId } }) : Promise.resolve(null),
    prisma.appConfig.findFirst(),
  ]);

  if (!isCustomMode && (!channel || !channel.isActive)) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const channelApiKeyValue = (channel?.systemApiKey ?? "").trim();
  if (isCustomMode && !customApiKeyFromBody) {
    return NextResponse.json(
      { error: "自定义模型需要先在 API 中心填写你自己的 API Key（仅浏览器本地）" },
      { status: 400 },
    );
  }

  if (isCustomMode && !customBaseUrlFromBody) {
    return NextResponse.json(
      { error: "自定义模型需要先在 API 中心填写你自己的 Base URL（仅浏览器本地）" },
      { status: 400 },
    );
  }

  const apiKey = isCustomMode
    ? customApiKeyFromBody
    : channelApiKeyValue;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Channel API key is not configured" },
      { status: 400 },
    );
  }

  const channelBaseUrl = channel?.baseUrl?.trim() ?? "";
  const defaultBaseUrl = appConfig?.defaultBaseUrl?.trim() ?? "";
  const baseUrl = isCustomMode
    ? customBaseUrlFromBody
    : channelBaseUrl || defaultBaseUrl;

  if (!baseUrl) {
    return NextResponse.json(
      { error: "Base URL is not configured" },
      { status: 400 },
    );
  }

  if (!isCustomMode && !isRegenerate) {
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const billingResult = await consumeChatQuota({
      userId,
      channelId: channel.id,
    });
    if (!billingResult.ok) {
      return NextResponse.json(
        {
          error: billingResult.message,
          code: billingResult.code,
          billing: billingResult.billing,
        },
        { status: billingResult.status },
      );
    }
  }

  const enabledExtensionIds = Array.isArray(body?.enabledExtensions)
    ? body.enabledExtensions.filter((item: unknown) => typeof item === "string")
    : [];

  const extensionPrompts = enabledExtensionIds.length
    ? (
        await prisma.extension.findMany({
          where: { id: { in: enabledExtensionIds } },
          select: { prompt: true },
        })
      ).map((item) => item.prompt)
    : [];

  let rolePrompt: string | undefined;
  if (validatedRole) {
    rolePrompt = validatedRole.prompt;
  } else if (chatId) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { role: true },
    });
    if (chat?.role) {
      const roleVisible =
        (chat.role.isPublic && chat.role.reviewStatus === "APPROVED") ||
        chat.role.createdByUserId === userId;
      rolePrompt = roleVisible ? chat.role.prompt : undefined;
    }
  }

  const adminGlobalPrompt =
    typeof appConfig?.globalSystemPrompt === "string"
      ? appConfig.globalSystemPrompt.trim()
      : "";
  const channelSystemPrompt = !isCustomMode
    ? channel?.systemPrompt?.trim() ?? ""
    : "";
  const layeredSystemParts: string[] = [];

  if (adminGlobalPrompt) {
    layeredSystemParts.push(
      [
        "[Priority 1 | Platform Global Prompt (Admin)]",
        adminGlobalPrompt,
      ].join("\n"),
    );
  }

  if (channelSystemPrompt) {
    layeredSystemParts.push(
      [
        "[Priority 2 | Channel Model Prompt (Admin)]",
        channelSystemPrompt,
      ].join("\n"),
    );
  }

  if (localSystemPrompt) {
    layeredSystemParts.push(
      [
        "[Priority 3 | User Local Global Prompt (Browser)]",
        localSystemPrompt,
      ].join("\n"),
    );
  }

  if (extensionPrompts.length > 0) {
    layeredSystemParts.push(
      ["[Priority 4 | Extensions]", extensionPrompts.join("\n\n")].join("\n"),
    );
  }

  if (typeof rolePrompt === "string" && rolePrompt.trim()) {
    layeredSystemParts.push(
      ["[Priority 5 | Role Prompt]", rolePrompt.trim()].join("\n"),
    );
  }

  const systemParts: string[] = [];
  if (layeredSystemParts.length > 0) {
    systemParts.push(
      [
        "System instruction precedence (highest to lowest):",
        "1) Platform Global Prompt",
        "2) Channel Model Prompt",
        "3) User Local Global Prompt",
        "4) Extensions",
        "5) Role Prompt",
        "If conflicts occur, obey higher priority first.",
      ].join("\n"),
    );
    systemParts.push(...layeredSystemParts);
  }

  const systemMessage =
    systemParts.length > 0
      ? {
          role: "system",
          content: systemParts.join("\n\n"),
        }
      : null;

  const clientMessages = Array.isArray(body?.messages) ? body.messages : [];
  const messages = systemMessage
    ? [systemMessage, ...clientMessages]
    : [...clientMessages];

  if (chatId) {
    const userContent = collectUserMessage(clientMessages);
    if (userContent !== "") {
      await prisma.message.create({
        data: {
          chatId,
          role: "user",
          content: userContent,
        },
      });
    }
  }

  const {
    modelId: _modelId,
    customModel: _customModel,
    customApiKey: _customApiKey,
    customBaseUrl: _customBaseUrl,
    stream: _stream,
    isRegenerate: _isRegenerate,
    localSystemPrompt: _localSystemPrompt,
    roleId: _roleId,
    chatId: _chatId,
    enabledExtensions: _enabledExtensions,
    title: _title,
    ...rest
  } = body ?? {};

  const stream =
    typeof _stream === "boolean"
      ? _stream
      : true;

  const resolvedModelName = isCustomMode ? customModel : channel?.modelName ?? "";
  if (!resolvedModelName) {
    return NextResponse.json(
      { error: "Channel model is not configured" },
      { status: 400 },
    );
  }

  const upstreamBody = {
    ...rest,
    model: resolvedModelName,
    stream,
    messages,
  };

  const upstreamUrl = buildCompletionsUrl(baseUrl);

  const upstream = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(upstreamBody),
  });

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  if (!upstream.body) {
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers });
  }

  const isOpenAIEventStream = contentType?.includes("text/event-stream");

  if (chatId && isOpenAIEventStream) {
    const [clientEventStream, storeStream] = upstream.body.tee();
    void (async () => {
      const assistantContent = await readAssistantContent(storeStream);
      if (assistantContent.trim().length === 0) return;
      await prisma.message.create({
        data: {
          chatId,
          role: "assistant",
          content: assistantContent,
        },
      });
    })();

    headers.set("content-type", "text/plain; charset=utf-8");
    return new Response(streamOpenAIEventToText(clientEventStream), {
      status: upstream.status,
      headers,
    });
  }

  if (isOpenAIEventStream) {
    headers.set("content-type", "text/plain; charset=utf-8");
    return new Response(streamOpenAIEventToText(upstream.body), {
      status: upstream.status,
      headers,
    });
  }

  const rawText = await upstream.text();
  let textToClient = rawText;

  if (contentType?.includes("application/json")) {
    try {
      const payload = JSON.parse(rawText);
      const extractedText = extractAssistantFromPayload(payload);
      if (extractedText.trim()) {
        textToClient = extractedText;
      }
    } catch {
      // keep original raw text
    }
  }

  if (chatId && upstream.ok && textToClient.trim()) {
    await prisma.message.create({
      data: {
        chatId,
        role: "assistant",
        content: textToClient,
      },
    });
  }

  headers.set("content-type", "text/plain; charset=utf-8");
  return new Response(textToClient, { status: upstream.status, headers });
}
