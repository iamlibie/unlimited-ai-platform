import { prisma } from "@/lib/db";

export default async function AdminDashboardPage() {
  const [userCount, channelCount, roleCount, extensionCount] = await Promise.all([
    prisma.user.count(),
    prisma.channel.count(),
    prisma.roleMarket.count(),
    prisma.extension.count(),
  ]);

  const cards = [
    { label: "用户总数", value: userCount },
    { label: "渠道总数", value: channelCount },
    { label: "角色总数", value: roleCount },
    { label: "扩展总数", value: extensionCount },
  ];

  return (
    <div className="space-y-5">
      <div className="text-2xl font-semibold text-slate-900">后台仪表盘</div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="text-sm text-slate-500">{item.label}</div>
            <div className="mt-2 text-3xl font-semibold text-slate-800">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        当前后台支持：用户状态管理、渠道管理、角色管理、扩展管理。
      </div>
    </div>
  );
}
