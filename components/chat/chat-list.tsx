"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

type ChatMessage = {
  id?: string;
  role: string;
  content: string;
};

type ChatListProps = {
  messages: ChatMessage[];
  onEditMessage?: (index: number) => void;
  onDeleteMessage?: (index: number) => void;
  onRegenerateMessage?: (index: number) => void;
  onInfoMessage?: (index: number) => void;
};

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <rect
        x="9"
        y="9"
        width="10"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="5"
        y="5"
        width="10"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
        opacity="0.75"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M4 17.5V20h2.5L18 8.5 15.5 6 4 17.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="m14.8 6.2 2.5 2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M5 7h14" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 7V5h6v2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 7v12h8V7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M11 10.5v5.5M13 10.5v5.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 5v5h-5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7.3" r="1.1" fill="currentColor" />
    </svg>
  );
}

async function copyText(content: string) {
  if (typeof navigator === "undefined") return false;

  const fallbackCopy = () => {
    if (typeof document === "undefined") return false;
    const textarea = document.createElement("textarea");
    textarea.value = content;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }

    document.body.removeChild(textarea);
    return copied;
  };

  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return true;
    }
  } catch {
    // fallback for HTTP pages or permission-restricted browsers
  }

  return fallbackCopy();
}

export default function ChatList({
  messages,
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage,
  onInfoMessage,
}: ChatListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const [copiedRowKey, setCopiedRowKey] = useState<string | null>(null);

  const activateRow = (rowKey: string) => {
    setActiveRowKey(rowKey);
  };

  useEffect(() => {
    if (!copiedRowKey) return;
    const timer = window.setTimeout(() => setCopiedRowKey(null), 1400);
    return () => window.clearTimeout(timer);
  }, [copiedRowKey]);

  useEffect(() => {
    const closeActions = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      setActiveRowKey(null);
    };

    document.addEventListener("mousedown", closeActions);
    document.addEventListener("touchstart", closeActions);

    return () => {
      document.removeEventListener("mousedown", closeActions);
      document.removeEventListener("touchstart", closeActions);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-3 pb-1"
      onMouseLeave={() => setActiveRowKey(null)}
    >
      {messages.map((message, index) => {
        const isUser = message.role === "user";
        const isAssistant = message.role === "assistant";
        const canRetry = message.role === "assistant" || message.role === "user";
        const rowKey = message.id ?? `msg_${index}`;
        const showActions = activeRowKey === rowKey;

        return (
          <div
            key={rowKey}
            className={`group flex py-1.5 ${isUser ? "justify-end" : "justify-start"}`}
            onMouseEnter={() => activateRow(rowKey)}
            onTouchStart={() => activateRow(rowKey)}
          >
            <div
              className={`flex max-w-[86%] items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full border ${
                  isUser
                      ? "border-slate-200 bg-white text-sm text-slate-700"
                      : "border-blue-200 bg-blue-600 text-[10px] text-white"
                }`}
              >
                {isUser ? "我" : "AI"}
              </div>

              <div
                className={`min-w-0 ${isUser ? "flex flex-col items-end" : "flex flex-col items-start"}`}
              >
                <div
                  className={`inline-block max-w-full rounded-2xl px-3 py-2 text-[14px] leading-6 ${
                    isUser ? "bg-blue-100/70 text-slate-800" : "bg-slate-50 text-slate-700"
                  }`}
                >
                  {isAssistant ? (
                    <div className="markdown-body">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
                        components={{
                          pre: (props) => (
                            <pre
                              {...props}
                              className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3"
                            />
                          ),
                          code: ({ className, children, ...props }) => {
                            const inline = !className;
                            if (inline) {
                              return (
                                <code
                                  {...props}
                                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em]"
                                >
                                  {children}
                                </code>
                              );
                            }
                            return (
                              <code {...props} className={className}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  )}
                </div>

                <div className={`pt-1 ${isUser ? "flex justify-end" : "flex justify-start"}`}>
                  <div
                    className={`relative z-20 inline-flex items-center gap-1 text-slate-400 transition-all duration-150 ${
                      showActions
                        ? "translate-y-0 opacity-100"
                        : "pointer-events-none -translate-y-0.5 opacity-0"
                    }`}
                    onMouseEnter={() => activateRow(rowKey)}
                    onTouchStart={(event) => {
                      event.stopPropagation();
                      activateRow(rowKey);
                    }}
                  >
                    <button
                      type="button"
                      onClick={async (event) => {
                        event.stopPropagation();
                        const ok = await copyText(message.content);
                        if (ok) setCopiedRowKey(rowKey);
                      }}
                      className={`flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-slate-100 hover:text-slate-600 ${
                        copiedRowKey === rowKey ? "text-blue-600" : ""
                      }`}
                      aria-label="复制"
                      title={copiedRowKey === rowKey ? "已复制" : "复制"}
                    >
                      <CopyIcon />
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditMessage?.(index);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-slate-100 hover:text-slate-600"
                      aria-label="修改"
                      title="修改"
                    >
                      <EditIcon />
                    </button>

                    {canRetry && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRegenerateMessage?.(index);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label="重新生成"
                        title="重新生成"
                      >
                        <RetryIcon />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onInfoMessage?.(index);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-slate-100 hover:text-slate-600"
                      aria-label="详情"
                      title="详情"
                    >
                      <InfoIcon />
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteMessage?.(index);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-slate-100 hover:text-red-500"
                      aria-label="删除"
                      title="删除"
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
