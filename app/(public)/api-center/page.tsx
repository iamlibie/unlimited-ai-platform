"use client";

import { useEffect, useMemo, useState } from "react";

import { useChatStore } from "@/store/chat-store";

type SettingsResponse = {
  data?: {
    historyLength?: number;
    contextCompression?: number;
  };
};

type ModelsResponse = {
  data?: string[];
  error?: string;
};

function normalizeModelNames(models: string[]) {
  return Array.from(
    new Set(models.map((item) => item.trim()).filter(Boolean)),
  );
}

export default function ApiCenterPage() {
  const apiSettings = useChatStore((state) => state.apiSettings);
  const setApiSettings = useChatStore((state) => state.setApiSettings);
  const localSystemPrompt = useChatStore((state) => state.localSystemPrompt);
  const setLocalSystemPrompt = useChatStore((state) => state.setLocalSystemPrompt);

  const [apiKey, setApiKey] = useState(apiSettings.apiKey);
  const [baseUrl, setBaseUrl] = useState(apiSettings.baseUrl);
  const [historyLength, setHistoryLength] = useState(apiSettings.historyLength);
  const [contextCompression, setContextCompression] = useState(0);
  const [manualModelInput, setManualModelInput] = useState("");
  const [modelList, setModelList] = useState<string[]>([]);
  const [customModel, setCustomModel] = useState(
    (apiSettings.customModel ?? "").trim(),
  );
  const [selectedCustomModels, setSelectedCustomModels] = useState<string[]>(
    normalizeModelNames([
      ...(apiSettings.customModels ?? []),
      apiSettings.customModel ?? "",
    ]),
  );
  const [localSystemPromptDraft, setLocalSystemPromptDraft] =
    useState(localSystemPrompt);

  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/public/settings")
      .then((res) => res.json())
      .then((json: SettingsResponse) => {
        if (!active) return;
        const payload = json?.data;
        if (!payload) return;
        setHistoryLength(payload.historyLength ?? 20);
        setContextCompression(payload.contextCompression ?? 0);
      })
      .catch(() => {
        if (active) {
          setMessage("加载设置失败");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const normalized = normalizeModelNames([
      ...(apiSettings.customModels ?? []),
      apiSettings.customModel ?? "",
    ]);
    setSelectedCustomModels(normalized);
    setCustomModel((apiSettings.customModel ?? "").trim());
  }, [apiSettings.customModel, apiSettings.customModels]);

  useEffect(() => {
    setLocalSystemPromptDraft(localSystemPrompt);
  }, [localSystemPrompt]);

  const normalizedFetchedModels = useMemo(
    () => normalizeModelNames(modelList),
    [modelList],
  );

  function commitCustomModels(nextModelsInput: string[], nextCurrentInput: string) {
    const nextModels = normalizeModelNames(nextModelsInput);
    const nextCurrent = nextCurrentInput.trim();
    if (nextCurrent && !nextModels.includes(nextCurrent)) {
      nextModels.unshift(nextCurrent);
    }
    setSelectedCustomModels(nextModels);
    setCustomModel(nextCurrent);
    setApiSettings({
      customModels: nextModels,
      customModel: nextCurrent,
    });
  }

  function toggleFetchedModel(modelName: string) {
    if (selectedCustomModels.includes(modelName)) {
      const nextModels = selectedCustomModels.filter((item) => item !== modelName);
      const nextCurrent = customModel === modelName ? nextModels[0] ?? "" : customModel;
      commitCustomModels(nextModels, nextCurrent);
      return;
    }

    const nextModels = [...selectedCustomModels, modelName];
    const nextCurrent = customModel || modelName;
    commitCustomModels(nextModels, nextCurrent);
  }

  function addManualModel() {
    const modelName = manualModelInput.trim();
    if (!modelName) {
      setMessage("请先输入模型名");
      return;
    }

    if (selectedCustomModels.includes(modelName)) {
      commitCustomModels(selectedCustomModels, modelName);
      setManualModelInput("");
      setMessage("模型已存在，已设为当前");
      return;
    }

    commitCustomModels([...selectedCustomModels, modelName], modelName);
    setManualModelInput("");
    setMessage("已添加自定义模型");
  }

  async function fetchModels() {
    const nextBaseUrl = baseUrl.trim();
    if (!nextBaseUrl) {
      setMessage("请先填写 Base URL");
      return;
    }

    setLoadingModels(true);
    setMessage(null);
    try {
      const res = await fetch("/api/public/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          baseUrl: nextBaseUrl,
        }),
      });
      const payload = (await res.json().catch(() => null)) as ModelsResponse | null;
      if (!res.ok) {
        throw new Error(payload?.error || "获取模型失败");
      }

      const modelData = payload?.data;
      const models = Array.isArray(modelData) ? modelData : [];
      setModelList(models);
      setMessage(
        models.length > 0
          ? `已获取 ${models.length} 个模型，在下方点击多选`
          : "没有获取到模型",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "获取模型失败");
    } finally {
      setLoadingModels(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/public/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          historyLength,
          contextCompression,
        }),
      });
      if (!res.ok) throw new Error("保存失败");

      setApiSettings({
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        historyLength,
        customModel: customModel.trim(),
        customModels: selectedCustomModels,
      });
      setMessage("配置已保存（API Key/Base URL 只在浏览器本地）");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-5">
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-xs font-semibold text-emerald-700">
          API
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          自定义 API 中心
        </h1>
      </div>

      <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div className="mb-4 text-xl font-semibold text-slate-900">
            连接设置
          </div>
          <div className="mb-4 text-sm text-slate-500">
            API Key 和 Base URL 只保存在当前浏览器本地，不会上传到服务器。
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-xxxx"
                className="mt-2.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.openai.com"
                className="mt-2.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                历史消息长度
              </label>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={historyLength}
                  onChange={(event) => setHistoryLength(Number(event.target.value))}
                  className="w-full"
                />
                <span className="min-w-9 text-sm text-slate-600">{historyLength}</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                上下文压缩
              </label>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={contextCompression}
                  onChange={(event) => setContextCompression(Number(event.target.value))}
                  className="w-full"
                />
                <span className="min-w-12 text-sm text-slate-600">
                  {contextCompression}%
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div className="mb-2 text-xl font-semibold text-slate-900">
            本地全局 System 提示词
          </div>
          <div className="mb-3 text-sm text-slate-500">
            对所有模型/角色/渠道生效，仅保存在当前浏览器和当前账号，不上传服务器。
          </div>
          <textarea
            value={localSystemPromptDraft}
            onChange={(event) => setLocalSystemPromptDraft(event.target.value)}
            rows={5}
            placeholder="例如：回答先给结论、减少废话、输出结构化结果..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-blue-300 focus:bg-white"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-400">
              留空即关闭本地全局提示词
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLocalSystemPrompt("");
                  setLocalSystemPromptDraft("");
                  setMessage("已清空本地全局提示词");
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition hover:bg-slate-50"
              >
                清空
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalSystemPrompt(localSystemPromptDraft.trim());
                  setMessage("本地全局提示词已保存");
                }}
                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 transition hover:bg-blue-100"
              >
                保存到本地
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div className="mb-4 text-xl font-semibold text-slate-900">
            模型设置（可多选）
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr,auto,auto]">
            <input
              type="text"
              value={manualModelInput}
              onChange={(event) => setManualModelInput(event.target.value)}
              placeholder="gpt-4o-mini / deepseek-chat / claude-3-5-sonnet"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white"
            />
            <button
              type="button"
              onClick={addManualModel}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700 transition hover:bg-blue-100"
            >
              添加自定义模型
            </button>
            <button
              type="button"
              onClick={fetchModels}
              disabled={loadingModels}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingModels ? "获取中..." : "自动获取模型"}
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <span className="text-slate-500">当前默认模型：</span>
            <span className="ml-2 font-medium text-slate-800">
              {customModel || "未设置（将使用左上角官方模型）"}
            </span>
          </div>

          <div className="mt-5">
            <div className="mb-2 text-sm font-medium text-slate-700">
              自动获取结果（点击多选）
            </div>
            {normalizedFetchedModels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                请先点击“自动获取模型”
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {normalizedFetchedModels.map((modelName) => {
                  const selected = selectedCustomModels.includes(modelName);
                  return (
                    <button
                      key={modelName}
                      type="button"
                      onClick={() => toggleFetchedModel(modelName)}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                        selected
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {selected ? "已加入" : "点击加入"}: {modelName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-5">
            <div className="mb-2 text-sm font-medium text-slate-700">
              已选自定义模型（可多个，可在左上角切换）
            </div>
            {selectedCustomModels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                暂无自定义模型
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedCustomModels.map((modelName) => {
                  const active = customModel === modelName;
                  return (
                    <div
                      key={modelName}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 ${
                        active ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => commitCustomModels(selectedCustomModels, modelName)}
                        className={`text-xs ${
                          active ? "text-emerald-700" : "text-slate-700"
                        }`}
                      >
                        {active ? "当前使用" : "设为当前"}: {modelName}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nextModels = selectedCustomModels.filter(
                            (item) => item !== modelName,
                          );
                          const nextCurrent =
                            customModel === modelName ? nextModels[0] ?? "" : customModel;
                          commitCustomModels(nextModels, nextCurrent);
                        }}
                        className="rounded px-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-red-500"
                        title="移除"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {message && (
          <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
            {message}
          </div>
        )}
        <button
          type="button"
          onClick={saveSettings}
          disabled={saving}
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(41,69,87,0.22)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "保存中..." : "保存配置"}
        </button>
      </div>
    </div>
  );
}
