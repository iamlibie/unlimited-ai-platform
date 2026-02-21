"use client";

import {
  Suspense,
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import ChatInput from "@/components/chat/chat-input";
import ChatList from "@/components/chat/chat-list";
import ModelSelector from "@/components/chat/model-selector";
import QuickActions from "@/components/chat/quick-actions";
import AnnouncementBanner from "@/components/layout/announcement-banner";
import {
  loadLocalChatMessages,
  loadLocalChatSessions,
  saveLocalChatMessages,
  saveLocalChatSessions,
  type LocalChatMessage,
} from "@/lib/local-chat-db";
import { useChatStore } from "@/store/chat-store";

type BillingView = {
  points: number;
  pointsCap: number;
  dailyLoginPoints: number;
  dailyLoginGranted: number;
  vip: {
    active: boolean;
    monthlyRemaining: number;
  };
};

type ChatMessage = {
  id?: string;
  role: string;
  content: string;
};

function PublicHomePageContent() {
  const selectedChannelId = useChatStore((state) => state.selectedChannelId);
  const enabledExtensions = useChatStore((state) => state.enabledExtensions);
  const apiSettings = useChatStore((state) => state.apiSettings);
  const localSystemPrompt = useChatStore((state) => state.localSystemPrompt);
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const sessions = useChatStore((state) => state.sessions);
  const cloudBackupEnabled = useChatStore((state) => state.cloudBackupEnabled);
  const hydrateSessions = useChatStore((state) => state.hydrateSessions);
  const syncSessionOwner = useChatStore((state) => state.syncSessionOwner);
  const setCurrentSessionId = useChatStore((state) => state.setCurrentSessionId);
  const createSession = useChatStore((state) => state.createSession);
  const upsertSession = useChatStore((state) => state.upsertSession);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const ownerUserId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const currentSession = useMemo(() => {
    return sessions.find((session) => session.id === currentSessionId) || null;
  }, [sessions, currentSessionId]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [billing, setBilling] = useState<BillingView | null>(null);
  const [billingHint, setBillingHint] = useState<string | null>(null);
  const [loginBonusToast, setLoginBonusToast] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [messageInfoIndex, setMessageInfoIndex] = useState<number | null>(null);
  const loadedSessionRef = useRef<string | null>(null);
  const hydratedSessionsOwnerRef = useRef<string | null>(null);
  const saveMessagesTimerRef = useRef<number | null>(null);
  const loginBonusToastTimerRef = useRef<number | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const nearBottomRef = useRef(true);
  const cloudBackupActive = Boolean(ownerUserId && billing?.vip.active && cloudBackupEnabled);
  const scrollOwnerKey = ownerUserId ?? "guest";

  const toLocalMessages = (
    source: ChatMessage[],
  ): LocalChatMessage[] =>
    source.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    }));

  const fetchBillingStatus = async () => {
    try {
      const res = await fetch("/api/public/billing", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json?.data) {
        setBilling(json.data as BillingView);
      }
    } catch {
      // ignore
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const persistLocalMessages = (
    sessionId: string | null | undefined,
    source: ChatMessage[],
  ) => {
    if (!sessionId) return;
    void saveLocalChatMessages(ownerUserId, sessionId, toLocalMessages(source));
  };

  const messageInfo = useMemo(() => {
    if (messageInfoIndex === null) return null;
    return messages[messageInfoIndex] ?? null;
  }, [messageInfoIndex, messages]);

  const openMessageInfo = (index: number) => {
    if (!messages[index]) return;
    setMessageInfoIndex(index);
  };

  const closeMessageInfo = () => {
    setMessageInfoIndex(null);
  };

  const applyBillingHintFromCode = (payload: {
    code?: string;
    billing?: BillingView;
  }) => {
    if (payload?.billing) {
      setBilling(payload.billing);
    }

    if (
      payload?.code === "INSUFFICIENT_POINTS" ||
      payload?.code === "INSUFFICIENT_STAMINA"
    ) {
      setBillingHint("点数不足，可明日登录领取或开通 VIP。");
    } else if (payload?.code === "VIP_REQUIRED") {
      setBillingHint("当前模型仅限 VIP 使用，请开通 VIP 或切换模型。");
    } else if (payload?.code === "INSUFFICIENT_PREMIUM_CREDITS") {
      setBillingHint("点数不足，请稍后再试或开通 VIP。");
    } else if (payload?.code === "MODEL_DISABLED") {
      setBillingHint("当前模型已暂停，请切换其他模型。");
    }
  };

  const updateBottomState = (
    container: HTMLDivElement,
    options?: { showOnDownScroll?: boolean },
  ) => {
    const distanceToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const currentTop = container.scrollTop;
    const isScrollingDown = currentTop > lastScrollTopRef.current + 1;
    nearBottomRef.current = distanceToBottom < 72;
    if (distanceToBottom <= 120) {
      setShowScrollToBottom(false);
    } else if (!options?.showOnDownScroll || isScrollingDown) {
      setShowScrollToBottom(true);
    }
    lastScrollTopRef.current = currentTop;
  };

  const getScrollStorageKey = (sessionId: string) =>
    `chat-scroll:${scrollOwnerKey}:${sessionId}`;

  const readStoredScrollTop = (sessionId: string): number | null => {
    if (typeof window === "undefined") return null;

    const key = getScrollStorageKey(sessionId);
    const sessionValue = window.sessionStorage.getItem(key);
    const localValue = window.localStorage.getItem(key);
    const value = sessionValue ?? localValue;
    if (value === null) return null;

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const writeStoredScrollTop = (sessionId: string, top: number) => {
    if (typeof window === "undefined") return;
    const key = getScrollStorageKey(sessionId);
    const value = String(Math.max(0, Math.floor(top)));
    try {
      window.sessionStorage.setItem(key, value);
      window.localStorage.setItem(key, value);
    } catch {
      // ignore storage failures
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const container = messageScrollRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
    updateBottomState(container);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || isLoading || !selectedChannelId) return;
    if (sessionStatus !== "authenticated") {
      setBillingHint("请先登录后再开始对话。");
      return;
    }
    setBillingHint(null);

    let sessionId = currentSessionId;
    let sessionTitle = currentSession?.title;

    if (!sessionId) {
      sessionTitle = content.slice(0, 20) || "新对话";
      sessionId = createSession({ title: sessionTitle });
      loadedSessionRef.current = sessionId;
      router.replace(`/?chatId=${sessionId}`);
    }

    const userMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content,
    };
    const assistantId = `a_${Date.now()}`;
    const outgoingMessages = [...messages, { role: "user", content }]
      .filter(
        (message) =>
          !(
            message.role === "assistant" &&
            message.content.trim() === "Error: Forbidden"
          ),
      )
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const draftMessages = [
      ...messages,
      userMessage,
      { id: assistantId, role: "assistant", content: "" },
    ];

    setInput("");
    setIsLoading(true);
    setMessages(draftMessages);
    persistLocalMessages(sessionId, draftMessages);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: outgoingMessages,
          modelId: selectedChannelId,
          customModel: apiSettings.customModel?.trim() || undefined,
          customApiKey: apiSettings.apiKey?.trim() || undefined,
          customBaseUrl: apiSettings.baseUrl?.trim() || undefined,
          localSystemPrompt: localSystemPrompt.trim() || undefined,
          enabledExtensions,
          roleId: currentSession?.roleId,
          chatId: cloudBackupActive ? sessionId : null,
          title: cloudBackupActive ? sessionTitle : undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | {
              error?: string;
              code?: string;
              billing?: BillingView;
            }
          | null;
        if (response.status === 403 && payload?.error === "Forbidden") {
          const nextId = createSession({ title: content.slice(0, 20) || "新对话" });
          setCurrentSessionId(nextId);
          loadedSessionRef.current = nextId;
          router.replace(`/?chatId=${nextId}`);
          setInput(content);
          let nextMessages: ChatMessage[] = [];
          setMessages((prev) => {
            nextMessages = prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: "该会话无权限，已切换到新会话，请重新发送。" }
                : message,
            );
            return nextMessages;
          });
          persistLocalMessages(sessionId, nextMessages);
          return;
        }
        applyBillingHintFromCode(payload ?? {});
        throw new Error(payload?.error || `Request failed: ${response.status}`);
      }

      if (!response.body) {
        const fullText = await response.text();
        let nextMessages: ChatMessage[] = [];
        setMessages((prev) => {
          nextMessages = prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: fullText || "No response" }
              : message,
          );
          return nextMessages;
        });
        persistLocalMessages(sessionId, nextMessages);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        assistantText += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: assistantText }
              : message,
          ),
        );
      }

      let finalMessages: ChatMessage[] = [];
      if (!assistantText.trim()) {
        assistantText = "No response content";
      }
      setMessages((prev) => {
        finalMessages = prev.map((message) =>
          message.id === assistantId
            ? { ...message, content: assistantText }
            : message,
        );
        return finalMessages;
      });
      persistLocalMessages(sessionId, finalMessages);
      await fetchBillingStatus();
    } catch (error) {
      const errorText = error instanceof Error ? error.message : "Request failed";
      let nextMessages: ChatMessage[] = [];
      setMessages((prev) => {
        nextMessages = prev.map((message) =>
          message.id === assistantId ? { ...message, content: `Error: ${errorText}` } : message,
        );
        return nextMessages;
      });
      persistLocalMessages(sessionId, nextMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditMessage = (index: number) => {
    const target = messages[index];
    if (!target) return;
    const nextContent = window.prompt(
      target.role === "assistant" ? "修改 AI 消息" : "修改消息",
      target.content,
    );
    if (nextContent === null) return;

    const value = nextContent.trim();
    if (!value) {
      setBillingHint("消息内容不能为空。");
      return;
    }

    const nextMessages = messages.map((message, messageIndex) =>
      messageIndex === index ? { ...message, content: value } : message,
    );
    setMessages(nextMessages);
    persistLocalMessages(currentSessionId, nextMessages);
  };

  const handleDeleteMessage = (index: number) => {
    if (!messages[index]) return;
    if (!window.confirm("确认删除这条消息？")) return;

    const nextMessages = messages.filter((_, messageIndex) => messageIndex !== index);
    setMessages(nextMessages);
    persistLocalMessages(currentSessionId, nextMessages);
  };

  const handleRegenerateMessage = async (messageIndex: number) => {
    if (isLoading) return;
    const currentMessage = messages[messageIndex];
    if (!currentMessage) return;
    if (currentMessage.role !== "assistant" && currentMessage.role !== "user") return;

    if (!selectedChannelId) return;
    if (sessionStatus !== "authenticated") {
      setBillingHint("请先登录后再开始对话。");
      return;
    }

    let targetUserIndex = -1;
    if (currentMessage.role === "user") {
      targetUserIndex = messageIndex;
    } else {
      for (let i = messageIndex - 1; i >= 0; i -= 1) {
        if (messages[i]?.role === "user") {
          targetUserIndex = i;
          break;
        }
      }
    }

    if (targetUserIndex < 0) {
      setBillingHint("未找到可重试的用户消息。");
      return;
    }

    setBillingHint(null);

    let sessionId = currentSessionId;
    let sessionTitle = currentSession?.title;
    const retryUserContent = messages[targetUserIndex]?.content ?? "";

    if (!sessionId) {
      sessionTitle = retryUserContent.slice(0, 20) || "新对话";
      sessionId = createSession({ title: sessionTitle });
      loadedSessionRef.current = sessionId;
      router.replace(`/?chatId=${sessionId}`);
    }

    const retryBaseMessages = messages
      .slice(0, targetUserIndex + 1)
      .filter(
        (message) =>
          !(
            message.role === "assistant" &&
            message.content.trim() === "Error: Forbidden"
          ),
      )
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const assistantId = `a_${Date.now()}`;
    const draftMessages = [
      ...messages.slice(0, targetUserIndex + 1),
      { id: assistantId, role: "assistant", content: "" },
    ];

    setIsLoading(true);
    setMessages(draftMessages);
    persistLocalMessages(sessionId, draftMessages);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: retryBaseMessages,
          modelId: selectedChannelId,
          customModel: apiSettings.customModel?.trim() || undefined,
          customApiKey: apiSettings.apiKey?.trim() || undefined,
          customBaseUrl: apiSettings.baseUrl?.trim() || undefined,
          isRegenerate: true,
          localSystemPrompt: localSystemPrompt.trim() || undefined,
          enabledExtensions,
          roleId: currentSession?.roleId,
          chatId: cloudBackupActive ? sessionId : null,
          title: cloudBackupActive ? sessionTitle : undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | {
              error?: string;
              code?: string;
              billing?: BillingView;
            }
          | null;
        applyBillingHintFromCode(payload ?? {});
        throw new Error(payload?.error || `Request failed: ${response.status}`);
      }

      if (!response.body) {
        const fullText = await response.text();
        let nextMessages: ChatMessage[] = [];
        setMessages((prev) => {
          nextMessages = prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: fullText || "No response" }
              : message,
          );
          return nextMessages;
        });
        persistLocalMessages(sessionId, nextMessages);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        assistantText += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: assistantText }
              : message,
          ),
        );
      }

      let finalMessages: ChatMessage[] = [];
      if (!assistantText.trim()) {
        assistantText = "No response content";
      }
      setMessages((prev) => {
        finalMessages = prev.map((message) =>
          message.id === assistantId
            ? { ...message, content: assistantText }
            : message,
        );
        return finalMessages;
      });
      persistLocalMessages(sessionId, finalMessages);
      await fetchBillingStatus();
    } catch (error) {
      const errorText = error instanceof Error ? error.message : "Request failed";
      let nextMessages: ChatMessage[] = [];
      setMessages((prev) => {
        nextMessages = prev.map((message) =>
          message.id === assistantId ? { ...message, content: `Error: ${errorText}` } : message,
        );
        return nextMessages;
      });
      persistLocalMessages(sessionId, nextMessages);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (messageInfoIndex === null) return;
    if (!messages[messageInfoIndex]) {
      setMessageInfoIndex(null);
    }
  }, [messageInfoIndex, messages]);

  useEffect(() => {
    setMessageInfoIndex(null);
  }, [currentSessionId]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!ownerUserId) {
      setBilling(null);
      return;
    }
    void fetchBillingStatus();
  }, [ownerUserId, sessionStatus]);

  useEffect(() => {
    if (!ownerUserId || !billing) return;
    const granted = Math.max(0, Math.floor(billing.dailyLoginGranted || 0));
    if (granted <= 0) return;

    setLoginBonusToast(`今日登录奖励 +${granted} 点`);
    if (loginBonusToastTimerRef.current) {
      window.clearTimeout(loginBonusToastTimerRef.current);
    }
    loginBonusToastTimerRef.current = window.setTimeout(() => {
      setLoginBonusToast(null);
      loginBonusToastTimerRef.current = null;
    }, 4200);
  }, [billing, ownerUserId]);

  useEffect(() => {
    return () => {
      if (loginBonusToastTimerRef.current) {
        window.clearTimeout(loginBonusToastTimerRef.current);
        loginBonusToastTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    syncSessionOwner(ownerUserId);
    hydratedSessionsOwnerRef.current = null;
  }, [ownerUserId, sessionStatus, syncSessionOwner]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    let active = true;

    const hydrateFromStorage = async () => {
      const localSessions = await loadLocalChatSessions(ownerUserId);
      if (!active) return;
      hydrateSessions(localSessions);

      if (cloudBackupActive) {
        try {
          const res = await fetch("/api/chat?limit=200");
          const json = await res.json();
          if (active && Array.isArray(json?.data)) {
            hydrateSessions(json.data);
          }
        } catch {
          // ignore cloud pull failures, keep local data
        }
      }

      if (!active) return;
      hydratedSessionsOwnerRef.current = ownerUserId ?? "guest";
      await saveLocalChatSessions(ownerUserId, useChatStore.getState().sessions);
    };

    void hydrateFromStorage();

    return () => {
      active = false;
    };
  }, [cloudBackupActive, hydrateSessions, ownerUserId, sessionStatus]);

  useEffect(() => {
    if (hydratedSessionsOwnerRef.current !== (ownerUserId ?? "guest")) return;
    void saveLocalChatSessions(ownerUserId, sessions);
  }, [ownerUserId, sessions]);

  useEffect(() => {
    const chatId = searchParams.get("chatId");
    if (!chatId) return;

    const title = searchParams.get("title") || "新对话";
    const roleId = searchParams.get("roleId") || undefined;
    const exists = useChatStore.getState().sessions.some((session) => session.id === chatId);
    if (!exists) {
      upsertSession({
        id: chatId,
        title,
        createdAt: Date.now(),
        roleId,
      });
    }

    setCurrentSessionId(chatId);
  }, [searchParams, setCurrentSessionId, upsertSession]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!currentSessionId) {
      loadedSessionRef.current = null;
      setMessages([]);
      return;
    }

    if (loadedSessionRef.current === currentSessionId) return;
    loadedSessionRef.current = currentSessionId;

    setMessages([]);
    setHistoryLoading(true);

    let active = true;
    const loadHistory = async () => {
      const localHistory = await loadLocalChatMessages(ownerUserId, currentSessionId);
      if (!active) return;

      if (localHistory.length > 0) {
        setMessages(localHistory);
      }

      if (cloudBackupActive) {
        try {
          const res = await fetch(`/api/chat/${currentSessionId}`);
          if (res.ok) {
            const data = await res.json();
            const history = Array.isArray(data?.data) ? data.data : [];
            if (active) {
              setMessages(history);
            }
            await saveLocalChatMessages(ownerUserId, currentSessionId, history);
          }
        } catch {
          // ignore cloud pull failures, keep local history
        }
      }

      if (!active) return;
      setHistoryLoading(false);
    };

    void loadHistory();
    return () => {
      active = false;
    };
  }, [cloudBackupActive, currentSessionId, ownerUserId, sessionStatus]);

  useEffect(() => {
    if (historyLoading) return;
    const container = messageScrollRef.current;
    if (!container) return;

    if (currentSessionId) {
      const savedTop = readStoredScrollTop(currentSessionId);
      let frameCount = 0;

      const restoreScroll = () => {
        const current = messageScrollRef.current;
        if (!current) return;

        const maxTop = Math.max(0, current.scrollHeight - current.clientHeight);
        const targetTop =
          savedTop !== null && savedTop > 8 ? Math.min(maxTop, savedTop) : maxTop;
        current.scrollTop = targetTop;
        updateBottomState(current);

        frameCount += 1;
        if (frameCount < 6) {
          window.requestAnimationFrame(restoreScroll);
        }
      };

      window.requestAnimationFrame(restoreScroll);
      return;
    }

    window.requestAnimationFrame(() => {
      const current = messageScrollRef.current;
      if (!current) return;
      current.scrollTop = current.scrollHeight;
      updateBottomState(current);
    });
  }, [currentSessionId, historyLoading, scrollOwnerKey]);

  useEffect(() => {
    if (historyLoading) return;
    if (!nearBottomRef.current) return;

    window.requestAnimationFrame(() => {
      const current = messageScrollRef.current;
      if (!current) return;
      current.scrollTop = current.scrollHeight;
      updateBottomState(current);
    });
  }, [historyLoading, messages.length]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!currentSessionId) return;
    if (historyLoading) return;

    const chatId = currentSessionId;
    const owner = ownerUserId;
    const snapshot = toLocalMessages(messages);

    if (saveMessagesTimerRef.current) {
      window.clearTimeout(saveMessagesTimerRef.current);
    }

    saveMessagesTimerRef.current = window.setTimeout(() => {
      void saveLocalChatMessages(owner, chatId, snapshot);
      saveMessagesTimerRef.current = null;
    }, 120);

    return () => {
      if (saveMessagesTimerRef.current) {
        window.clearTimeout(saveMessagesTimerRef.current);
        saveMessagesTimerRef.current = null;
      }
      void saveLocalChatMessages(owner, chatId, snapshot);
    };
  }, [currentSessionId, historyLoading, messages, ownerUserId, sessionStatus]);

  const isEmpty = messages.length === 0;

  return (
    <div className="relative flex h-full min-h-0 flex-col px-2 py-2 lg:px-3">
      <AnnouncementBanner />
      {loginBonusToast && (
        <div className="pointer-events-none fixed left-3 top-[calc(env(safe-area-inset-top)+8px)] z-[330] max-w-[calc(100vw-24px)] rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 shadow-sm lg:left-[250px] lg:top-3">
          {loginBonusToast}
        </div>
      )}
      <div className="mx-auto flex h-full w-full max-w-[940px] min-h-0 flex-1 flex-col">
        <div className="sticky top-0 z-[120] mb-2 border-b border-slate-200 bg-white/95 px-1 pb-2 pt-1 backdrop-blur lg:px-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <ModelSelector />
            </div>
            {billing && (
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] text-slate-500 sm:gap-2 sm:px-2.5 sm:text-[11px]">
                <span>点数 {billing.points ?? 0}</span>
                {billing.vip.active && (
                  <span className="text-violet-600">VIP余量 {billing.vip.monthlyRemaining}</span>
                )}
                <span
                  className={`hidden lg:inline ${cloudBackupActive ? "text-emerald-600" : "text-slate-400"}`}
                >
                  {cloudBackupActive ? "云备份：已开启" : "云备份：本地模式"}
                </span>
              </div>
            )}
          </div>
        </div>

        <div
          ref={messageScrollRef}
          onScroll={(event) => {
            const container = event.currentTarget;
            updateBottomState(container, { showOnDownScroll: true });
            if (currentSessionId) {
              writeStoredScrollTop(currentSessionId, container.scrollTop);
            }
          }}
          className="min-h-0 flex-1 overflow-y-auto px-1 py-1.5"
        >
          {historyLoading && (
            <div className="mb-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              {"正在加载历史记录..."}
            </div>
          )}

          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="text-2xl font-semibold text-slate-900">{"我是 AI 助手"}</div>
              <div className="mt-3 text-sm text-slate-500">
                {"请输入问题，或点击下方快捷功能开始对话。"}
              </div>
            </div>
          ) : (
            <ChatList
              messages={messages}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onRegenerateMessage={(index) => {
                void handleRegenerateMessage(index);
              }}
              onInfoMessage={openMessageInfo}
            />
          )}
        </div>

        <div className="mt-2">
          {isEmpty && (
            <QuickActions
              onSelect={(prompt) => {
                setInput(prompt);
              }}
            />
          )}
        </div>

        <div className="mt-2">
          {billingHint && (
            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {billingHint}
            </div>
          )}
          <ChatInput
            input={input}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>

        {messageInfo && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/35 px-4 py-6">
            <button
              type="button"
              aria-label="关闭消息详情"
              className="absolute inset-0"
              onClick={closeMessageInfo}
            />
            <div
              className="relative w-full max-w-[560px] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_40px_rgba(15,23,42,0.24)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="text-base font-semibold text-slate-900">消息详情</div>
                <button
                  type="button"
                  onClick={closeMessageInfo}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
                >
                  关闭
                </button>
              </div>

              <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                <div>
                  角色：
                  {messageInfo.role === "assistant"
                    ? "AI"
                    : messageInfo.role === "user"
                      ? "用户"
                      : messageInfo.role}
                </div>
                <div>序号：{(messageInfoIndex ?? 0) + 1}</div>
                <div>字符数：{messageInfo.content.length}</div>
                <div>
                  行数：
                  {messageInfo.content.length > 0
                    ? messageInfo.content.split(/\r?\n/).length
                    : 0}
                </div>
                <div className="sm:col-span-2">消息 ID：{messageInfo.id ?? "--"}</div>
              </div>

              <div className="mt-3">
                <div className="mb-1 text-xs text-slate-500">内容预览</div>
                <pre className="max-h-[280px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-700">
                  {messageInfo.content || "(empty)"}
                </pre>
              </div>
            </div>
          </div>
        )}

        {showScrollToBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+112px)] right-2.5 z-[180] flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 bg-blue-50/95 text-blue-700 shadow-sm backdrop-blur transition hover:bg-blue-100 lg:bottom-6"
            aria-label="回到底部"
            title="回到底部"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
              <path
                d="m6 9 6 6 6-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function PublicHomePageFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm">
        {"正在加载页面..."}
      </div>
    </div>
  );
}

export default function PublicHomePage() {
  return (
    <Suspense fallback={<PublicHomePageFallback />}>
      <PublicHomePageContent />
    </Suspense>
  );
}
