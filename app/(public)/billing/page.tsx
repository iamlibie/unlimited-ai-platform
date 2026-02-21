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
      throw new Error("闁哄啰濮电涵鍫曞礉閻樼儤绁伴悹浼倕鐎ǎ鍥ｅ墲娴?);
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
        setNotice(error instanceof Error ? error.message : "閻犲洭鏀遍惇鐗堝緞鏉堫偉袝");
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
      setNotice("閻犲洨鏌夌欢顓㈠礂閵夈儱骞㈤悗?);
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
        throw new Error(json?.error || "闁稿繑鍨跺畷鍙夊緞鏉堫偉袝");
      }

      const grantedPoints = Math.max(0, Number(json?.data?.pointsGranted ?? 0));
      const grantedVipMonths = Math.max(0, Number(json?.data?.vipMonthsGranted ?? 0));
      if (json?.data?.billing) {
        setBilling(json.data.billing as BillingData);
      } else {
        await refreshBilling();
      }

      const rewardParts: string[] = [];
      if (grantedVipMonths > 0) rewardParts.push(`VIP +${grantedVipMonths} 濞戞搩浜濆﹢鈧琡);
      if (grantedPoints > 0) rewardParts.push(`闁绘劘顫夐弳?+${grantedPoints}`);
      setNoticeTone("success");
      setNotice(
        rewardParts.length > 0
          ? `闁稿繑鍨跺畷鏌ュ箣閹邦剙顫犻柨?{rewardParts.join("闁?)}`
          : "闁稿繑鍨跺畷鏌ュ箣閹邦剙顫?,
      );
      setRedeemCode("");
    } catch (error) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "闁稿繑鍨跺畷鍙夊緞鏉堫偉袝");
    } finally {
      setRedeeming(false);
    }
  }

  const vipText = useMemo(() => {
    if (!billing?.vip.active) return "闁哄牜浜滅槐鎴︽焻?;
    return `鐎瑰憡褰冪槐鎴︽焻濮樺墽绀夐柛鎾櫃缂?${billing.vip.monthlyRemaining}/${billing.vip.monthlyQuota}`;
  }, [billing]);

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-5">
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-xs font-semibold text-amber-700">
          B
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">閻犱籍銈呯€☉鎿冨幖缁?/h1>
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
          婵繐绲藉﹢顏堝礉閻樼儤绁?..
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <div className="text-xs text-slate-500">闁绘劘顫夐弳鐔告媴濞嗘搩鏉?/div>
              <div className="mt-1 text-xl font-semibold text-slate-800">
                {billing?.points ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <div className="text-xs text-slate-500">缂佹稒鍎抽崺宀勬倷鐟欏嫭娈剁紒槌栧灣琚у☉鎾筹躬濡?/div>
              <div className="mt-1 text-xl font-semibold text-slate-800">
                {billing?.pointsCap ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <div className="text-xs text-slate-500">VIP 闁绘鍩栭埀?/div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{vipText}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <div className="text-xs text-slate-500">VIP 闁告帞澧楀﹢锟犲籍閸洘锛?/div>
              <div className="mt-1 text-sm font-semibold text-slate-800">
                {formatDate(billing?.vip.expiresAt ?? null)}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <div className="text-base font-semibold text-slate-800">闁哄拋鍣ｉ埀顒佸哺閳ь剚宀告禍?/div>
              <div className="mt-2.5 space-y-1.5 text-xs leading-6 text-slate-600">
                <div>鐠?闂?VIP 濞达綀娉曢弫銈夊疾椤曗偓閳ь剚纰嶈啯闁搞劌顑嗙€垫粓寮查鈧埀顒佹皑閸嬶綁寮悧鍫濃拸閻?/div>
                <div>鐠?VIP 闁活潿鍔嶉崺娑㈡偩閸涢鍠婇柡鍜佸櫍閳ь剚纰嶈啯闁搞劌顑戠槐娆愮▔瀹ュ棗鈷忛柣鎰潐閺嗙喖鏁?/div>
                <div>{`鐠?婵絽绻戝Λ鈺呮儌鐠囪尙绉垮┑鍌涚墪婵娊鏁?{billing?.dailyLoginPoints ?? 0} 闁绘劗顒焳</div>
                <div>{`鐠?缂佹稒鍎抽崺宀勬倷鐟欏嫭娈剁紒槌栧灣琚у☉鎾筹躬濡炬椽鏁?{billing?.pointsCap ?? 0}`}</div>
              </div>
            </section>

            <section className="rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-[0_8px_20px_rgba(124,58,237,0.1)]">
              <div className="text-base font-semibold text-violet-800">VIP 濠靛倹顨婇ˇ?/div>
              <div className="mt-2.5 space-y-1.5 text-xs leading-6 text-violet-700">
                <div>鐠?閻熸瑱缍侀弨?VIP 婵☆垪鈧磭鈧?/div>
                <div>鐠?VIP 婵☆垪鈧磭鈧攱瀵煎Ο鍝勫弗闁?VIP 闁哄牆鐗撻崢銈嗭紣?/div>
                <div>鐠?VIP 闂佹澘绉归·鍌涚▔瀹ュ牆鍠曢柡鍐煐鐎垫粓宕楀鍐亢闁绘劘顫夐弳鐔煎箥閿濆牆鐎?/div>
                <div>鐠?闁伙絽鎳撴禍浼村疾椤曗偓閳ь剚纰嶈啯闁搞劌顑戠槐娆愮▔瀹ュ棗鈷忛柣鎰潐閺嗙喖鏁?/div>
                <div>{`鐠?鐟滅増鎸告晶?VIP 濞达絾鐟╅崳娲晬?{billing?.vip.monthlyRemaining ?? 0}`}</div>
              </div>
            </section>

            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-[0_8px_20px_rgba(16,185,129,0.12)]">
              <div className="text-base font-semibold text-emerald-800">闁绘劘顫夐弳鐔煎礉閻樺疇藟闁?/div>
              <div className="mt-2.5 space-y-1.5 text-xs leading-6 text-emerald-700">
                <div>鐠?缂佹稒鍎抽崺宀勬倷鐟欏嫭娈跺☉鎾抽婵偛鈻介悷鏉跨樁闁绘劘顫夐弳鐔煎礂鏉堚晜鏆忛柛姘缁斿瓨鎷呭▎鎿冩澓</div>
                <div>鐠?缂佹稒鍎抽崺灞剧附閺嵮冃￠柛娆愩仜閳ь剚绮庨鐑藉礆閹殿喖浠柡浣瑰閻ゎ喚绮旈娆戠憪闂傚嫭鍔忛埀顒佺箘鐎规娊寮?/div>
                <div>鐠?闁告梻濮电悰銉╁礌閸涱厼璁查柡鍐█濡捐櫣鎷归婵囧闁挎稑濂旂粭澶愬矗濡ゅ喚鍔柛鎺撳閻ゎ喚绮旈娆戠憪闂傚嫭鍔欏娲礆?/div>
                <div>{`鐠?鐟滅増鎸告晶鐘虫媴濞嗘搩鏉洪柨?{billing?.points ?? 0}`}</div>
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
            <div className="text-base font-semibold text-slate-800">濞寸娀鏀遍悧鎼佸礂椤掑倶浠?/div>
            <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2">濡炪倕婀卞ú?/th>
                    <th className="px-3 py-2">濞寸娀鏀遍悧?/th>
                    <th className="px-3 py-2">閻犲洤鐡ㄥΣ?/th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">VIP 闁哄牆鐗嗗畷?/td>
                    <td className="px-3 py-2 text-slate-600">
                      {`${formatPrice(pricingDisplay.vipMonthlyPrice)} 闁?/ 1濞戞搩浜濆﹢鈧琡}
                    </td>
                    <td className="px-3 py-2 text-slate-600">闁活収鍘藉﹢鈩冩媴閹捐崵宕?/td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">VIP 閻庢冻绲藉畷?/td>
                    <td className="px-3 py-2 text-slate-600">
                      {`${formatPrice(pricingDisplay.vipQuarterlyPrice)} 闁?/ 3濞戞搩浜濆﹢鈧琡}
                    </td>
                    <td className="px-3 py-2 text-slate-600">濡ゅ倹蓱閳ь儸鍌滃箚婵?/td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">VIP 妤犵偞娼欏畷?/td>
                    <td className="px-3 py-2 text-slate-600">
                      {`${formatPrice(pricingDisplay.vipYearlyPrice)} 闁?/ 12濞戞搩浜濆﹢鈧琡}
                    </td>
                    <td className="px-3 py-2 text-slate-600">闁稿繈鍔岄崟鐐附濡ゅ拋妯€</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">闁绘劘顫夐弳?/td>
                    <td className="px-3 py-2 text-slate-600">
                      {`${pricingDisplay.pointsPerYuan} 闁?/ 1 闁稿繐鍎瑌
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {`10 闁?= ${pricingDisplay.pointsPerYuan * 10} 闁绘劗顒焳
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-[0_8px_20px_rgba(59,130,246,0.12)]">
            <div className="text-base font-semibold text-blue-800">闁告せ鈧磭妲曢柛蹇斿灦瀹?/div>
            <div className="mt-1.5 text-xs leading-6 text-blue-700">
              閺夊牊鎸搁崣鍡欑不閿涘嫭鍊為柛娑櫭ぐ鍌炲绩閸撗勭暠闁告せ鈧磭妲曢柨娑樿嫰瑜版煡宕楅幋鐐插簥 VIP 闁哄牆鐗婇弳鐔煎椽?/ 闁瑰瓨鐗滈崑锝夊极閺夋娈柛鏂剧┒閳?            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={redeemCode}
                onChange={(event) => setRedeemCode(event.target.value.toUpperCase())}
                placeholder="閺夊牊鎸搁崣鍡涘础閳ュ磭妲?
                className="h-10 min-w-[220px] flex-1 rounded-lg border border-blue-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={() => void redeemCardCode()}
                disabled={redeeming}
                className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {redeeming ? "闁稿繑鍨跺畷鍙夌▔?.." : "缂佹柨顑呭畵鍡涘礂閹寸偛搴?}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
  <div className="text-base font-semibold text-slate-800">付费与联系</div>
  <div className="mt-2 space-y-1.5 text-xs leading-6 text-slate-600">
    <div>1. 先联系平台管理员，确认开通项目（VIP 月数 / 点数）。</div>
    <div>2. 支付后获取卡密，在上方“卡密兑换”输入即可到账。</div>
    <div>3. 如需开通服务，请联系平台管理员获取开通方式。</div>
  </div>
  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
    当前版本已移除群聊与加好友快捷入口。
  </div>
</section>
        </div>
      )}
    </div>
  );
}
