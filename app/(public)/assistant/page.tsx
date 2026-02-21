import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

function summarizeContent(content: unknown) {
  if (typeof content === "string") return content;
  if (typeof content === "number") return String(content);
  if (content && typeof content === "object") {
    const text = (content as { text?: string }).text;
    if (typeof text === "string") return text;
  }
  try {
    return JSON.stringify(content);
  } catch {
    return "";
  }
}

export default async function AssistantPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return (
      <div className="mx-auto mt-10 flex h-[70vh] w-full max-w-[1100px] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
        <div className="text-3xl font-semibold text-slate-800">{"\u8bf7\u5148\u767b\u5f55"}</div>
        <Link
          href="/auth/login"
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(41,69,87,0.2)]"
        >
          {"\u524d\u5f80\u767b\u5f55"}
        </Link>
      </div>
    );
  }

  const chats = await prisma.chat.findMany({
    where: { userId },
    include: {
      role: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-sm font-semibold text-blue-600 shadow-sm">
            AI
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{"\u6211\u7684\u52a9\u624b"}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-2xl bg-blue-600 px-5 py-2.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(41,69,87,0.2)]"
          >
            {"AI \u751f\u6210"}
          </button>
          <Link
            href="/"
            className="rounded-2xl bg-blue-600 px-5 py-2.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(41,69,87,0.2)]"
          >
            {"+ \u65b0\u5efa\u52a9\u624b"}
          </Link>
        </div>
      </div>

      {chats.length === 0 ? (
        <div className="flex h-[64vh] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white text-center shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-3xl border border-blue-100 bg-blue-50 text-3xl font-semibold text-blue-500">
            AI
          </div>
          <div className="text-3xl font-semibold text-slate-800">{"\u8fd8\u6ca1\u6709\u521b\u5efa\u52a9\u624b"}</div>
          <div className="mt-3 max-w-lg text-base leading-7 text-slate-500">
            {
              "\u521b\u5efa\u60a8\u7684\u4e13\u5c5e AI \u52a9\u624b\uff0c\u9884\u8bbe\u72ec\u7279\u7684\u4eba\u8bbe\u548c\u6307\u4ee4\uff0c\u8ba9\u5bf9\u8bdd\u66f4\u9ad8\u6548\u3001\u66f4\u6709\u8da3\u3002"
            }
          </div>
          <Link
            href="/market"
            className="mt-6 rounded-2xl bg-blue-600 px-10 py-3 text-base font-semibold text-white shadow-[0_8px_20px_rgba(41,69,87,0.2)]"
          >
            {"\u7acb\u5373\u521b\u5efa"}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {chats.map((chat) => {
            const title = chat.title || chat.role?.name || "\u672a\u547d\u540d\u5bf9\u8bdd";
            const summary = chat.messages[0]
              ? summarizeContent(chat.messages[0].content).slice(0, 90)
              : "\u6682\u65e0\u6d88\u606f";
            const params = new URLSearchParams({
              chatId: chat.id,
              title,
            });
            if (chat.roleId) params.set("roleId", chat.roleId);
            const href = `/?${params.toString()}`;

            return (
              <Link
                key={chat.id}
                href={href}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_12px_26px_rgba(59,130,246,0.14)]"
              >
                <div className="text-2xl font-semibold text-slate-800">{title}</div>
                <div className="mt-2 text-sm text-slate-400">
                  {chat.updatedAt.toLocaleString("zh-CN")}
                </div>
                <div className="mt-3 max-h-16 overflow-hidden text-sm text-slate-500">{summary}</div>
                <div className="mt-4 text-xs text-slate-400">
                  {chat.role?.name
                    ? `\u89d2\u8272\uff1a${chat.role.name}`
                    : "\u901a\u7528\u4f1a\u8bdd"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
