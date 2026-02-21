"use client";

import { useEffect, useMemo, useState } from "react";

type VipSubscription = {
  id: string;
  active: boolean;
  expiresAt: string;
  monthlyQuota: number;
  monthlyUsed: number;
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "USER";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  createdAt: string;
  wallet: {
    stamina: number;
  } | null;
  vipSubscriptions: VipSubscription[];
};

export default function UsersManager() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [creditInput, setCreditInput] = useState<Record<string, number>>({});
  const [vipMonthsInput, setVipMonthsInput] = useState<Record<string, number>>({});
  const [vipQuotaInput, setVipQuotaInput] = useState<Record<string, number>>({});

  async function fetchRows() {
    setLoading(true);
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setRows(Array.isArray(json?.data) ? json.data : []);
    setLoading(false);
  }

  useEffect(() => {
    void fetchRows();
  }, []);

  const orderedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.role !== b.role) return a.role === "ADMIN" ? -1 : 1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  }, [rows]);

  async function updateUser(id: string, payload: Record<string, unknown>) {
    setSavingUserId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "更新失败");
      }

      await fetchRows();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失败");
      return false;
    } finally {
      setSavingUserId(null);
    }
  }

  async function grantCredits(id: string) {
    const amount = Math.floor(creditInput[id] ?? 0);
    if (amount <= 0) {
      setMessage("发放点数必须大于 0");
      return;
    }
    const ok = await updateUser(id, {
      action: "grant_credits",
      amount,
    });
    if (!ok) return;
    setCreditInput((prev) => ({ ...prev, [id]: 0 }));
    setMessage("点数发放成功");
  }

  async function grantVip(id: string) {
    const months = Math.max(1, Math.floor(vipMonthsInput[id] ?? 1));
    const monthlyQuota = Math.max(0, Math.floor(vipQuotaInput[id] ?? 200));
    const ok = await updateUser(id, {
      action: "grant_vip",
      months,
      monthlyQuota,
    });
    if (!ok) return;
    setMessage("VIP 发放成功");
  }

  return (
    <div className="space-y-5">
      <div className="text-2xl font-semibold text-slate-900">用户管理</div>

      {loading ? (
        <div className="text-sm text-slate-500">加载中...</div>
      ) : (
        <div className="space-y-3">
          {orderedRows.map((row) => {
            const vip = row.vipSubscriptions[0];
            const vipRemaining = vip ? Math.max(0, vip.monthlyQuota - vip.monthlyUsed) : 0;

            return (
              <div
                key={row.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="text-sm font-semibold text-slate-800">{row.email}</div>
                  <div className="text-xs text-slate-500">{row.name || "未命名"}</div>
                  <div className="text-xs text-slate-500">
                    注册时间：{new Date(row.createdAt).toLocaleString("zh-CN")}
                  </div>
                  <div className="text-xs text-slate-500">
                    点数：{row.wallet?.stamina ?? 0}
                  </div>
                  <div className="text-xs text-slate-500">
                    VIP：
                    {vip?.active
                      ? `生效中（余量 ${vipRemaining}/${vip.monthlyQuota}，到期 ${new Date(vip.expiresAt).toLocaleDateString("zh-CN")}）`
                      : "未开通"}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div>
                    <label className="text-xs text-slate-500">角色</label>
                    <select
                      value={row.role}
                      onChange={(event) =>
                        void updateUser(row.id, {
                          role: event.target.value as UserRow["role"],
                        })
                      }
                      className="mt-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    >
                      <option value="USER">普通用户</option>
                      <option value="ADMIN">管理员</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-500">状态</label>
                    <select
                      value={row.status}
                      onChange={(event) =>
                        void updateUser(row.id, {
                          status: event.target.value as UserRow["status"],
                        })
                      }
                      className="mt-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    >
                      <option value="ACTIVE">正常</option>
                      <option value="SUSPENDED">暂停</option>
                      <option value="BANNED">封禁</option>
                    </select>
                  </div>

                  <div className="ml-2">
                    <label className="text-xs text-slate-500">发放点数</label>
                    <input
                      type="number"
                      min={1}
                      value={creditInput[row.id] ?? 0}
                      onChange={(event) =>
                        setCreditInput((prev) => ({
                          ...prev,
                          [row.id]: Number(event.target.value) || 0,
                        }))
                      }
                      className="mt-1 w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void grantCredits(row.id)}
                    disabled={savingUserId === row.id}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 disabled:opacity-60"
                  >
                    发放点数
                  </button>

                  <div className="ml-2">
                    <label className="text-xs text-slate-500">VIP 月数</label>
                    <input
                      type="number"
                      min={1}
                      value={vipMonthsInput[row.id] ?? 1}
                      onChange={(event) =>
                        setVipMonthsInput((prev) => ({
                          ...prev,
                          [row.id]: Number(event.target.value) || 1,
                        }))
                      }
                      className="mt-1 w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">VIP 月配额</label>
                    <input
                      type="number"
                      min={0}
                      value={vipQuotaInput[row.id] ?? 200}
                      onChange={(event) =>
                        setVipQuotaInput((prev) => ({
                          ...prev,
                          [row.id]: Number(event.target.value) || 0,
                        }))
                      }
                      className="mt-1 w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void grantVip(row.id)}
                    disabled={savingUserId === row.id}
                    className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700 disabled:opacity-60"
                  >
                    发放 VIP
                  </button>
                </div>
              </div>
            );
          })}
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
