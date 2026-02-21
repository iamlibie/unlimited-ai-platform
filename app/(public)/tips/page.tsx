const tips = [
  "\u5148\u5728\u201c\u81ea\u5b9a\u4e49 API \u4e2d\u5fc3\u201d\u914d\u7f6e\u6e20\u9053\u53c2\u6570\uff0c\u518d\u5f00\u59cb\u6b63\u5f0f\u5bf9\u8bdd\u3002",
  "\u5728\u201c\u5bf9\u8bdd\u62d3\u5c55\u5e93\u201d\u5f00\u542f\u6269\u5c55\u540e\uff0c\u7cfb\u7edf\u4f1a\u81ea\u52a8\u6ce8\u5165\u589e\u5f3a\u63d0\u793a\u8bcd\u3002",
  "\u5728\u201c\u89d2\u8272\u5361\u5546\u57ce\u201d\u9009\u62e9\u89d2\u8272\uff0c\u7cfb\u7edf\u4f1a\u81ea\u52a8\u4ee5\u89d2\u8272\u8bbe\u5b9a\u5f00\u542f\u65b0\u4f1a\u8bdd\u3002",
  "\u201c\u6211\u7684\u52a9\u624b\u201d\u53ef\u67e5\u770b\u5e76\u7ee7\u7eed\u5386\u53f2\u4f1a\u8bdd\uff0c\u907f\u514d\u4e0a\u4e0b\u6587\u4e22\u5931\u3002",
];

export default function TipsPage() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-sm font-semibold text-slate-600 shadow-sm">
          TIP
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {"\u4f7f\u7528\u6280\u5de7\u4e0e\u8bf4\u660e"}
        </h1>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-7 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
        <ul className="space-y-4 text-lg leading-8 text-slate-600">
          {tips.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-2 h-2 w-2 rounded-full bg-slate-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

