"use client";

import { useEffect, useMemo, useState } from "react";

type BillingData = {
  points: number;
  pointsCap: number;
  dailyLoginPoints: number;
  recoveryMode: "INTERVAL_ONLY" | "INTERVAL_AND_DAILY";
  recoveryIntervalMinutes: number;
  recoveryAmount: number;
  dailyRefillHour: number;
  vip: {
    active: boolean;
    expiresAt: string | null;
    monthlyQuota: number;
    monthlyUsed: number;
    monthlyRemaining: number;
  };
};

type PricingDisplay = {
  vipMonthlyPrice: number;
  vipQuarterlyPrice: number;
  vipYearlyPrice: number;
  pointsPerYuan: number;
  updatedAt?: string;
};

const defaultPricingDisplay: PricingDisplay = {
  vipMonthlyPrice: 9.9,
  vipQuarterlyPrice: 27,
  vipYearlyPrice: 108,
  pointsPerYuan: 20,
};

type NoticeTone = "error" | "success" | "info";

function formatDate(value: string | null) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleString("zh-CN");
  } catch {
    return "--";
  }
}

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "0";
  const normalized = Math.max(0, value);
  return Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toFixed(2).replace(/\.?0+$/, "");
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [pricingDisplay, setPricingDisplay] = useState<PricingDisplay>(defaultPricingDisplay);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("info");
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const refreshBilling = async () => {
    const res = await fetch("/api/public/billing?peek=1", { cache: "no-store" });
    if (!res.ok) {
      throw new Error("Failed to load billing info");
    }
    const json = await res.json().catch(() => null);
    setBilling((json?.data ?? null) as BillingData | null);
  };

  const refreshPricingDisplay = async () => {
    try {
      const res = await fetch("/api/public/pricing-display", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      if (json?.data) {
        setPricingDisplay({
          vipMonthlyPrice: Number(json.data.vipMonthlyPrice) || defaultPricingDisplay.vipMonthlyPrice,
          vipQuarterlyPrice:
            Number(json.data.vipQuarterlyPrice) || defaultPricingDisplay.vipQuarterlyPrice,
          vipYearlyPrice: Number(json.data.vipYearlyPrice) || defaultPricingDisplay.vipYearlyPrice,
          pointsPerYuan: Number(json.data.pointsPerYuan) || defaultPricingDisplay.pointsPerYuan,
          updatedAt: json.data.updatedAt,
        });
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([refreshBilling(), refreshPricingDisplay()])
      .catch((error) => {
        if (!active) return;
        setNoticeTone("error");
        setNotice(error instanceof Error ? error.message : "Request failed");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function redeemCardCode() {
    const code = redeemCode.trim();
    if (!code) {
      setNoticeTone("error");
      setNotice("Please enter card code first");
      return;
    }

    setRedeeming(true);
    setNotice(null);
    try {
      const res = await fetch("/api/public/cards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Redeem failed");
      }

      const grantedPoints = Math.max(0, Number(json?.data?.pointsGranted ?? 0));
      const grantedVipMonths = Math.max(0, Number(json?.data?.vipMonthsGranted ?? 0));

      if (json?.data?.billing) {
        setBilling(json.data.billing as BillingData);
      } else {
        await refreshBilling();
      }

      const rewards: string[] = [];
      if (grantedVipMonths > 0) rewards.push(`VIP +${grantedVipMonths} month(s)`);
      if (grantedPoints > 0) rewards.push(`Points +${grantedPoints}`);

      setNoticeTone("success");
      setNotice(rewards.length > 0 ? `Redeem success: ${rewards.join(", ")}` : "Redeem success");
      setRedeemCode("");
    } catch (error) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "Redeem failed");
    } finally {
      setRedeeming(false);
    }
  }

  const vipText = useMemo(() => {
    if (!billing?.vip.active) return "Not active";
    return `Active, remaining ${billing.vip.monthlyRemaining}/${billing.vip.monthlyQuota}`;
  }, [billing]);

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-5">
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-xs font-semibold text-amber-700">
          B
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Billing Center</h1>
      </div>

      {notice && (
        <div
          className={`mb-4 rounded-xl px-3 py-2 text-sm ${
            noticeTone === "error"
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : noticeTone === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {notice}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          Loading...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <div className="text-xs text-slate-500">Points Balance</div>
              <div className="mt-1 text-xl font-semibold text-slate-800">{billing?.points ?? 0}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <div className="text-xs text-slate-500">Points Cap</div>
              <div className="mt-1 text-xl font-semibold text-slate-800">{billing?.pointsCap ?? 0}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <div className="text-xs text-slate-500">VIP Status</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{vipText}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <div className="text-xs text-slate-500">VIP Expire Time</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">
                {formatDate(billing?.vip.expiresAt ?? null)}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <div className="text-base font-semibold text-slate-800">Normal Models</div>
              <div className="mt-2.5 space-y-1.5 text-xs leading-6 text-slate-600">
                <div>- Non-VIP users consume points.</div>
                <div>- VIP users can use normal models without points.</div>
                <div>- Daily login reward: {billing?.dailyLoginPoints ?? 0} points.</div>
                <div>- Current cap: {billing?.pointsCap ?? 0}.</div>
              </div>
            </section>

            <section className="rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-[0_8px_20px_rgba(124,58,237,0.1)]">
              <div className="text-base font-semibold text-violet-800">VIP Models</div>
              <div className="mt-2.5 space-y-1.5 text-xs leading-6 text-violet-700">
                <div>- VIP models require active VIP.</div>
                <div>- Priority consumption: VIP monthly quota.</div>
                <div>- Fallback: points when quota is not enough.</div>
                <div>- Remaining VIP quota: {billing?.vip.monthlyRemaining ?? 0}.</div>
              </div>
            </section>

            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-[0_8px_20px_rgba(16,185,129,0.12)]">
              <div className="text-base font-semibold text-emerald-800">Points Pack</div>
              <div className="mt-2.5 space-y-1.5 text-xs leading-6 text-emerald-700">
                <div>- Purchase points to extend usage.</div>
                <div>- Login reward and paid points share one balance.</div>
                <div>- Current points: {billing?.points ?? 0}.</div>
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
            <div className="text-base font-semibold text-slate-800">Public Pricing</div>
            <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">VIP Monthly</td>
                    <td className="px-3 py-2 text-slate-600">{`${formatPrice(pricingDisplay.vipMonthlyPrice)} CNY / 1 month`}</td>
                    <td className="px-3 py-2 text-slate-600">Short-term</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">VIP Quarterly</td>
                    <td className="px-3 py-2 text-slate-600">{`${formatPrice(pricingDisplay.vipQuarterlyPrice)} CNY / 3 months`}</td>
                    <td className="px-3 py-2 text-slate-600">Value plan</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">VIP Yearly</td>
                    <td className="px-3 py-2 text-slate-600">{`${formatPrice(pricingDisplay.vipYearlyPrice)} CNY / 12 months`}</td>
                    <td className="px-3 py-2 text-slate-600">Long-term</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">Points</td>
                    <td className="px-3 py-2 text-slate-600">{`${pricingDisplay.pointsPerYuan} pts / 1 CNY`}</td>
                    <td className="px-3 py-2 text-slate-600">{`10 CNY = ${pricingDisplay.pointsPerYuan * 10} pts`}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-[0_8px_20px_rgba(59,130,246,0.12)]">
            <div className="text-base font-semibold text-blue-800">Redeem Card</div>
            <div className="mt-1.5 text-xs leading-6 text-blue-700">
              Enter the card code issued by the admin to redeem VIP months and/or points.
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={redeemCode}
                onChange={(event) => setRedeemCode(event.target.value.toUpperCase())}
                placeholder="Enter card code"
                className="h-10 min-w-[220px] flex-1 rounded-lg border border-blue-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={() => void redeemCardCode()}
                disabled={redeeming}
                className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {redeeming ? "Redeeming..." : "Redeem now"}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
            <div className="text-base font-semibold text-slate-800">Payment and Contact</div>
            <div className="mt-2 space-y-1.5 text-xs leading-6 text-slate-600">
              <div>1. Contact platform admin to confirm VIP months or points package.</div>
              <div>2. After payment, use card code above to redeem.</div>
              <div>3. Group chat and add-friend quick links are removed in this version.</div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}