"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { useChatStore } from "@/store/chat-store";

type RoleItem = {
  id: string;
  name: string;
  author?: string | null;
  avatarUrl?: string | null;
  backgroundUrl?: string | null;
  description: string;
  prompt: string;
  category: string;
  isPublic: boolean;
  publicRequested?: boolean;
  reviewStatus?: "APPROVED" | "PENDING" | "REJECTED";
  createdAt?: string;
};

type CreateRoleForm = {
  name: string;
  category: string;
  description: string;
  prompt: string;
  visibility: "private" | "public";
  avatarUrl: string;
  backgroundUrl: string;
};

const FILTER_ALL_CATEGORY = "ALL";

const roleCategoryOptions = [
  "General",
  "Roleplay",
  "Companion",
  "Story",
  "Fantasy",
  "Game",
  "Coding",
  "NSFW",
];

const roleCategoryLabelMap: Record<string, string> = {
  General: "通用",
  Roleplay: "角色扮演",
  Companion: "陪伴聊天",
  Story: "剧情故事",
  Fantasy: "奇幻",
  Game: "游戏",
  Coding: "编程",
  NSFW: "NSFW",
};

const defaultForm: CreateRoleForm = {
  name: "",
  category: "General",
  description: "",
  prompt: "",
  visibility: "private",
  avatarUrl: "",
  backgroundUrl: "",
};

function reviewLabel(role: RoleItem) {
  if (role.isPublic && role.reviewStatus === "APPROVED") return "已公开";
  if (role.reviewStatus === "PENDING") return "审核中";
  if (role.reviewStatus === "REJECTED") return "已拒绝";
  return "私密";
}

export default function MarketPage() {
  const createSession = useChatStore((state) => state.createSession);
  const router = useRouter();
  const { data: session } = useSession();
  const isLoggedIn = Boolean(session?.user);

  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [mineRoles, setMineRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [category, setCategory] = useState(FILTER_ALL_CATEGORY);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [avatarFallbackIds, setAvatarFallbackIds] = useState<string[]>([]);
  const [backgroundFallbackIds, setBackgroundFallbackIds] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
  const [form, setForm] = useState<CreateRoleForm>(defaultForm);

  function startRoleChat(role: RoleItem) {
    const chatId = createSession({ title: role.name, roleId: role.id });
    router.push(`/?chatId=${chatId}&roleId=${role.id}`);
  }

  async function fetchPublicRoles() {
    const res = await fetch("/api/public/market", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    setRoles(Array.isArray(data?.data) ? data.data : []);
  }

  async function fetchMineRoles() {
    if (!isLoggedIn) {
      setMineRoles([]);
      return;
    }
    const res = await fetch("/api/public/market?mine=1", { cache: "no-store" });
    if (!res.ok) {
      setMineRoles([]);
      return;
    }
    const data = await res.json().catch(() => null);
    setMineRoles(Array.isArray(data?.data) ? data.data : []);
  }

  async function refreshAll() {
    setLoading(true);
    try {
      await Promise.all([fetchPublicRoles(), fetchMineRoles()]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
  }, [isLoggedIn]);

  const categoryOptions = useMemo(() => {
    const merged = new Set<string>(roleCategoryOptions);
    roles.forEach((role) => {
      const value = role.category?.trim();
      if (value) merged.add(value);
    });
    return [FILTER_ALL_CATEGORY, ...Array.from(merged)];
  }, [roles]);

  const filteredRoles = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    return roles.filter((role) => {
      if (category !== FILTER_ALL_CATEGORY && role.category !== category) return false;
      if (!keyword) return true;
      return (
        role.name.toLowerCase().includes(keyword) ||
        role.description.toLowerCase().includes(keyword)
      );
    });
  }, [roles, category, searchKeyword]);

  async function uploadImage(file: File, kind: "avatar" | "background") {
    if (kind === "avatar") {
      setUploadingAvatar(true);
    } else {
      setUploadingBackground(true);
    }
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const endpoint =
        kind === "avatar"
          ? "/api/public/market/avatar-upload"
          : "/api/public/market/background-upload";
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.error ||
            (kind === "avatar"
              ? "头像上传失败"
              : "背景图上传失败"),
        );
      }
      const url = typeof json?.data?.url === "string" ? json.data.url : "";
      if (!url) {
        throw new Error(
          kind === "avatar"
            ? "头像上传失败"
            : "背景图上传失败",
        );
      }
      setForm((prev) =>
        kind === "avatar" ? { ...prev, avatarUrl: url } : { ...prev, backgroundUrl: url },
      );
      setMessage(
        kind === "avatar"
          ? "头像上传成功"
          : "背景图上传成功",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : kind === "avatar"
            ? "头像上传失败"
            : "背景图上传失败",
      );
    } finally {
      if (kind === "avatar") {
        setUploadingAvatar(false);
      } else {
        setUploadingBackground(false);
      }
    }
  }

  async function submitRole() {
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || "General",
      description: form.description.trim(),
      prompt: form.prompt.trim(),
      visibility: form.visibility,
      avatarUrl: form.avatarUrl,
      backgroundUrl: form.backgroundUrl,
    };

    if (!payload.name || !payload.description || !payload.prompt) {
      setMessage("请填写角色名称、描述和 Prompt");
      return;
    }

    setSavingRole(true);
    setMessage(null);
    try {
      const res = await fetch("/api/public/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "提交失败");

      setMessage(
        json?.message ||
          (payload.visibility === "public"
            ? "已提交审核"
            : "已保存为私密角色卡"),
      );
      setForm(defaultForm);
      setShowCreatePanel(false);
      await refreshAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交失败");
    } finally {
      setSavingRole(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200 text-xs font-semibold text-slate-600">
            RM
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            角色卡商城
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCreatePanel((prev) => !prev)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
        >
          {showCreatePanel ? "收起上传面板" : "上传角色卡"}
        </button>
      </div>

      {showCreatePanel && (
        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          {!isLoggedIn ? (
            <div className="text-sm text-slate-500">请先登录</div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="角色名称"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:bg-white"
                />
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, category: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:bg-white"
                >
                  {roleCategoryOptions.map((item) => (
                    <option key={item} value={item}>
                      {roleCategoryLabelMap[item] ?? item}
                    </option>
                  ))}
                </select>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="角色描述"
                  rows={3}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:bg-white md:col-span-2"
                />
                <textarea
                  value={form.prompt}
                  onChange={(event) => setForm((prev) => ({ ...prev, prompt: event.target.value }))}
                  placeholder="角色 Prompt（仅对话时使用）"
                  rows={4}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:bg-white md:col-span-2"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-slate-600">可见性</label>
                <select
                  value={form.visibility}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      visibility: event.target.value as "private" | "public",
                    }))
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="private">私密（仅自己可见）</option>
                  <option value="public">申请公开（需管理员审核）</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-slate-600">头像</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadImage(file, "avatar");
                    }
                  }}
                  className="text-xs"
                />
                {form.avatarUrl && (
                  <img
                    src={form.avatarUrl}
                    alt="avatar preview"
                    className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                  />
                )}
                {uploadingAvatar && <span className="text-xs text-slate-500">上传中...</span>}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-slate-600">背景图</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadImage(file, "background");
                    }
                  }}
                  className="text-xs"
                />
                {form.backgroundUrl && (
                  <img
                    src={form.backgroundUrl}
                    alt="background preview"
                    className="h-12 w-24 rounded-md border border-slate-200 object-cover"
                  />
                )}
                {uploadingBackground && (
                  <span className="text-xs text-slate-500">上传中...</span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setForm(defaultForm);
                    setShowCreatePanel(false);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={submitRole}
                  disabled={savingRole}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingRole ? "提交中..." : "提交"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          placeholder="搜索角色名称或简介"
          className="h-10 min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-300"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-300"
        >
          {categoryOptions.map((item) => (
            <option key={item} value={item}>
              {item === FILTER_ALL_CATEGORY
                ? "全部分类"
                : roleCategoryLabelMap[item] ?? item}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-7 text-sm text-slate-500 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          正在加载角色...
        </div>
      ) : (
        <div className="grid justify-items-center gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredRoles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelectedRole(role)}
              className="w-full max-w-[220px] min-h-[332px] overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_12px_24px_rgba(59,130,246,0.14)]"
            >
              <div className="relative h-28 overflow-hidden">
                {role.backgroundUrl && !backgroundFallbackIds.includes(role.id) ? (
                  <img
                    src={role.backgroundUrl}
                    alt={`${role.name} background`}
                    className="h-full w-full object-cover"
                    onError={() => {
                      setBackgroundFallbackIds((prev) =>
                        prev.includes(role.id) ? prev : [...prev, role.id],
                      );
                    }}
                  />
                ) : (
                  <div className="h-full w-full bg-slate-100" />
                )}
                <div className="absolute inset-0 bg-blue-900/18" />
                <div className="absolute bottom-2 left-3">
                  <div className="h-10 w-10 rounded-full border-2 border-white bg-white shadow-sm">
                    {role.avatarUrl && !avatarFallbackIds.includes(role.id) ? (
                      <img
                        src={role.avatarUrl}
                        alt={role.name}
                        className="h-full w-full rounded-full object-cover"
                        onError={() => {
                          setAvatarFallbackIds((prev) =>
                            prev.includes(role.id) ? prev : [...prev, role.id],
                          );
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                        {role.name.slice(0, 1)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-3.5 pb-3.5 pt-3">
                <div className="truncate text-base font-semibold text-slate-800">{role.name}</div>
                <div className="mt-1 text-xs text-slate-400">
                  作者：{role.author || "匿名"}
                </div>
                <div className="mt-2.5 line-clamp-6 text-[12px] leading-5 text-slate-500">
                  {role.description}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-400">
                  <span>{roleCategoryLabelMap[role.category] ?? role.category}</span>
                  <span>
                    {role.createdAt
                      ? new Date(role.createdAt).toLocaleDateString("zh-CN")
                      : "公开角色"}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {isLoggedIn && mineRoles.length > 0 && (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-sm font-semibold text-slate-800">我的投稿</div>
          <div className="space-y-2">
            {mineRoles.map((role) => (
              <div
                key={role.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="font-medium text-slate-700">{role.name}</div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-500">
                    {role.publicRequested ? "申请公开" : "私密"}
                  </div>
                  <div className="text-xs text-slate-500">{reviewLabel(role)}</div>
                  <button
                    type="button"
                    onClick={() => {
                      startRoleChat(role);
                    }}
                    className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700"
                  >
                    开始对话
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {message && (
        <div className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          {message}
        </div>
      )}

      {selectedRole && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/45 px-3 py-6">
          <div className="relative max-h-[90vh] w-full max-w-[700px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_38px_rgba(15,23,42,0.24)]">
            <button
              type="button"
              onClick={() => setSelectedRole(null)}
              className="absolute right-3 top-3 z-10 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
            >
              关闭
            </button>

            <div className="relative h-44 overflow-hidden">
              {selectedRole.backgroundUrl &&
              !backgroundFallbackIds.includes(`detail-${selectedRole.id}`) ? (
                <img
                  src={selectedRole.backgroundUrl}
                  alt={`${selectedRole.name} background`}
                  className="h-full w-full object-cover"
                  onError={() => {
                    setBackgroundFallbackIds((prev) =>
                      prev.includes(`detail-${selectedRole.id}`)
                        ? prev
                        : [...prev, `detail-${selectedRole.id}`],
                    );
                  }}
                />
              ) : (
                <div className="h-full w-full bg-slate-100" />
              )}
              <div className="absolute inset-0 bg-blue-900/28" />
              <div className="absolute bottom-3 left-4 flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-white bg-white">
                  {selectedRole.avatarUrl &&
                  !avatarFallbackIds.includes(`detail-${selectedRole.id}`) ? (
                    <img
                      src={selectedRole.avatarUrl}
                      alt={selectedRole.name}
                      className="h-full w-full object-cover"
                      onError={() => {
                        setAvatarFallbackIds((prev) =>
                          prev.includes(`detail-${selectedRole.id}`)
                            ? prev
                            : [...prev, `detail-${selectedRole.id}`],
                        );
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-100 text-lg font-semibold text-blue-600">
                      {selectedRole.name.slice(0, 1)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xl font-semibold text-white">{selectedRole.name}</div>
                  <div className="text-sm text-slate-200">
                    作者：{selectedRole.author || "匿名"}
                  </div>
                </div>
              </div>
            </div>

            <div className="max-h-[calc(90vh-176px)] overflow-y-auto px-4 py-4">
              <div className="mb-3 text-xs text-slate-500">
                分类：{roleCategoryLabelMap[selectedRole.category] ?? selectedRole.category}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                {selectedRole.description}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    startRoleChat(selectedRole);
                    setSelectedRole(null);
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  开始对话
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
