import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { resolveRoleUploadWriteRoot } from "./role-upload";

export type PricingDisplayConfig = {
  vipMonthlyPrice: number;
  vipQuarterlyPrice: number;
  vipYearlyPrice: number;
  pointsPerYuan: number;
  updatedAt: string;
};

const DEFAULT_PRICING_DISPLAY: PricingDisplayConfig = {
  vipMonthlyPrice: 9.9,
  vipQuarterlyPrice: 27,
  vipYearlyPrice: 108,
  pointsPerYuan: 20,
  updatedAt: new Date(0).toISOString(),
};

function normalizeMoney(value: unknown, fallback: number) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(0, Math.min(99999, Math.round(next * 100) / 100));
}

function normalizePointsPerYuan(value: unknown, fallback: number) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(1, Math.min(100000, Math.floor(next)));
}

async function resolvePricingDisplayFilePath() {
  const uploadRoot = await resolveRoleUploadWriteRoot();
  const configDir = path.join(uploadRoot, "system");
  await mkdir(configDir, { recursive: true });
  return path.join(configDir, "pricing-display.json");
}

function normalizePricingDisplay(raw: any): PricingDisplayConfig {
  return {
    vipMonthlyPrice: normalizeMoney(
      raw?.vipMonthlyPrice,
      DEFAULT_PRICING_DISPLAY.vipMonthlyPrice,
    ),
    vipQuarterlyPrice: normalizeMoney(
      raw?.vipQuarterlyPrice,
      DEFAULT_PRICING_DISPLAY.vipQuarterlyPrice,
    ),
    vipYearlyPrice: normalizeMoney(
      raw?.vipYearlyPrice,
      DEFAULT_PRICING_DISPLAY.vipYearlyPrice,
    ),
    pointsPerYuan: normalizePointsPerYuan(
      raw?.pointsPerYuan,
      DEFAULT_PRICING_DISPLAY.pointsPerYuan,
    ),
    updatedAt:
      typeof raw?.updatedAt === "string" && raw.updatedAt.trim()
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

export async function readPricingDisplayConfig(): Promise<PricingDisplayConfig> {
  try {
    const filePath = await resolvePricingDisplayFilePath();
    const raw = await readFile(filePath, "utf8");
    return normalizePricingDisplay(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PRICING_DISPLAY };
  }
}

export async function writePricingDisplayConfig(
  input: Partial<PricingDisplayConfig>,
): Promise<PricingDisplayConfig> {
  const current = await readPricingDisplayConfig();
  const next = normalizePricingDisplay({
    ...current,
    ...input,
    updatedAt: new Date().toISOString(),
  });
  const filePath = await resolvePricingDisplayFilePath();
  await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}
