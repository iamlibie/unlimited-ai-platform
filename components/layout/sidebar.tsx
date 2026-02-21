"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

import { APP_LOGO_TEXT, APP_NAME } from "@/app/config/branding";
import { deleteLocalChatSession } from "@/lib/local-chat-db";
import { type ChatSession, useChatStore } from "@/store/chat-store";

type IconName =
  | "logo"
  | "chat"
  | "extensions"
  | "api"
  | "billing"
  | "market"
  | "tips"
  | "more"
  | "recent"
  | "new"
  | "fold";

type MainNavItem = {
  label: string;
  href: string;
  icon: IconName;
  badge?: string;
};

const mainNavItems: MainNavItem[] = [
  { label: "\u804a\u5929", href: "/", icon: "chat" },
  {
    label: "\u5bf9\u8bdd\u62d3\u5c55\u5e93",
    href: "/extensions",
    icon: "extensions",
    badge: "NEW",
  },
  {
    label: "\u81ea\u5b9a\u4e49 API \u4e2d\u5fc3",
    href: "/api-center",
    icon: "api",
    badge: "\u514d\u8d39",
  },
  { label: "\u8ba1\u8d39\u4e2d\u5fc3", href: "/billing", icon: "billing" },
  { label: "\u89d2\u8272\u5361\u5546\u57ce", href: "/market", icon: "market" },
  { label: "\u4f7f\u7528\u6280\u5de7\u4e0e\u8bf4\u660e", href: "/tips", icon: "tips" },
  { label: "\u66f4\u591a", href: "/more", icon: "more" },
];

function IconGlyph({ name }: { name: IconName }) {
  if (name === "logo") {
    return <span className="text-sm leading-none">{APP_LOGO_TEXT}</span>;
  }

  if (name === "fold") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M15 6 9 12l6 6" />
      </svg>
    );
  }

  if (name === "new") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M12 5v8" />
        <path d="M8 9h8" />
      </svg>
    );
  }

  if (name === "chat") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M6 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-5l-4 3v-3H8a2 2 0 0 1-2-2V8Z" />
      </svg>
    );
  }

  if (name === "extensions") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <rect x="6" y="4" width="12" height="16" rx="2" />
        <path d="M9 8h6" />
        <path d="M9 12h6" />
      </svg>
    );
  }

  if (name === "api") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M12 4l1.9 4.1L18 10l-4.1 1.9L12 16l-1.9-4.1L6 10l4.1-1.9L12 4Z" />
      </svg>
    );
  }

  if (name === "market") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M4 10h16" />
        <path d="M6 10v9h12v-9" />
        <path d="M4.5 10 6.5 5h11l2 5" />
      </svg>
    );
  }

  if (name === "billing") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
        <path d="M4 10h16" />
        <path d="M8 15h4" />
      </svg>
    );
  }

  if (name === "tips") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <rect x="7" y="4" width="10" height="16" rx="2" />
        <path d="M10 17h4" />
      </svg>
    );
  }

  if (name === "recent") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M6 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-5l-4 3v-3H8a2 2 0 0 1-2-2V8Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </svg>
  );
}

function buildChatHref(chat: ChatSession) {
  const params = new URLSearchParams({ chatId: chat.id });
  if (chat.roleId) {
    params.set("roleId", chat.roleId);
  }
  return `/?${params.toString()}`;
}

function resolveSessionTitle(chat: ChatSession, fallbackIndex: number) {
  const title = chat.title?.trim() ?? "";
  if (!title || /^\?{2,}/.test(title)) {
    return `\u65b0\u5bf9\u8bdd ${fallbackIndex}`;
  }
  return title;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarOpen = useChatStore((state) => state.sidebarOpen);
  const sidebarCollapsed = useChatStore((state) => state.sidebarCollapsed);
  const sessions = useChatStore((state) => state.sessions);
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const setCurrentSessionId = useChatStore((state) => state.setCurrentSessionId);
  const setSidebarOpen = useChatStore((state) => state.setSidebarOpen);
  const toggleSidebarCollapsed = useChatStore((state) => state.toggleSidebarCollapsed);
  const createSession = useChatStore((state) => state.createSession);
  const deleteSession = useChatStore((state) => state.deleteSession);
  const syncSessionOwner = useChatStore((state) => state.syncSessionOwner);
  const cloudBackupEnabled = useChatStore((state) => state.cloudBackupEnabled);
  const setCloudBackupEnabled = useChatStore((state) => state.setCloudBackupEnabled);
  const { data: session, status: sessionStatus } = useSession();
  const [vipActive, setVipActive] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const cloudBackupActive = Boolean(sessionUserId && vipActive && cloudBackupEnabled);
  const cloudBackupDisplayEnabled = Boolean(
    sessionUserId && cloudBackupEnabled && (vipActive || billingLoading),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [setSidebarOpen]);

  const userName = session?.user?.name || "\u672a\u767b\u5f55";
  const userEmail = session?.user?.email || "";
  const avatar = session?.user?.image || "";
  const [isAdmin, setIsAdmin] = useState(false);
  const initial = (session?.user?.name || session?.user?.email || "U")
    .slice(0, 1)
    .toUpperCase();

  useEffect(() => {
    let active = true;

    if (sessionStatus === "loading") {
      return () => {
        active = false;
      };
    }

    if (!sessionUserId) {
      setVipActive(false);
      setBillingLoading(false);
      return () => {
        active = false;
      };
    }

    setBillingLoading(true);
    fetch("/api/public/billing?peek=1", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("billing_unavailable");
        }
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        const enabled = Boolean(json?.data?.vip?.active);
        setVipActive(enabled);
      })
      .catch(() => {
        if (!active) return;
        // Keep previous state on transient request failures.
      })
      .finally(() => {
        if (active) {
          setBillingLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [sessionStatus, sessionUserId]);

  useEffect(() => {
    let active = true;

    if (sessionStatus === "loading") {
      return () => {
        active = false;
      };
    }

    if (!sessionUserId) {
      setIsAdmin(false);
      return () => {
        active = false;
      };
    }

    fetch("/api/admin/access", { cache: "no-store" })
      .then((res) => res.json().catch(() => null))
      .then((json) => {
        if (!active) return;
        setIsAdmin(Boolean(json?.data?.isAdmin));
      })
      .catch(() => {
        if (active) setIsAdmin(false);
      });

    return () => {
      active = false;
    };
  }, [sessionStatus, sessionUserId]);

  async function handleDeleteSession(chat: ChatSession) {
    if (!window.confirm("\u786e\u8ba4\u5220\u9664\u8fd9\u4e2a\u4f1a\u8bdd\uff1f")) return;

    deleteSession(chat.id);
    try {
      await deleteLocalChatSession(sessionUserId, chat.id);
    } catch {
      // ignore local cleanup errors and keep UI responsive
    }
    if (cloudBackupActive) {
      try {
        await fetch(`/api/chat/${chat.id}`, { method: "DELETE" });
      } catch {
        // keep local state when network request fails
      }
    }
    if (currentSessionId === chat.id) {
      router.replace("/");
    }
  }

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[340] bg-slate-900/25 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-[350] flex h-screen min-h-0 w-[228px] flex-col overflow-hidden border-r border-slate-200 bg-blue-50 px-2 py-2 shadow-sm transition-transform lg:static lg:translate-x-0 ${
          sidebarCollapsed ? "lg:w-[64px]" : "lg:w-[228px]"
        } ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className={`mb-2 flex items-center ${sidebarCollapsed ? "justify-between lg:justify-center" : "justify-between"}`}>
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-[9px] font-semibold text-white">
              <IconGlyph name="logo" />
            </div>
            <div className={`truncate text-[13px] font-semibold text-slate-800 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
              {APP_NAME}
            </div>
          </Link>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              className={`hidden rounded-md border border-slate-200 bg-white p-1 text-slate-500 transition hover:text-blue-600 lg:inline-flex ${
                sidebarCollapsed ? "rotate-180" : ""
              }`}
              title={sidebarCollapsed ? "\u5c55\u5f00\u4fa7\u8fb9\u680f" : "\u6536\u8d77\u4fa7\u8fb9\u680f"}
            >
              <IconGlyph name="fold" />
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 lg:hidden"
            >
              {"\u5173\u95ed"}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const id = createSession();
            router.push(`/?chatId=${id}`);
            setSidebarOpen(false);
          }}
          className={`flex items-center rounded-xl border border-blue-200 bg-white text-blue-700 transition hover:bg-blue-50 ${
            sidebarCollapsed ? "justify-center p-2 lg:px-0" : "justify-between px-2 py-1.5"
          }`}
          title={"\u65b0\u5bf9\u8bdd"}
        >
          <span className="flex items-center gap-2 text-[13px] font-medium">
            <IconGlyph name="new" />
            <span className={sidebarCollapsed ? "lg:hidden" : ""}>{"\u65b0\u5bf9\u8bdd"}</span>
          </span>
          <span className={`rounded-md border border-blue-200 px-1.5 py-0.5 text-[10px] text-blue-400 ${
            sidebarCollapsed ? "hidden" : ""
          }`}>
            Ctrl K
          </span>
        </button>

        <div className="mt-2 space-y-1">
          {mainNavItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-[13px] transition ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-white"
                } ${sidebarCollapsed ? "lg:justify-center" : ""}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/20">
                  <IconGlyph name={item.icon} />
                </span>
                <span className={`truncate ${sidebarCollapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                {item.badge && (
                  <span
                    className={`ml-auto rounded-md px-1.5 py-0.5 text-[10px] ${
                      active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
                    } ${sidebarCollapsed ? "hidden" : ""}`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              title={"\u540e\u53f0\u7ba1\u7406"}
              className={`flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2 py-1.5 text-[13px] text-amber-700 transition hover:bg-amber-100 ${
                sidebarCollapsed ? "lg:justify-center" : ""
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="text-xs">A</span>
              <span className={sidebarCollapsed ? "lg:hidden" : ""}>{"\u540e\u53f0\u7ba1\u7406"}</span>
            </Link>
          )}
        </div>

        <div className={`mt-2 flex min-h-0 flex-1 flex-col border-t border-slate-200 pt-2 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <IconGlyph name="recent" />
            {"\u6700\u8fd1\u4f1a\u8bdd"}
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {sessions.length === 0 && (
              <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-400">
                {"\u6682\u65e0\u4f1a\u8bdd"}
              </div>
            )}

            {sessions.map((chat, index) => {
              const active = currentSessionId === chat.id;
              const sessionTitle = resolveSessionTitle(chat, sessions.length - index);
              return (
                <div
                  key={chat.id}
                  className={`flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs transition ${
                    active ? "bg-blue-100 text-blue-700" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentSessionId(chat.id);
                      router.push(buildChatHref(chat));
                      setSidebarOpen(false);
                    }}
                    className="min-w-0 flex-1 truncate text-left"
                    title={sessionTitle}
                  >
                    {sessionTitle}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDeleteSession(chat);
                    }}
                    className="rounded px-1 text-slate-300 transition hover:bg-slate-200 hover:text-red-500"
                    title={"\u5220\u9664\u4f1a\u8bdd"}
                  >
                    x
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-2 shrink-0 border-t border-slate-200 pt-2">
          <div
            className={`relative flex items-center gap-2 rounded-xl bg-white px-2 py-1.5 ${sidebarCollapsed ? "lg:justify-center lg:px-0" : ""}`}
          >
            {avatar ? (
              <img
                src={avatar}
                alt={userName}
                className="h-7 w-7 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-600">
                {initial}
              </div>
            )}
            <div className={`min-w-0 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
              <div className="truncate text-xs font-medium text-slate-700">{userName}</div>
              <div className="truncate text-[11px] text-slate-500">{userEmail || "\u672a\u767b\u5f55"}</div>
            </div>
            {vipActive && (
              <span className="absolute -right-1 -top-1 inline-flex items-center justify-center rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-amber-700 shadow-sm">
                VIP
              </span>
            )}
          </div>

          <div className={`mt-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-slate-600">
                {"\u804a\u5929\u8bb0\u5f55\u5b58\u50a8"}
              </div>
              <button
                type="button"
                disabled={!sessionUserId || !vipActive || billingLoading}
                onClick={() => setCloudBackupEnabled(!cloudBackupEnabled)}
                className={`rounded-md px-2 py-0.5 text-[11px] ${
                  cloudBackupDisplayEnabled
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {cloudBackupDisplayEnabled ? "\u4e91\u7aef" : "\u672c\u5730"}
              </button>
            </div>
            <div className="mt-1 text-[11px] leading-5 text-slate-400">
              {!sessionUserId
                ? "\u9ed8\u8ba4\u4ec5\u4fdd\u5b58\u5728\u5f53\u524d\u6d4f\u89c8\u5668\uff0c\u767b\u5f55\u540e\u53ef\u9009\u62e9\u4e91\u7aef\u5907\u4efd\u3002"
                : billingLoading
                  ? cloudBackupEnabled
                    ? "\u6b63\u5728\u68c0\u67e5 VIP \u72b6\u6001\uff0c\u5f53\u524d\u504f\u597d\uff1a\u4e91\u7aef\u5907\u4efd\u3002"
                    : "\u6b63\u5728\u68c0\u67e5 VIP \u72b6\u6001..."
                  : vipActive
                    ? cloudBackupEnabled
                      ? "\u5f53\u524d\u4e3a\u4e91\u7aef\u5907\u4efd\uff08\u540c\u65f6\u4fdd\u7559\u672c\u5730\u526f\u672c\uff0c\u53ef\u8de8\u8bbe\u5907\u540c\u6b65\uff09\u3002"
                      : "\u5f53\u524d\u4e3a\u672c\u5730\u6a21\u5f0f\uff08\u9ed8\u8ba4\uff09\uff0c\u53ef\u968f\u65f6\u5207\u6362\u5230\u4e91\u7aef\u5907\u4efd\u3002"
                    : "\u5f53\u524d\u4ec5\u672c\u5730\u4fdd\u5b58\uff0c\u4e91\u7aef\u5907\u4efd\u4e3a VIP \u529f\u80fd\u3002"}
            </div>
          </div>

          {session?.user ? (
            <button
              type="button"
              onClick={async () => {
                syncSessionOwner(null);
                const callbackUrl =
                  typeof window !== "undefined" ? `${window.location.origin}/` : "/";
                await signOut({ redirect: false, callbackUrl });
                if (typeof window !== "undefined") {
                  window.location.assign("/");
                  return;
                }
                router.replace("/");
              }}
              className={`mt-2 w-full rounded-lg border border-slate-200 bg-white py-1.5 text-xs text-slate-600 transition hover:border-blue-300 hover:text-blue-600 ${
                sidebarCollapsed ? "lg:px-0" : ""
              }`}
              title={"\u9000\u51fa\u767b\u5f55"}
            >
              <span className={sidebarCollapsed ? "lg:hidden" : ""}>{"\u9000\u51fa\u767b\u5f55"}</span>
              <span className={`hidden ${sidebarCollapsed ? "lg:inline" : ""}`}>{"\u9000"}</span>
            </button>
          ) : (
            <Link
              href="/auth/login"
              className={`mt-2 block w-full rounded-lg border border-slate-200 bg-white py-1.5 text-center text-xs text-slate-600 transition hover:border-blue-300 hover:text-blue-600 ${
                sidebarCollapsed ? "lg:px-0" : ""
              }`}
            >
              <span className={sidebarCollapsed ? "lg:hidden" : ""}>{"\u53bb\u767b\u5f55"}</span>
              <span className={`hidden ${sidebarCollapsed ? "lg:inline" : ""}`}>{"\u767b"}</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
