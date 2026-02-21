import Link from "next/link";
import { redirect } from "next/navigation";

import { getAdminUser } from "@/lib/admin-auth";

const adminNav = [
  { href: "/admin", label: "仪表盘" },
  { href: "/admin/channels", label: "渠道管理" },
  { href: "/admin/roles", label: "角色管理" },
  { href: "/admin/extensions", label: "扩展管理" },
  { href: "/admin/users", label: "用户管理" },
  { href: "/admin/billing", label: "计费管理" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-[1500px] gap-5 p-5">
        <aside className="w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 text-lg font-semibold text-slate-800">管理后台</div>
          <nav className="flex flex-col gap-2">
            {adminNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {children}
        </main>
      </div>
    </div>
  );
}
