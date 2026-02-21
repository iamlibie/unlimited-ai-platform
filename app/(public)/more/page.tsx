export default function MorePage() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200 text-xs font-semibold text-slate-600">
          ...
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">更多</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
        <p className="text-sm leading-7 text-slate-600">
          这里预留后续功能入口，例如公告、活动、帮助与社区入口。
        </p>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          社区与联系方式暂未开放，后续会在这里统一发布。
        </div>
      </div>
    </div>
  );
}