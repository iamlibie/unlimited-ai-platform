import { nanoid } from "nanoid";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  roleId?: string;
};

export type ApiSettings = {
  apiKey: string;
  baseUrl: string;
  historyLength: number;
  customModel?: string;
  customModels?: string[];
};

type ChatStore = {
  sessions: ChatSession[];
  currentSessionId: string | null;
  ownerUserId: string | null;
  localSystemPrompt: string;
  localSystemPromptMap: Record<string, string>;
  cloudBackupEnabled: boolean;
  selectedChannelId: string;
  enabledExtensions: string[];
  apiSettings: ApiSettings;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  createSession: (options?: { title?: string; roleId?: string }) => string;
  upsertSession: (session: ChatSession) => void;
  hydrateSessions: (sessions: ChatSession[]) => void;
  deleteSession: (id: string) => void;
  updateSession: (id: string, data: Partial<ChatSession>) => void;
  setCurrentSessionId: (id: string | null) => void;
  setSelectedChannelId: (id: string) => void;
  setEnabledExtensions: (ids: string[]) => void;
  toggleExtension: (id: string) => void;
  setApiSettings: (settings: Partial<ApiSettings>) => void;
  setLocalSystemPrompt: (prompt: string) => void;
  syncSessionOwner: (ownerUserId: string | null) => void;
  setCloudBackupEnabled: (enabled: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
};

const DEFAULT_SESSION_PREFIX = "\u65b0\u5bf9\u8bdd";

function normalizeCustomModels(models: string[] | undefined) {
  if (!Array.isArray(models)) return [];
  return Array.from(
    new Set(
      models
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function normalizeSessionTitle(title: string | undefined, fallbackIndex: number) {
  const cleaned = title?.trim() ?? "";
  if (!cleaned) return `${DEFAULT_SESSION_PREFIX} ${fallbackIndex}`;
  if (/^\?{2,}/.test(cleaned)) {
    return `${DEFAULT_SESSION_PREFIX} ${fallbackIndex}`;
  }
  return cleaned;
}

function ownerPromptKey(ownerUserId: string | null) {
  return ownerUserId ?? "guest";
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,
      ownerUserId: null,
      localSystemPrompt: "",
      localSystemPromptMap: {},
      cloudBackupEnabled: false,
      selectedChannelId: "channel_free",
      enabledExtensions: [],
      apiSettings: {
        apiKey: "",
        baseUrl: "",
        historyLength: 20,
        customModel: "",
        customModels: [],
      },
      sidebarOpen: true,
      sidebarCollapsed: false,
      createSession: (options) => {
        const id = nanoid();
        const nextTitle = normalizeSessionTitle(
          options?.title,
          get().sessions.length + 1,
        );
        const session: ChatSession = {
          id,
          title: nextTitle,
          createdAt: Date.now(),
          roleId: options?.roleId,
        };
        set((state) => ({
          sessions: [session, ...state.sessions],
          currentSessionId: id,
        }));
        return id;
      },
      upsertSession: (session) => {
        set((state) => {
          const normalizedSession: ChatSession = {
            ...session,
            title: normalizeSessionTitle(session.title, state.sessions.length + 1),
          };
          const exists = state.sessions.some((item) => item.id === session.id);
          if (exists) {
            return {
              sessions: state.sessions.map((item) =>
                item.id === session.id
                  ? { ...item, ...normalizedSession, createdAt: item.createdAt }
                  : item,
              ),
            };
          }
          return { sessions: [normalizedSession, ...state.sessions] };
        });
      },
      hydrateSessions: (sessions) => {
        set((state) => {
          const merged = new Map(state.sessions.map((item) => [item.id, item]));
          sessions.forEach((session, index) => {
            const normalized: ChatSession = {
              ...session,
              createdAt:
                typeof session.createdAt === "number" && Number.isFinite(session.createdAt)
                  ? session.createdAt
                  : Date.now(),
              title: normalizeSessionTitle(session.title, index + 1),
            };
            const existing = merged.get(session.id);
            merged.set(session.id, existing ? { ...existing, ...normalized } : normalized);
          });
          return {
            sessions: Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt),
          };
        });
      },
      deleteSession: (id) => {
        set((state) => {
          const nextSessions = state.sessions.filter((session) => session.id !== id);
          const nextCurrent =
            state.currentSessionId === id ? nextSessions[0]?.id ?? null : state.currentSessionId;
          return { sessions: nextSessions, currentSessionId: nextCurrent };
        });
      },
      updateSession: (id, data) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === id ? { ...session, ...data } : session,
          ),
        }));
      },
      setCurrentSessionId: (id) => set({ currentSessionId: id }),
      setSelectedChannelId: (id) => set({ selectedChannelId: id }),
      setEnabledExtensions: (ids) => set({ enabledExtensions: ids }),
      toggleExtension: (id) => {
        set((state) => {
          const exists = state.enabledExtensions.includes(id);
          return {
            enabledExtensions: exists
              ? state.enabledExtensions.filter((item) => item !== id)
              : [...state.enabledExtensions, id],
          };
        });
      },
      setApiSettings: (settings) =>
        set((state) => ({
          apiSettings: (() => {
            const next: ApiSettings = {
              ...state.apiSettings,
              ...settings,
            };
            next.customModel = (next.customModel ?? "").trim();
            next.customModels = normalizeCustomModels(next.customModels);
            if (
              next.customModel &&
              !next.customModels.includes(next.customModel)
            ) {
              next.customModels = [next.customModel, ...next.customModels];
            }
            return next;
          })(),
        })),
      setLocalSystemPrompt: (prompt) =>
        set((state) => {
          const value = typeof prompt === "string" ? prompt : "";
          const key = ownerPromptKey(state.ownerUserId);
          const nextMap = { ...state.localSystemPromptMap };

          if (value.trim().length > 0) {
            nextMap[key] = value;
          } else {
            delete nextMap[key];
          }

          return {
            localSystemPrompt: value,
            localSystemPromptMap: nextMap,
          };
        }),
      syncSessionOwner: (ownerUserId) =>
        set((state) => {
          if (state.ownerUserId === ownerUserId) return {};
          const nextPrompt = state.localSystemPromptMap[ownerPromptKey(ownerUserId)] ?? "";
          return {
            ownerUserId,
            sessions: [],
            currentSessionId: null,
            enabledExtensions: [],
            localSystemPrompt: nextPrompt,
          };
        }),
      setCloudBackupEnabled: (enabled) => set({ cloudBackupEnabled: enabled }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebarCollapsed: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: "unlimited-ai-chat-store",
      version: 7,
      migrate: (persistedState) => {
        const state = persistedState as Partial<ChatStore>;
        const sessions = Array.isArray(state.sessions) ? state.sessions : [];
        const currentModel = (state.apiSettings?.customModel ?? "").trim();
        const customModels = normalizeCustomModels(state.apiSettings?.customModels);
        const localSystemPromptMapRaw = state.localSystemPromptMap;
        const localSystemPromptMap: Record<string, string> =
          localSystemPromptMapRaw && typeof localSystemPromptMapRaw === "object"
            ? Object.entries(localSystemPromptMapRaw).reduce<Record<string, string>>(
                (acc, [key, value]) => {
                  if (!key) return acc;
                  if (typeof value === "string" && value.trim().length > 0) {
                    acc[key] = value;
                  }
                  return acc;
                },
                {},
              )
            : {};
        const ownerKey = ownerPromptKey(state.ownerUserId ?? null);
        if (
          typeof state.localSystemPrompt === "string" &&
          state.localSystemPrompt.trim().length > 0 &&
          !localSystemPromptMap[ownerKey]
        ) {
          localSystemPromptMap[ownerKey] = state.localSystemPrompt;
        }
        const activeLocalSystemPrompt = localSystemPromptMap[ownerKey] ?? "";
        if (currentModel && !customModels.includes(currentModel)) {
          customModels.unshift(currentModel);
        }
        return {
          ...state,
          apiSettings: {
            apiKey: state.apiSettings?.apiKey ?? "",
            baseUrl: state.apiSettings?.baseUrl ?? "",
            historyLength: state.apiSettings?.historyLength ?? 20,
            customModel: currentModel,
            customModels,
          },
          sidebarOpen: state.sidebarOpen ?? true,
          sidebarCollapsed: state.sidebarCollapsed ?? false,
          ownerUserId: state.ownerUserId ?? null,
          localSystemPromptMap,
          localSystemPrompt: activeLocalSystemPrompt,
          cloudBackupEnabled: state.cloudBackupEnabled ?? false,
          sessions: sessions.map((session, index) => ({
            ...session,
            createdAt:
              typeof session.createdAt === "number" && Number.isFinite(session.createdAt)
                ? session.createdAt
                : Date.now(),
            title: normalizeSessionTitle(session.title, index + 1),
          })),
        } as ChatStore;
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
        selectedChannelId: state.selectedChannelId,
        enabledExtensions: state.enabledExtensions,
        apiSettings: state.apiSettings,
        ownerUserId: state.ownerUserId,
        localSystemPrompt: state.localSystemPrompt,
        localSystemPromptMap: state.localSystemPromptMap,
        cloudBackupEnabled: state.cloudBackupEnabled,
        sidebarOpen: state.sidebarOpen,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);
