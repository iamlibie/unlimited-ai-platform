"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { APP_NAME } from "@/app/config/branding";
import { useChatStore } from "@/store/chat-store";

const titleMap: Record<string, string> = {
  "/": "\u804a\u5929",
  "/extensions": "\u5bf9\u8bdd\u62d3\u5c55\u5e93",
  "/api-center": "\u81ea\u5b9a\u4e49 API \u4e2d\u5fc3",
  "/billing": "\u8ba1\u8d39\u4e2d\u5fc3",
  "/market": "\u89d2\u8272\u5361\u5546\u57ce",
  "/tips": "\u4f7f\u7528\u6280\u5de7",
  "/more": "\u66f4\u591a",
};

type BillingMini = {
  points: number;
  vip: {
    active: boolean;
    monthlyRemaining: number;
  };
};

export default function MobileTopbar() {
  const pathname = usePathname();
  const setSidebarOpen = useChatStore((state) => state.setSidebarOpen);
  const { data: session, status } = useSession();
  const [billing, setBilling] = useState<BillingMini | null>(null);

  const title = useMemo(() => titleMap[pathname] ?? APP_NAME, [pathname]);

  useEffect(() => {
    if (status === "loading") return;

    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      setBilling(null);
      return;
    }

    let active = true;
    const refreshBilling = () => {
      fetch("/api/public/billing?peek=1", { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error("billing_unavailable");
          }
          return res.json();
        })
        .then((json) => {
          if (!active) return;
          const payload = json?.data;
          if (!payload) return;
          setBilling({
            points: Math.max(0, Number(payload.points ?? 0)),
            vip: {
              active: Boolean(payload?.vip?.active),
              monthlyRemaining: Math.max(0, Number(payload?.vip?.monthlyRemaining ?? 0)),
            },
          });
        })
        .catch(() => {
          if (active) {
            setBilling(null);
          }
        });
    };

    refreshBilling();
    const timer = window.setInterval(refreshBilling, 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [session, status, pathname]);

  return (
    <div className="sticky top-0 z-30 flex h-11 items-center gap-2 border-b border-slate-200 bg-white/95 px-2 backdrop-blur lg:hidden">
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
      >
        {"\u83dc\u5355"}
      </button>
      <div className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{title}</div>
      {billing && (
        <div className="flex items-center gap-1">
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
            {"\u70b9\u6570"} {billing.points}
          </span>
          {billing.vip.active && (
            <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">
              VIP {billing.vip.monthlyRemaining}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
