"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useChatStore } from "@/store/chat-store";

type Channel = {
  id: string;
  name: string;
  group: string;
  summary?: string | null;
  modelName: string;
  pricingTier?: "FREE" | "ADVANCED";
  vipOnly?: boolean;
  pricingEnabled?: boolean;
};

type FilterTab = "ALL" | "FREE" | "VIP";

const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: "ALL", label: "全部" },
  { id: "FREE", label: "普通通道" },
  { id: "VIP", label: "VIP 通道" },
];

const PANEL_GAP = 8;
const PANEL_MAX_WIDTH = 340;

function normalizeModelNames(models: string[]) {
  return Array.from(new Set(models.map((item) => item.trim()).filter(Boolean)));
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
      <path
        d="M5 12.5 9.1 16.4 19 7.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ModelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <rect x="4" y="5" width="16" height="3.4" rx="1.7" fill="currentColor" />
      <rect
        x="4"
        y="10.3"
        width="11"
        height="3.4"
        rx="1.7"
        fill="currentColor"
        opacity="0.85"
      />
      <rect
        x="4"
        y="15.6"
        width="13.5"
        height="3.4"
        rx="1.7"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

export default function ModelSelector() {
  const selectedChannelId = useChatStore((state) => state.selectedChannelId);
  const apiSettings = useChatStore((state) => state.apiSettings);
  const setApiSettings = useChatStore((state) => state.setApiSettings);
  const setSelectedChannelId = useChatStore((state) => state.setSelectedChannelId);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [mounted, setMounted] = useState(false);
  const [vipActive, setVipActive] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{
    top: number;
    left: number;
    width: number;
  }>({
    top: 0,
    left: 8,
    width: 312,
  });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/public/channels")
      .then((res) => res.json())
      .then((data) => {
        if (!active || !Array.isArray(data?.data)) return;
        setChannels((data.data as Channel[]).filter((item) => item.pricingEnabled !== false));
      })
      .catch(() => {
        if (active) setChannels([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/public/billing?peek=1", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active) return;
        setVipActive(Boolean(json?.data?.vip?.active));
      })
      .catch(() => {
        if (active) setVipActive(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedChannelId || !channels[0]) return;
    setSelectedChannelId(channels[0].id);
  }, [channels, selectedChannelId, setSelectedChannelId]);

  useEffect(() => {
    if (!open) return;

    const updatePanelPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const width = Math.min(PANEL_MAX_WIDTH, Math.max(280, rect.width));
      const maxLeft = Math.max(8, viewportWidth - width - 8);
      const left = Math.min(Math.max(8, rect.left), maxLeft);

      setPanelStyle({
        top: rect.bottom + PANEL_GAP,
        left,
        width,
      });
    };

    updatePanelPosition();

    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  useEffect(() => {
    if (vipActive) return;
    if (activeTab === "VIP") {
      setActiveTab("ALL");
    }
  }, [activeTab, vipActive]);

  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId) ?? channels[0];

  const customModel = (apiSettings.customModel ?? "").trim();
  const isCustomMode = Boolean(customModel);

  const customModels = useMemo(
    () =>
      normalizeModelNames([...(apiSettings.customModels ?? []), apiSettings.customModel ?? ""]),
    [apiSettings.customModel, apiSettings.customModels],
  );

  const officialChannels = useMemo(() => {
    if (vipActive) return channels;
    return channels.filter((channel) => (channel.pricingTier ?? "FREE") === "FREE");
  }, [channels, vipActive]);

  useEffect(() => {
    if (vipActive) return;
    if (!selectedChannelId) return;
    const current = channels.find((channel) => channel.id === selectedChannelId);
    if (!current) return;
    if ((current.pricingTier ?? "FREE") !== "ADVANCED") return;

    const fallback = officialChannels[0];
    if (fallback) {
      setSelectedChannelId(fallback.id);
    }
  }, [channels, officialChannels, selectedChannelId, setSelectedChannelId, vipActive]);

  const visibleOfficialChannels = useMemo(() => {
    if (activeTab === "ALL") return officialChannels;
    if (activeTab === "FREE") {
      return officialChannels.filter((channel) => (channel.pricingTier ?? "FREE") === "FREE");
    }
    return officialChannels.filter(
      (channel) => (channel.pricingTier ?? "FREE") === "ADVANCED" || Boolean(channel.vipOnly),
    );
  }, [activeTab, officialChannels]);

  const availableTabs = useMemo(() => {
    if (vipActive) return FILTER_TABS;
    return FILTER_TABS.filter((tab) => tab.id !== "VIP");
  }, [vipActive]);

  const triggerTitle = isCustomMode ? customModel : selectedChannel?.name || "选择模型";
  const triggerSubtitle = isCustomMode
    ? "自定义接口模型"
    : selectedChannel?.summary?.trim() || selectedChannel?.modelName || "官方接口";

  const panelNode =
    mounted && open
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-[320] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg"
            style={{
              top: `${panelStyle.top}px`,
              left: `${panelStyle.left}px`,
              width: `${panelStyle.width}px`,
            }}
          >
            <div className="border-b border-gray-100 px-2 py-1.5">
              <div className="flex flex-wrap gap-1">
                {availableTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-full border px-2 py-0.5 text-[10px] leading-4 transition ${
                      activeTab === tab.id
                        ? "border-blue-300 text-blue-600"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-b border-blue-100 bg-blue-50 px-2 py-1.5">
              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold text-blue-700">
                  {isCustomMode ? "当前为本地自定义接口" : "当前为官方接口"}
                </div>
                <div className="truncate text-[10px] text-blue-600">
                  {isCustomMode
                    ? "使用你自己的 API Key，不扣平台点数"
                    : "官方模型按后台计费规则扣费"}
                </div>
              </div>
            </div>

            <div className="max-h-[68vh] overflow-y-auto py-1">
              {customModels.length > 0 && (
                <>
                  <div className="px-2 pb-1 pt-1 text-[11px] text-gray-400">自定义接口</div>
                  {customModels.map((modelName) => {
                    const selected = isCustomMode && modelName === customModel;
                    return (
                      <button
                        key={modelName}
                        type="button"
                        onClick={() => {
                          setApiSettings({
                            customModel: modelName,
                            customModels,
                          });
                          setOpen(false);
                        }}
                        className={`flex w-full items-center justify-between px-2 py-1.5 text-left transition ${
                          selected ? "bg-blue-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-gray-900">
                            {modelName}
                          </div>
                          <div className="truncate text-[11px] text-gray-500">
                            本地模型（不上传第三方密钥）
                          </div>
                        </div>
                        {selected && (
                          <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                            <CheckIcon />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}

              <div className="px-2 pb-1 pt-1 text-[11px] text-gray-400">官方接口</div>
              {visibleOfficialChannels.map((channel) => {
                const selected = !isCustomMode && channel.id === selectedChannel?.id;
                const subTitle =
                  channel.summary?.trim() ||
                  `${channel.modelName}${
                    channel.pricingTier === "ADVANCED" ? " | VIP 模型" : ""
                  }`;

                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => {
                      setSelectedChannelId(channel.id);
                      setApiSettings({ customModel: "" });
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-2 py-1.5 text-left transition ${
                      selected ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-gray-900">
                        {channel.name}
                      </div>
                      <div className="truncate text-[11px] text-gray-500">{subTitle}</div>
                    </div>
                    {selected && (
                      <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                        <CheckIcon />
                      </span>
                    )}
                  </button>
                );
              })}

              {visibleOfficialChannels.length === 0 && (
                <div className="px-2 py-2 text-xs text-gray-500">
                  {vipActive ? "当前分类暂无可用模型" : "当前账号仅显示普通模型"}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full max-w-[320px] min-w-[208px] items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-2 py-1.5 transition hover:border-blue-300"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <ModelIcon />
          </div>
          <div className="min-w-0 text-left">
            <div className="truncate text-[13px] font-semibold text-gray-900">{triggerTitle}</div>
            <div className="truncate text-[11px] text-gray-500">{triggerSubtitle}</div>
          </div>
        </div>
        <span className="ml-2 text-xs text-gray-400">{open ? "▴" : "▾"}</span>
      </button>
      {panelNode}
    </>
  );
}
