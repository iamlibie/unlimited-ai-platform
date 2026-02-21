"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ChangeEvent,
  type FormEvent,
} from "react";

type ChatInputProps = {
  input: string;
  onInputChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isLoading?: boolean;
};

export default function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isLoading,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const placeholder =
    "\u53d1\u9001\u6d88\u606f\uff08Enter \u53d1\u9001\uff0cShift+Enter \u6362\u884c\uff09";

  const resizeTextarea = useCallback((target?: HTMLTextAreaElement) => {
    const textarea = target ?? textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches;
    const maxHeight = isMobile ? 132 : 220;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${Math.max(42, nextHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl bg-white px-2.5 pb-2 pt-2 shadow-[0_10px_26px_rgba(15,23,42,0.08)]"
    >
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(event) => {
          onInputChange(event);
          resizeTextarea(event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder={placeholder}
        rows={1}
        className="w-full resize-none border-none bg-transparent px-1.5 pb-0.5 text-[14px] leading-5 text-slate-700 outline-none placeholder:text-slate-400"
      />

      <div className="mt-1 flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-blue-600"
            aria-label={"\u9644\u4ef6"}
          >
            +
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-blue-600"
            aria-label={"\u8bbe\u7f6e"}
          >
            *
          </button>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_6px_16px_rgba(41,69,87,0.24)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={"\u53d1\u9001"}
        >
          {">"}
        </button>
      </div>
    </form>
  );
}
