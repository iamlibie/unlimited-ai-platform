"use client";

import { useEffect, useMemo, useState } from "react";

import { useChatStore } from "@/store/chat-store";

type Extension = {
  id: string;
  name: string;
  description: string;
  prompt: string;
};

const folderTemplates = [
  { key: "all", label: "\u5168\u90e8\u63d0\u793a\u8bcd" },
  { key: "ai-generated", label: "AI \u751f\u6210\u6269\u5c55" },
  { key: "basic", label: "\u901a\u7528 \u00b7 \u57fa\u7840\u589e\u5f3a" },
  { key: "html", label: "\u89c6\u89c9 \u00b7 HTML \u6a21\u677f" },
] as const;

type FolderKey = (typeof folderTemplates)[number]["key"];

function belongsToFolder(extension: Extension, folder: FolderKey) {
  const text = `${extension.name} ${extension.description} ${extension.prompt}`.toLowerCase();
  if (folder === "all") return true;
  if (folder === "ai-generated") return /(ai|generate|draft|rewrite|image|create|agent)/.test(text);
  if (folder === "basic") return /(base|basic|summary|long|enhance|no preach|prompt)/.test(text);
  if (folder === "html") return /(html|template|markdown|table|css|web)/.test(text);
  return true;
}

export default function ExtensionsPage() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [activeFolder, setActiveFolder] = useState<FolderKey>("all");

  const enabledExtensions = useChatStore((state) => state.enabledExtensions);
  const toggleExtension = useChatStore((state) => state.toggleExtension);

  useEffect(() => {
    let active = true;
    fetch("/api/public/extensions")
      .then((res) => res.json())
      .then((data) => {
        if (active && Array.isArray(data?.data)) {
          setExtensions(data.data);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredExtensions = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return extensions.filter((item) => {
      if (!belongsToFolder(item, activeFolder)) return false;
      if (!normalized) return true;
      return (
        item.name.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized) ||
        item.prompt.toLowerCase().includes(normalized)
      );
    });
  }, [activeFolder, extensions, keyword]);

  const folderCounts = useMemo(() => {
    return folderTemplates.reduce<Record<FolderKey, number>>((acc, folder) => {
      acc[folder.key] = extensions.filter((item) => belongsToFolder(item, folder.key)).length;
      return acc;
    }, { all: 0, "ai-generated": 0, basic: 0, html: 0 });
  }, [extensions]);

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-xs font-semibold text-blue-700 shadow-sm">
            EX
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {"\u5bf9\u8bdd\u62d3\u5c55\u5e93"}
          </h1>
        </div>
        <button
          type="button"
          className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-[0_8px_18px_rgba(41,69,87,0.22)]"
        >
          {"+ \u65b0\u5efa\u6269\u5c55"}
        </button>
      </div>

      <div className="grid min-h-[calc(100vh-210px)] grid-cols-1 gap-4 xl:grid-cols-[300px,1fr]">
        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={"\u641c\u7d22\u6269\u5c55..."}
              className="w-full border-none bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-2">
            {folderTemplates.map((folder) => (
              <button
                key={folder.key}
                type="button"
                onClick={() => setActiveFolder(folder.key)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                  activeFolder === folder.key
                    ? "bg-blue-100 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{folder.label}</span>
                {folder.key !== "all" && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-500">
                    {folderCounts[folder.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-7 text-sm text-slate-500">
              {"\u6b63\u5728\u52a0\u8f7d\u6269\u5c55..."}
            </div>
          ) : filteredExtensions.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-7 text-sm text-slate-500">
              {"\u6ca1\u6709\u5339\u914d\u7684\u6269\u5c55"}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExtensions.map((extension) => {
                const enabled = enabledExtensions.includes(extension.id);
                return (
                  <div
                    key={extension.id}
                    className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)]"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleExtension(extension.id)}
                        className={`mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-full text-xs font-semibold transition ${
                          enabled
                            ? "bg-blue-100 text-blue-600"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        ON
                      </button>
                      <div className="min-w-0">
                        <div className="text-lg font-semibold text-slate-800">{extension.name}</div>
                        <div className="mt-1.5 text-xs text-slate-500">{extension.description}</div>
                        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-500">
                          {extension.prompt}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="ml-3 rounded-md px-2 py-1 text-base text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
                    >
                      Edit
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
