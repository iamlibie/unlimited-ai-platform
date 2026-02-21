"use client";

import { useEffect, useState } from "react";

type Extension = {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
};

const defaultForm = {
  name: "",
  description: "",
  prompt: "",
  isPublic: true,
};

export default function ExtensionsManager() {
  const [rows, setRows] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  async function fetchRows() {
    setLoading(true);
    const res = await fetch("/api/admin/extensions");
    const json = await res.json();
    setRows(Array.isArray(json?.data) ? json.data : []);
    setLoading(false);
  }

  useEffect(() => {
    void fetchRows();
  }, []);

  async function createExtension() {
    setSaving(true);
    await fetch("/api/admin/extensions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(defaultForm);
    await fetchRows();
    setSaving(false);
  }

  async function toggleExtension(row: Extension) {
    await fetch(`/api/admin/extensions/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !row.isPublic }),
    });
    await fetchRows();
  }

  async function deleteExtension(id: string) {
    await fetch(`/api/admin/extensions/${id}`, { method: "DELETE" });
    await fetchRows();
  }

  return (
    <div className="space-y-5">
      <div className="text-2xl font-semibold text-slate-900">扩展管理</div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 text-sm font-semibold text-slate-700">新增扩展</div>
        <div className="grid gap-3">
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="扩展名称"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="扩展描述"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            rows={2}
          />
          <textarea
            value={form.prompt}
            onChange={(event) => setForm((prev) => ({ ...prev, prompt: event.target.value }))}
            placeholder="系统提示词"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            rows={3}
          />
        </div>
        <button
          type="button"
          onClick={createExtension}
          disabled={saving}
          className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          {saving ? "创建中..." : "创建扩展"}
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
                <th className="px-3 py-2">描述</th>
                <th className="px-3 py-2">公开</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.description}</td>
                  <td className="px-3 py-2">{row.isPublic ? "是" : "否"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExtension(row)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                      >
                        切换
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteExtension(row.id)}
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
    </div>
  );
}
