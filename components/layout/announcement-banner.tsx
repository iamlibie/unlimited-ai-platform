"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type AnnouncementData = {
  title: string;
  content: string;
  updatedAt: string;
};

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDismissKey(announcement: AnnouncementData) {
  return `announcement:dismiss:${getTodayKey()}:${announcement.updatedAt}`;
}

export default function AnnouncementBanner() {
  const [mounted, setMounted] = useState(false);
  const [announcement, setAnnouncement] = useState<AnnouncementData | null>(null);
  const [hiddenBySession, setHiddenBySession] = useState(false);
  const [hiddenToday, setHiddenToday] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;

    fetch("/api/public/announcement", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        const data = json?.data;
        if (!data || typeof data?.content !== "string" || !data.content.trim()) {
          setAnnouncement(null);
          return;
        }
        setAnnouncement({
          title: typeof data?.title === "string" ? data.title : "平台公告",
          content: data.content,
          updatedAt:
            typeof data?.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
        });
      })
      .catch(() => {
        if (active) {
          setAnnouncement(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!announcement || typeof window === "undefined") return;
    const saved = window.localStorage.getItem(buildDismissKey(announcement));
    setHiddenToday(saved === "1");
  }, [announcement]);

  const visible = useMemo(
    () => Boolean(announcement && !hiddenBySession && !hiddenToday),
    [announcement, hiddenBySession, hiddenToday],
  );

  if (!mounted || !visible || !announcement) return null;

  return createPortal(
    <div className="fixed inset-0 z-[360] flex items-start justify-center p-4 pt-[max(56px,env(safe-area-inset-top)+16px)]">
      <button
        type="button"
        aria-label="关闭公告弹窗"
        onClick={() => setHiddenBySession(true)}
        className="absolute inset-0 bg-black/25"
      />
      <div className="relative w-full max-w-[460px] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.25)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-800">
              {announcement.title || "平台公告"}
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {announcement.content}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHiddenBySession(true)}
            className="rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100"
          >
            关闭
          </button>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.localStorage.setItem(buildDismissKey(announcement), "1");
              }
              setHiddenToday(true);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
          >
            今日不再提醒
          </button>
          <button
            type="button"
            onClick={() => setHiddenBySession(true)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
