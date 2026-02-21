import { del, get, set } from "idb-keyval";

import type { ChatSession } from "@/store/chat-store";

export type LocalChatMessage = {
  id?: string;
  role: string;
  content: string;
};

const KEY_PREFIX = "unlimited-ai-chat";

function buildOwnerKey(userId: string | null) {
  return userId ? `user:${userId}` : "guest";
}

function sessionsKey(ownerKey: string) {
  return `${KEY_PREFIX}:sessions:${ownerKey}`;
}

function messagesKey(ownerKey: string, chatId: string) {
  return `${KEY_PREFIX}:messages:${ownerKey}:${chatId}`;
}

function normalizeSession(raw: unknown, fallbackIndex: number): ChatSession | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<ChatSession>;
  if (typeof value.id !== "string" || value.id.trim().length === 0) return null;

  const createdAt =
    typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
      ? value.createdAt
      : Date.now() - fallbackIndex;

  return {
    id: value.id,
    title: typeof value.title === "string" ? value.title : "",
    createdAt,
    roleId: typeof value.roleId === "string" ? value.roleId : undefined,
  };
}

function normalizeMessage(raw: unknown): LocalChatMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<LocalChatMessage>;
  if (typeof value.role !== "string") return null;

  return {
    id: typeof value.id === "string" ? value.id : undefined,
    role: value.role,
    content: typeof value.content === "string" ? value.content : "",
  };
}

export async function loadLocalChatSessions(userId: string | null): Promise<ChatSession[]> {
  const owner = buildOwnerKey(userId);
  let raw = await get<unknown>(sessionsKey(owner));

  // If user just logged in, migrate pre-login guest cache into user namespace once.
  if (
    owner !== "guest" &&
    (!Array.isArray(raw) || raw.length === 0)
  ) {
    const guestRaw = await get<unknown>(sessionsKey("guest"));
    if (Array.isArray(guestRaw) && guestRaw.length > 0) {
      raw = guestRaw;
      await set(sessionsKey(owner), guestRaw);
      await del(sessionsKey("guest"));
    }
  }

  if (!Array.isArray(raw)) return [];

  const sessions = raw
    .map((item, index) => normalizeSession(item, index))
    .filter((item): item is ChatSession => Boolean(item))
    .sort((a, b) => b.createdAt - a.createdAt);

  return sessions;
}

export async function saveLocalChatSessions(
  userId: string | null,
  sessions: ChatSession[],
): Promise<void> {
  const owner = buildOwnerKey(userId);
  const normalized = sessions
    .map((item, index) => normalizeSession(item, index))
    .filter((item): item is ChatSession => Boolean(item));

  await set(sessionsKey(owner), normalized);
}

export async function loadLocalChatMessages(
  userId: string | null,
  chatId: string,
): Promise<LocalChatMessage[]> {
  if (!chatId) return [];
  const owner = buildOwnerKey(userId);
  let raw = await get<unknown>(messagesKey(owner, chatId));

  if (owner !== "guest" && (!Array.isArray(raw) || raw.length === 0)) {
    const guestRaw = await get<unknown>(messagesKey("guest", chatId));
    if (Array.isArray(guestRaw) && guestRaw.length > 0) {
      raw = guestRaw;
      await set(messagesKey(owner, chatId), guestRaw);
      await del(messagesKey("guest", chatId));
    }
  }

  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => normalizeMessage(item))
    .filter((item): item is LocalChatMessage => Boolean(item));
}

export async function saveLocalChatMessages(
  userId: string | null,
  chatId: string,
  messages: LocalChatMessage[],
): Promise<void> {
  if (!chatId) return;
  const owner = buildOwnerKey(userId);
  const normalized = messages
    .map((item) => normalizeMessage(item))
    .filter((item): item is LocalChatMessage => Boolean(item));

  await set(messagesKey(owner, chatId), normalized);
}

export async function deleteLocalChatSession(
  userId: string | null,
  chatId: string,
): Promise<void> {
  if (!chatId) return;
  const owner = buildOwnerKey(userId);
  const existing = await loadLocalChatSessions(userId);
  await set(
    sessionsKey(owner),
    existing.filter((session) => session.id !== chatId),
  );
  await del(messagesKey(owner, chatId));
}
