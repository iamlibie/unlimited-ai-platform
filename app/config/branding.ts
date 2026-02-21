const DEFAULT_APP_NAME = "Unlimited AI";
const DEFAULT_APP_LOGO_TEXT = "AI";
const DEFAULT_APP_DESCRIPTION = "Unlimited AI 智能对话平台";

function withFallback(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export const APP_NAME = withFallback(
  process.env.NEXT_PUBLIC_APP_NAME,
  DEFAULT_APP_NAME,
);
export const APP_LOGO_TEXT = withFallback(
  process.env.NEXT_PUBLIC_APP_LOGO_TEXT,
  DEFAULT_APP_LOGO_TEXT,
).slice(0, 4);
export const APP_DESCRIPTION = withFallback(
  process.env.NEXT_PUBLIC_APP_DESCRIPTION,
  DEFAULT_APP_DESCRIPTION,
);
