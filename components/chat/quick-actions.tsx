"use client";

type QuickAction = {
  label: string;
  prompt: string;
  icon: string;
  color: string;
};

type QuickActionsProps = {
  actions?: QuickAction[];
  onSelect: (prompt: string) => void;
};

const defaultActions: QuickAction[] = [
  {
    label: "\u5e2e\u6211\u5199\u4f5c",
    prompt: "\u8bf7\u5e2e\u6211\u5199\u4e00\u6bb5\u5f00\u573a\u767d\u3002",
    icon: "W",
    color: "bg-blue-100 text-blue-700",
  },
  {
    label: "\u5e2e\u6211\u7eed\u5199",
    prompt: "\u8bf7\u5e2e\u6211\u7eed\u5199\u8fd9\u4e00\u6bb5\u5185\u5bb9\u3002",
    icon: "C",
    color: "bg-indigo-100 text-indigo-700",
  },
  {
    label: "\u5c0f\u8bf4\u751f\u6210",
    prompt: "\u751f\u6210\u4e00\u4e2a\u77ed\u7bc7\u5c0f\u8bf4\u7684\u5f00\u5934\u3002",
    icon: "N",
    color: "bg-blue-50 text-blue-600",
  },
  {
    label: "\u77ed\u6587\u5199\u4f5c",
    prompt: "\u5199\u4e00\u6bb5\u7b80\u77ed\u7684\u8bf4\u660e\u6587\u5b57\u3002",
    icon: "S",
    color: "bg-indigo-50 text-indigo-600",
  },
];

export default function QuickActions({
  actions = defaultActions,
  onSelect,
}: QuickActionsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => onSelect(action.prompt)}
          className="rounded-xl bg-slate-100/80 p-2.5 text-left transition hover:bg-slate-100"
        >
          <div
            className={`mb-2 flex h-7 w-7 items-center justify-center rounded-md ${action.color}`}
          >
            {action.icon}
          </div>
          <div className="text-[13px] font-semibold text-slate-800">{action.label}</div>
          <div className="mt-0.5 max-h-10 overflow-hidden text-[11px] text-slate-500">
            {action.prompt}
          </div>
        </button>
      ))}
    </div>
  );
}
