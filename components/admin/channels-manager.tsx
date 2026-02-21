"use client";

import { useEffect, useState } from "react";

type Channel = {
  id: string;
  name: string;
  group: string;
  summary: string | null;
  baseUrl: string;
  modelName: string;
  systemApiKey: string | null;
  systemPrompt: string | null;
  isActive: boolean;
};

const defaultForm = {
  name: "",
  group: "普通通道",
  summary: "",
  baseUrl: "https://api.openai.com",
  modelName: "gpt-3.5-turbo",
  systemApiKey: "",
  systemPrompt: "",
  isActive: true,
};

export default function ChannelsManager() {
  const [rows, setRows] = useState<Channel[]>([]);
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [summaryDrafts, setSummaryDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [savingPromptId, setSavingPromptId] = useState<string | null>(null);
  const [savingSummaryId, setSavingSummaryId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function fetchRows() {
    setLoading(true);
    const res = await fetch("/api/admin/channels", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    const nextRows = Array.isArray(json?.data) ? (json.data as Channel[]) : [];
    setRows(nextRows);
    setPromptDrafts((prev) => {
      const next: Record<string, string> = {};
      nextRows.forEach((row) => {
        next[row.id] = prev[row.id] ?? row.systemPrompt ?? "";
      });
      return next;
    });
    setSummaryDrafts((prev) => {
      const next: Record<string, string> = {};
      nextRows.forEach((row) => {
        next[row.id] = prev[row.id] ?? row.summary ?? "";
      });
      return next;
    });
    setLoading(false);
  }

  useEffect(() => {
    void fetchRows();
  }, []);

  async function createChannel() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setMessage(json?.error || "创建失败");
      setSaving(false);
      return;
    }
    setForm(defaultForm);
    await fetchRows();
    setMessage("创建成功");
    setSaving(false);
  }

  async function toggleChannel(channel: Channel) {
    setMessage(null);
    await fetch(`/api/admin/channels/${channel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !channel.isActive }),
    });
    await fetchRows();
  }

  async function deleteChannel(id: string) {
    setMessage(null);
    await fetch(`/api/admin/channels/${id}`, { method: "DELETE" });
    await fetchRows();
  }

  async function saveSystemPrompt(channel: Channel) {
    const draftValue = promptDrafts[channel.id] ?? "";
    setSavingPromptId(channel.id);
    setMessage(null);
    const res = await fetch(`/api/admin/channels/${channel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemPrompt: draftValue }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setMessage(json?.error || "保存失败");
      setSavingPromptId(null);
      return;
    }
    setRows((prev) =>
      prev.map((item) =>
        item.id === channel.id ? { ...item, systemPrompt: draftValue.trim() || null } : item,
      ),
    );
    setSavingPromptId(null);
    setMessage(`已保存模型 ${channel.modelName} 的系统提示词`);
  }

  async function saveSummary(channel: Channel) {
    const draftValue = summaryDrafts[channel.id] ?? "";
    setSavingSummaryId(channel.id);
    setMessage(null);
    const res = await fetch(`/api/admin/channels/${channel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: draftValue }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setMessage(json?.error || "保存失败");
      setSavingSummaryId(null);
      return;
    }
    setRows((prev) =>
      prev.map((item) =>
        item.id === channel.id ? { ...item, summary: draftValue.trim() || null } : item,
      ),
    );
    setSavingSummaryId(null);
    setMessage(`已更新模型 ${channel.modelName} 的简介`);
  }

  return (
    <div className="space-y-5">
      <div className="text-2xl font-semibold text-slate-900">通道管理</div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 text-sm font-semibold text-slate-700">新增模型通道</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="通道名称"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            value={form.group}
            onChange={(event) => setForm((prev) => ({ ...prev, group: event.target.value }))}
            placeholder="分组"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            value={form.modelName}
            onChange={(event) => setForm((prev) => ({ ...prev, modelName: event.target.value }))}
            placeholder="模型名称"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            value={form.baseUrl}
            onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
            placeholder="接口地址"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={form.systemApiKey}
            onChange={(event) => setForm((prev) => ({ ...prev, systemApiKey: event.target.value }))}
            placeholder="系统密钥（可选）"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <textarea
            value={form.summary}
            onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
            placeholder="模型简介（展示在前台模型列表）"
            rows={2}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm xl:col-span-3"
          />
          <textarea
            value={form.systemPrompt}
            onChange={(event) => setForm((prev) => ({ ...prev, systemPrompt: event.target.value }))}
            placeholder="模型最高级系统提示词（可选）"
            rows={3}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm xl:col-span-3"
          />
        </div>
        <button
          type="button"
          onClick={createChannel}
          disabled={saving}
          className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          {saving ? "创建中..." : "创建通道"}
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
                <th className="px-3 py-2">分组</th>
                <th className="px-3 py-2">模型</th>
                <th className="px-3 py-2">简介</th>
                <th className="px-3 py-2">URL</th>
                <th className="px-3 py-2">模型级系统提示词</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.group}</td>
                  <td className="px-3 py-2">{row.modelName}</td>
                  <td className="min-w-[250px] px-3 py-2">
                    <textarea
                      value={summaryDrafts[row.id] ?? ""}
                      onChange={(event) =>
                        setSummaryDrafts((prev) => ({
                          ...prev,
                          [row.id]: event.target.value,
                        }))
                      }
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600"
                      placeholder="该简介会展示在前台模型列表"
                    />
                    <div className="mt-1 text-right">
                      <button
                        type="button"
                        onClick={() => void saveSummary(row)}
                        disabled={savingSummaryId === row.id}
                        className="rounded-md border border-blue-200 px-2 py-0.5 text-xs text-blue-700 disabled:opacity-60"
                      >
                        {savingSummaryId === row.id ? "保存中..." : "保存简介"}
                      </button>
                    </div>
                  </td>
                  <td className="max-w-[320px] truncate px-3 py-2">{row.baseUrl}</td>
                  <td className="min-w-[360px] px-3 py-2">
                    <textarea
                      value={promptDrafts[row.id] ?? ""}
                      onChange={(event) =>
                        setPromptDrafts((prev) => ({
                          ...prev,
                          [row.id]: event.target.value,
                        }))
                      }
                      rows={4}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                      placeholder="留空表示不注入模型级系统提示词"
                    />
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>该提示词会在聊天请求中以最高优先级注入。</span>
                      <button
                        type="button"
                        onClick={() => void saveSystemPrompt(row)}
                        disabled={savingPromptId === row.id}
                        className="rounded-md border border-blue-200 px-2 py-0.5 text-xs text-blue-700 disabled:opacity-60"
                      >
                        {savingPromptId === row.id ? "保存中..." : "保存提示词"}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2">{row.isActive ? "启用" : "禁用"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleChannel(row)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                      >
                        切换
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteChannel(row.id)}
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

      {message && (
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          {message}
        </div>
      )}
    </div>
  );
}
