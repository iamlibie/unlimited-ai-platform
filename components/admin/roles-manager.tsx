"use client";

import { useEffect, useMemo, useState } from "react";

type Role = {
  id: string;
  name: string;
  author: string | null;
  category: string;
  description: string;
  prompt: string;
  avatarUrl?: string | null;
  backgroundUrl?: string | null;
  isPublic: boolean;
  publicRequested: boolean;
  reviewStatus: "APPROVED" | "PENDING" | "REJECTED";
  createdByUserId: string | null;
  createdAt: string;
};

type RoleForm = {
  name: string;
  author: string;
  category: string;
  description: string;
  prompt: string;
  avatarUrl: string;
  backgroundUrl: string;
  isPublic: boolean;
};

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

const defaultForm: RoleForm = {
  name: "",
  author: "系统",
  category: "General",
  description: "",
  prompt: "",
  avatarUrl: "",
  backgroundUrl: "",
  isPublic: true,
};

function toRoleForm(role: Role): RoleForm {
  return {
    name: role.name ?? "",
    author: role.author ?? "系统",
    category: role.category ?? "General",
    description: role.description ?? "",
    prompt: role.prompt ?? "",
    avatarUrl: role.avatarUrl ?? "",
    backgroundUrl: role.backgroundUrl ?? "",
    isPublic: role.isPublic,
  };
}

export default function RolesManager() {
  const [rows, setRows] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<RoleForm>(defaultForm);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RoleForm>(defaultForm);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const editingRole = useMemo(
    () => rows.find((item) => item.id === editingRoleId) ?? null,
    [editingRoleId, rows],
  );

  async function fetchRows() {
    setLoading(true);
    const res = await fetch("/api/admin/roles", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setRows(Array.isArray(json?.data) ? json.data : []);
    setLoading(false);
  }

  useEffect(() => {
    void fetchRows();
  }, []);

  async function uploadImage(
    file: File,
    kind: "avatar" | "background",
    target: "create" | "edit",
  ) {
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
      if (target === "create") {
        setForm((prev) =>
          kind === "avatar" ? { ...prev, avatarUrl: url } : { ...prev, backgroundUrl: url },
        );
      } else {
        setEditForm((prev) =>
          kind === "avatar" ? { ...prev, avatarUrl: url } : { ...prev, backgroundUrl: url },
        );
      }
      setMessage(
        kind === "avatar"
          ? "头像上传成功"
          : "背景图上传成功",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败");
    } finally {
      if (kind === "avatar") {
        setUploadingAvatar(false);
      } else {
        setUploadingBackground(false);
      }
    }
  }

  async function createRole() {
    setSavingCreate(true);
    setMessage(null);

    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        author: form.author.trim() || "系统",
        category: form.category.trim() || "General",
        description: form.description.trim(),
        prompt: form.prompt.trim(),
        avatarUrl: form.avatarUrl.trim(),
        backgroundUrl: form.backgroundUrl.trim(),
      };
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "创建失败");
      }
      setForm(defaultForm);
      await fetchRows();
      setMessage("创建成功");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建失败");
    } finally {
      setSavingCreate(false);
    }
  }

  async function patchRole(id: string, payload: Record<string, unknown>) {
    setMessage(null);
    const res = await fetch(`/api/admin/roles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setMessage(json?.error || "操作失败");
      return false;
    }
    await fetchRows();
    return true;
  }

  async function saveEdit() {
    if (!editingRoleId) return;
    setSavingEdit(true);
    setMessage(null);

    try {
      const payload = {
        ...editForm,
        name: editForm.name.trim(),
        author: editForm.author.trim() || "系统",
        category: editForm.category.trim() || "General",
        description: editForm.description.trim(),
        prompt: editForm.prompt.trim(),
        avatarUrl: editForm.avatarUrl.trim(),
        backgroundUrl: editForm.backgroundUrl.trim(),
      };
      const ok = await patchRole(editingRoleId, payload);
      if (!ok) return;
      setEditingRoleId(null);
      setMessage("角色卡已更新");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteRole(id: string) {
    if (!window.confirm("确认删除这张角色卡？")) return;
    setMessage(null);
    const res = await fetch(`/api/admin/roles/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setMessage(json?.error || "删除失败");
      return;
    }
    await fetchRows();
  }

  return (
    <div className="space-y-5">
      <div className="text-2xl font-semibold text-slate-900">角色管理</div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 text-sm font-semibold text-slate-700">
          新增角色（管理员）
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="角色名称"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            value={form.author}
            onChange={(event) => setForm((prev) => ({ ...prev, author: event.target.value }))}
            placeholder="作者"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <select
            value={form.category}
            onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            {roleCategoryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, isPublic: event.target.checked }))
              }
            />
            创建后立即公开
          </label>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 md:col-span-2">
            <div className="mb-1 text-xs text-slate-500">头像上传</div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadImage(file, "avatar", "create");
                }}
                className="text-xs"
              />
              {uploadingAvatar && <span className="text-xs text-slate-500">上传中...</span>}
              {form.avatarUrl && (
                <img
                  src={form.avatarUrl}
                  alt="avatar"
                  className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                />
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 md:col-span-2">
            <div className="mb-1 text-xs text-slate-500">背景图上传</div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadImage(file, "background", "create");
                }}
                className="text-xs"
              />
              {uploadingBackground && (
                <span className="text-xs text-slate-500">上传中...</span>
              )}
              {form.backgroundUrl && (
                <img
                  src={form.backgroundUrl}
                  alt="background"
                  className="h-12 w-24 rounded-md border border-slate-200 object-cover"
                />
              )}
            </div>
          </div>

          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="角色介绍"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
            rows={2}
          />
          <textarea
            value={form.prompt}
            onChange={(event) => setForm((prev) => ({ ...prev, prompt: event.target.value }))}
            placeholder="角色提示词"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
            rows={3}
          />
        </div>
        <button
          type="button"
          onClick={() => void createRole()}
          disabled={savingCreate}
          className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {savingCreate ? "创建中..." : "创建角色"}
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">加载中...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">名称</th>
                <th className="px-3 py-2">作者</th>
                <th className="px-3 py-2">分类</th>
                <th className="px-3 py-2">申请公开</th>
                <th className="px-3 py-2">审核状态</th>
                <th className="px-3 py-2">当前公开</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{row.name}</div>
                    <div className="text-xs text-slate-400">
                      {row.createdByUserId ? `用户ID: ${row.createdByUserId}` : "系统预设"}
                    </div>
                  </td>
                  <td className="px-3 py-2">{row.author || "-"}</td>
                  <td className="px-3 py-2">{row.category}</td>
                  <td className="px-3 py-2">{row.publicRequested ? "是" : "否"}</td>
                  <td className="px-3 py-2">
                    {row.reviewStatus === "APPROVED"
                      ? "已通过"
                      : row.reviewStatus === "PENDING"
                        ? "审核中"
                        : "已拒绝"}
                  </td>
                  <td className="px-3 py-2">{row.isPublic ? "是" : "否"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {row.publicRequested && row.reviewStatus === "PENDING" && (
                        <>
                          <button
                            type="button"
                            onClick={() => void patchRole(row.id, { reviewAction: "approve" })}
                            className="rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-700"
                          >
                            通过
                          </button>
                          <button
                            type="button"
                            onClick={() => void patchRole(row.id, { reviewAction: "reject" })}
                            className="rounded-lg border border-amber-200 px-2 py-1 text-xs text-amber-700"
                          >
                            拒绝
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRoleId(row.id);
                          setEditForm(toRoleForm(row));
                        }}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => void patchRole(row.id, { isPublic: !row.isPublic })}
                        className="rounded-lg border border-blue-200 px-2 py-1 text-xs text-blue-700"
                      >
                        切换公开
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteRole(row.id)}
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingRole && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center bg-slate-900/40 px-3 py-6">
          <div className="max-h-[90vh] w-full max-w-[720px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_38px_rgba(15,23,42,0.24)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-semibold text-slate-900">编辑角色卡</div>
              <button
                type="button"
                onClick={() => setEditingRoleId(null)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
              >
                关闭
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={editForm.name}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="角色名称"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={editForm.author}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, author: event.target.value }))
                }
                placeholder="作者"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={editForm.category}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, category: event.target.value }))
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {roleCategoryOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={editForm.isPublic}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, isPublic: event.target.checked }))
                  }
                />
                公开
              </label>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                <div className="mb-1 text-xs text-slate-500">头像上传</div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadImage(file, "avatar", "edit");
                    }}
                    className="text-xs"
                  />
                  {uploadingAvatar && <span className="text-xs text-slate-500">上传中...</span>}
                  {editForm.avatarUrl && (
                    <img
                      src={editForm.avatarUrl}
                      alt="edit avatar"
                      className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                    />
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                <div className="mb-1 text-xs text-slate-500">背景图上传</div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadImage(file, "background", "edit");
                    }}
                    className="text-xs"
                  />
                  {uploadingBackground && (
                    <span className="text-xs text-slate-500">上传中...</span>
                  )}
                  {editForm.backgroundUrl && (
                    <img
                      src={editForm.backgroundUrl}
                      alt="edit background"
                      className="h-12 w-24 rounded-md border border-slate-200 object-cover"
                    />
                  )}
                </div>
              </div>

              <textarea
                value={editForm.description}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="角色介绍"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                rows={3}
              />
              <textarea
                value={editForm.prompt}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, prompt: event.target.value }))
                }
                placeholder="角色提示词"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                rows={5}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingRoleId(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={savingEdit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {savingEdit ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          {message}
        </div>
      )}
    </div>
  );
}
