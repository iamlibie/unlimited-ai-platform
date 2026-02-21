"use client";

import { useEffect, useState } from "react";

type BillingConfig = {
  loginDailyPoints: number;
  pointsStackLimit: number;
  vipDefaultMonthlyQuota: number;
  globalSystemPrompt: string;
};

type PricingRow = {
  id: string;
  name: string;
  group: string;
  modelName: string;
  pricing: {
    tier: "FREE" | "ADVANCED";
    staminaCost: number;
    vipQuotaCost: number;
    creditCost: number;
    vipOnly: boolean;
    enabled: boolean;
  } | null;
};

type PricingDraft = {
  tier: "FREE" | "ADVANCED";
  staminaCost: number;
  vipQuotaCost: number;
  creditCost: number;
  enabled: boolean;
};

type RedeemCard = {
  id: string;
  title: string | null;
  code: string;
  vipMonths: number;
  vipMonthlyQuota: number | null;
  points: number;
  maxUses: number;
  usedCount: number;
  redemptionCount: number;
  expiresAt: string | null;
  enabled: boolean;
  createdAt: string;
};

type NewCardForm = {
  title: string;
  code: string;
  vipMonths: number;
  vipMonthlyQuota: number;
  points: number;
  maxUses: number;
  expiresAt: string;
  enabled: boolean;
};

type AnnouncementDraft = {
  enabled: boolean;
  title: string;
  content: string;
};

type PricingDisplayDraft = {
  vipMonthlyPrice: number;
  vipQuarterlyPrice: number;
  vipYearlyPrice: number;
  pointsPerYuan: number;
};

const defaultConfig: BillingConfig = {
  loginDailyPoints: 80,
  pointsStackLimit: 300,
  vipDefaultMonthlyQuota: 200,
  globalSystemPrompt: "",
};

export default function BillingManager() {
  const [config, setConfig] = useState<BillingConfig>(defaultConfig);
  const [savingConfig, setSavingConfig] = useState(false);

  const [pricingRows, setPricingRows] = useState<PricingRow[]>([]);
  const [pricingDrafts, setPricingDrafts] = useState<Record<string, PricingDraft>>({});
  const [savingPricingId, setSavingPricingId] = useState<string | null>(null);

  const [cards, setCards] = useState<RedeemCard[]>([]);
  const [cardSaving, setCardSaving] = useState(false);
  const [cardTogglingId, setCardTogglingId] = useState<string | null>(null);
  const [cardDeletingId, setCardDeletingId] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState<NewCardForm>({
    title: "",
    code: "",
    vipMonths: 1,
    vipMonthlyQuota: 200,
    points: 0,
    maxUses: 1,
    expiresAt: "",
    enabled: true,
  });

  const [announcement, setAnnouncement] = useState<AnnouncementDraft>({
    enabled: false,
    title: "平台公告",
    content: "",
  });
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  const [pricingDisplay, setPricingDisplay] = useState<PricingDisplayDraft>({
    vipMonthlyPrice: 9.9,
    vipQuarterlyPrice: 27,
    vipYearlyPrice: 108,
    pointsPerYuan: 20,
  });
  const [savingPricingDisplay, setSavingPricingDisplay] = useState(false);

  const [message, setMessage] = useState<string | null>(null);

  async function fetchConfig() {
    const res = await fetch("/api/admin/billing/config", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (json?.data) {
      setConfig({ ...defaultConfig, ...json.data });
    }
  }

  async function fetchPricing() {
    const res = await fetch("/api/admin/billing/pricing", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    const rows = Array.isArray(json?.data) ? (json.data as PricingRow[]) : [];
    setPricingRows(rows);

    const nextDrafts: Record<string, PricingDraft> = {};
    rows.forEach((row) => {
      nextDrafts[row.id] = {
        tier: row.pricing?.tier ?? (row.id === "channel_free" ? "FREE" : "ADVANCED"),
        staminaCost: row.pricing?.staminaCost ?? 1,
        vipQuotaCost: row.pricing?.vipQuotaCost ?? 1,
        creditCost: row.pricing?.creditCost ?? 10,
        enabled: row.pricing?.enabled ?? true,
      };
    });
    setPricingDrafts(nextDrafts);
  }

  async function fetchCards() {
    const res = await fetch("/api/admin/cards", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setCards(Array.isArray(json?.data) ? (json.data as RedeemCard[]) : []);
  }

  async function fetchAnnouncement() {
    const res = await fetch("/api/admin/announcement", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (json?.data) {
      setAnnouncement({
        enabled: Boolean(json.data.enabled),
        title:
          typeof json.data.title === "string" && json.data.title.trim()
            ? json.data.title
            : "平台公告",
        content: typeof json.data.content === "string" ? json.data.content : "",
      });
    }
  }

  async function fetchPricingDisplay() {
    const res = await fetch("/api/admin/pricing-display", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (json?.data) {
      setPricingDisplay({
        vipMonthlyPrice: Number(json.data.vipMonthlyPrice) || 9.9,
        vipQuarterlyPrice: Number(json.data.vipQuarterlyPrice) || 27,
        vipYearlyPrice: Number(json.data.vipYearlyPrice) || 108,
        pointsPerYuan: Number(json.data.pointsPerYuan) || 20,
      });
    }
  }

  useEffect(() => {
    void Promise.all([
      fetchConfig(),
      fetchPricing(),
      fetchCards(),
      fetchAnnouncement(),
      fetchPricingDisplay(),
    ]);
  }, []);

  async function saveConfig() {
    setSavingConfig(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/billing/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("save_config_failed");
      setMessage("计费策略已保存");
    } catch {
      setMessage("计费策略保存失败");
    } finally {
      setSavingConfig(false);
    }
  }

  async function savePricing(channelId: string) {
    const draft = pricingDrafts[channelId];
    if (!draft) return;

    const normalized =
      draft.tier === "FREE"
        ? {
            tier: "FREE" as const,
            staminaCost: Math.max(0, draft.staminaCost),
            vipQuotaCost: 0,
            creditCost: 0,
            vipOnly: false,
            enabled: Boolean(draft.enabled),
          }
        : {
            tier: "ADVANCED" as const,
            staminaCost: 0,
            vipQuotaCost: Math.max(0, draft.vipQuotaCost),
            creditCost: Math.max(0, draft.creditCost),
            vipOnly: true,
            enabled: Boolean(draft.enabled),
          };

    setSavingPricingId(channelId);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/billing/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          ...normalized,
        }),
      });
      if (!res.ok) throw new Error("save_pricing_failed");
      await fetchPricing();
      setMessage("模型计费已更新");
    } catch {
      setMessage("模型计费更新失败");
    } finally {
      setSavingPricingId(null);
    }
  }

  async function createCard() {
    setCardSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cardForm.title.trim(),
          code: cardForm.code.trim(),
          vipMonths: cardForm.vipMonths,
          vipMonthlyQuota: cardForm.vipMonthlyQuota,
          points: cardForm.points,
          maxUses: cardForm.maxUses,
          expiresAt: cardForm.expiresAt.trim() || null,
          enabled: cardForm.enabled,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "创建卡密失败");

      setCardForm({
        title: "",
        code: "",
        vipMonths: 1,
        vipMonthlyQuota: 200,
        points: 0,
        maxUses: 1,
        expiresAt: "",
        enabled: true,
      });
      await fetchCards();
      setMessage("卡密已创建");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建卡密失败");
    } finally {
      setCardSaving(false);
    }
  }

  async function saveAnnouncement() {
    setSavingAnnouncement(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/announcement", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: announcement.enabled,
          title: announcement.title,
          content: announcement.content,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "公告保存失败");
      }
      setAnnouncement((prev) => ({
        ...prev,
        title:
          typeof json?.data?.title === "string" && json.data.title.trim()
            ? json.data.title
            : prev.title,
        content: typeof json?.data?.content === "string" ? json.data.content : prev.content,
        enabled: Boolean(json?.data?.enabled),
      }));
      setMessage("公告已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "公告保存失败");
    } finally {
      setSavingAnnouncement(false);
    }
  }

  async function savePricingDisplay() {
    setSavingPricingDisplay(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/pricing-display", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pricingDisplay),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "前台价格配置保存失败");
      }
      setPricingDisplay({
        vipMonthlyPrice: Number(json?.data?.vipMonthlyPrice) || pricingDisplay.vipMonthlyPrice,
        vipQuarterlyPrice:
          Number(json?.data?.vipQuarterlyPrice) || pricingDisplay.vipQuarterlyPrice,
        vipYearlyPrice: Number(json?.data?.vipYearlyPrice) || pricingDisplay.vipYearlyPrice,
        pointsPerYuan: Number(json?.data?.pointsPerYuan) || pricingDisplay.pointsPerYuan,
      });
      setMessage("前台价格配置已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "前台价格配置保存失败");
    } finally {
      setSavingPricingDisplay(false);
    }
  }

  async function toggleCardEnabled(card: RedeemCard) {
    setCardTogglingId(card.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !card.enabled }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "更新卡密失败");
      await fetchCards();
      setMessage(card.enabled ? "卡密已停用" : "卡密已启用");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新卡密失败");
    } finally {
      setCardTogglingId(null);
    }
  }

  async function deleteCard(card: RedeemCard) {
    if (!window.confirm(`确认删除卡密 ${card.code}？`)) return;
    setCardDeletingId(card.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/cards/${card.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "删除卡密失败");
      await fetchCards();
      setMessage("卡密已删除");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除卡密失败");
    } finally {
      setCardDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-2xl font-semibold text-slate-900">计费设置</div>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 text-sm font-semibold text-slate-700">签到点数策略</div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="text-xs text-slate-500">每日登录奖励点数</label>
            <input
              type="number"
              min={0}
              max={100000}
              value={config.loginDailyPoints}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  loginDailyPoints: Number(event.target.value) || 0,
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">签到点数累积上限</label>
            <input
              type="number"
              min={1}
              max={1000000}
              value={config.pointsStackLimit}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  pointsStackLimit: Number(event.target.value) || 1,
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">VIP 默认月配额</label>
            <input
              type="number"
              min={0}
              max={100000}
              value={config.vipDefaultMonthlyQuota}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  vipDefaultMonthlyQuota: Number(event.target.value) || 0,
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div className="mb-2 text-xs font-semibold text-slate-700">
            平台全局 System 提示词（对所有用户生效）
          </div>
          <textarea
            value={config.globalSystemPrompt}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                globalSystemPrompt: event.target.value,
              }))
            }
            rows={5}
            placeholder="该提示词会作用于所有请求（官方 / 自定义接口，所有角色均生效）"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-6"
          />
          <div className="mt-2 text-[11px] text-slate-500">
            合并顺序：平台全局 &gt; 模型级别 &gt; 用户本地全局 &gt; 扩展 &gt; 角色提示词
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="text-xs text-slate-500">
            用户点数与 VIP 发放已合并到“用户管理”页。
          </div>
          <button
            type="button"
            onClick={() => void saveConfig()}
            disabled={savingConfig}
            className="ml-auto rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {savingConfig ? "保存中..." : "保存策略"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 text-sm font-semibold text-slate-700">前台公告</div>
        <div className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <div>显示规则：</div>
          <div>- 前台会显示为弹窗（非强制）</div>
          <div>- 用户可点击“今日不再提醒”或“关闭”</div>
          <div>- “今日不再提醒”仅当日生效</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={announcement.enabled}
              onChange={(event) =>
                setAnnouncement((prev) => ({ ...prev, enabled: event.target.checked }))
              }
            />
            启用公告
          </label>
          <input
            value={announcement.title}
            onChange={(event) =>
              setAnnouncement((prev) => ({
                ...prev,
                title: event.target.value,
              }))
            }
            placeholder="公告标题（例如：系统通知）"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>
        <textarea
          value={announcement.content}
          onChange={(event) =>
            setAnnouncement((prev) => ({
              ...prev,
              content: event.target.value,
            }))
          }
          rows={5}
          placeholder="公告内容（支持多行）"
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void saveAnnouncement()}
            disabled={savingAnnouncement}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {savingAnnouncement ? "保存中..." : "保存公告"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 text-sm font-semibold text-slate-700">前台价格配置</div>
        <div className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <div>说明：</div>
          <div>- 前台计费中心“价格公示”直接读取这里的数据</div>
          <div>- VIP 显示为月卡 / 季卡 / 年卡</div>
          <div>- 点数按“每 1 元可兑换点数”显示</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="text-xs text-slate-500">VIP 月卡价格（元）</label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={pricingDisplay.vipMonthlyPrice}
              onChange={(event) =>
                setPricingDisplay((prev) => ({
                  ...prev,
                  vipMonthlyPrice: Number(event.target.value) || 0,
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">VIP 季卡价格（元）</label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={pricingDisplay.vipQuarterlyPrice}
              onChange={(event) =>
                setPricingDisplay((prev) => ({
                  ...prev,
                  vipQuarterlyPrice: Number(event.target.value) || 0,
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">VIP 年卡价格（元）</label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={pricingDisplay.vipYearlyPrice}
              onChange={(event) =>
                setPricingDisplay((prev) => ({
                  ...prev,
                  vipYearlyPrice: Number(event.target.value) || 0,
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">点数价格（点 / 元）</label>
            <input
              type="number"
              min={1}
              step="1"
              value={pricingDisplay.pointsPerYuan}
              onChange={(event) =>
                setPricingDisplay((prev) => ({
                  ...prev,
                  pointsPerYuan: Math.max(1, Number(event.target.value) || 1),
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void savePricingDisplay()}
            disabled={savingPricingDisplay}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {savingPricingDisplay ? "保存中..." : "保存价格"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 text-sm font-semibold text-slate-700">模型扣费矩阵</div>
        <div className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <div>扣费规则：</div>
          <div>- 普通模型：非 VIP 扣普通点数；VIP 畅聊普通模型不扣点数</div>
          <div>- VIP 模型：仅 VIP 可用，优先扣 VIP 月配额</div>
          <div>- VIP 月配额不足：按“兜底点数成本”扣普通点数</div>
          <div>- 自定义接口模型：不走平台扣费</div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">模型</th>
                <th className="px-3 py-2">层级</th>
                <th className="px-3 py-2">普通点数成本</th>
                <th className="px-3 py-2">VIP 月配额成本</th>
                <th className="px-3 py-2">兜底点数成本（VIP配额不足时）</th>
                <th className="px-3 py-2">启用</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {pricingRows.map((row) => {
                const draft = pricingDrafts[row.id];
                if (!draft) return null;
                return (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{row.name}</div>
                      <div className="text-xs text-slate-400">{row.modelName}</div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={draft.tier}
                        onChange={(event) =>
                          setPricingDrafts((prev) => ({
                            ...prev,
                            [row.id]: {
                              ...prev[row.id],
                              tier: event.target.value as PricingDraft["tier"],
                            },
                          }))
                        }
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                      >
                        <option value="FREE">普通模型</option>
                        <option value="ADVANCED">VIP 模型</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={draft.staminaCost}
                        disabled={draft.tier === "ADVANCED"}
                        onChange={(event) =>
                          setPricingDrafts((prev) => ({
                            ...prev,
                            [row.id]: {
                              ...prev[row.id],
                              staminaCost: Number(event.target.value) || 0,
                            },
                          }))
                        }
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={draft.vipQuotaCost}
                        disabled={draft.tier === "FREE"}
                        onChange={(event) =>
                          setPricingDrafts((prev) => ({
                            ...prev,
                            [row.id]: {
                              ...prev[row.id],
                              vipQuotaCost: Number(event.target.value) || 0,
                            },
                          }))
                        }
                        className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={10000}
                        value={draft.creditCost}
                        disabled={draft.tier === "FREE"}
                        onChange={(event) =>
                          setPricingDrafts((prev) => ({
                            ...prev,
                            [row.id]: {
                              ...prev[row.id],
                              creditCost: Number(event.target.value) || 0,
                            },
                          }))
                        }
                        className="w-36 rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={draft.enabled}
                          onChange={(event) =>
                            setPricingDrafts((prev) => ({
                              ...prev,
                              [row.id]: {
                                ...prev[row.id],
                                enabled: event.target.checked,
                              },
                            }))
                          }
                        />
                        已启用
                      </label>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => void savePricing(row.id)}
                        disabled={savingPricingId === row.id}
                        className="rounded-lg border border-blue-200 px-3 py-1 text-xs text-blue-700"
                      >
                        {savingPricingId === row.id ? "保存中..." : "保存"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 text-sm font-semibold text-slate-700">卡密管理（会员 / 点数兑换）</div>
        <div className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <div>字段说明：</div>
          <div>- VIP 月数：兑换后新增会员时长，填 0 表示不赠送 VIP</div>
          <div>- VIP 月配额：填 0 时按系统默认月配额发放</div>
          <div>- 点数：一次性到账，可作为加油包</div>
          <div>- 最大使用次数：1=单次卡；N=最多可被 N 个账号兑换</div>
          <div>- 有效期留空表示不过期</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={cardForm.title}
            onChange={(event) =>
              setCardForm((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder="卡密名称（后台备注）"
            title="仅后台可见，方便区分用途"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            value={cardForm.code}
            onChange={(event) =>
              setCardForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))
            }
            placeholder="自定义卡密（留空自动生成）"
            title="建议仅使用大写字母和数字，例如 VIP-3M-001"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            value={cardForm.vipMonths}
            onChange={(event) =>
              setCardForm((prev) => ({ ...prev, vipMonths: Number(event.target.value) || 0 }))
            }
            placeholder="VIP 月数（0=不送）"
            title="兑换后增加的会员月数"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            value={cardForm.vipMonthlyQuota}
            onChange={(event) =>
              setCardForm((prev) => ({
                ...prev,
                vipMonthlyQuota: Number(event.target.value) || 0,
              }))
            }
            placeholder="VIP 月配额（0=默认）"
            title="兑换后 VIP 每月可用配额；0 表示使用系统默认值"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            value={cardForm.points}
            onChange={(event) =>
              setCardForm((prev) => ({ ...prev, points: Number(event.target.value) || 0 }))
            }
            placeholder="赠送点数"
            title="兑换后一次性到账"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={1}
            value={cardForm.maxUses}
            onChange={(event) =>
              setCardForm((prev) => ({ ...prev, maxUses: Number(event.target.value) || 1 }))
            }
            placeholder="最大使用次数"
            title="1=单次卡；2 及以上可多人兑换"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={cardForm.expiresAt}
            onChange={(event) =>
              setCardForm((prev) => ({ ...prev, expiresAt: event.target.value }))
            }
            title="卡密过期时间（留空不过期）"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={cardForm.enabled}
              onChange={(event) =>
                setCardForm((prev) => ({ ...prev, enabled: event.target.checked }))
              }
            />
            创建后启用
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void createCard()}
            disabled={cardSaving}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {cardSaving ? "创建中..." : "生成卡密"}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">卡密</th>
                <th className="px-3 py-2">权益</th>
                <th className="px-3 py-2">使用情况</th>
                <th className="px-3 py-2">有效期</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs font-semibold text-slate-800">
                      {card.code}
                    </div>
                    <div className="text-xs text-slate-500">{card.title || "未命名"}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    <div>VIP +{card.vipMonths} 个月</div>
                    <div>VIP 月配额：{card.vipMonthlyQuota ?? "默认"}</div>
                    <div>点数 +{card.points}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {card.usedCount}/{card.maxUses}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {card.expiresAt ? new Date(card.expiresAt).toLocaleString("zh-CN") : "不过期"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        card.enabled
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {card.enabled ? "启用中" : "已停用"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleCardEnabled(card)}
                        disabled={cardTogglingId === card.id}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-60"
                      >
                        {card.enabled ? "停用" : "启用"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteCard(card)}
                        disabled={cardDeletingId === card.id}
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 disabled:opacity-60"
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
      </section>

      {message && <div className="text-sm text-slate-500">{message}</div>}
    </div>
  );
}
