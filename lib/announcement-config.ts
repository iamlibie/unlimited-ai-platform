import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { resolveRoleUploadWriteRoot } from "./role-upload";

export type AnnouncementConfig = {
  enabled: boolean;
  title: string;
  content: string;
  updatedAt: string;
};

const DEFAULT_ANNOUNCEMENT: AnnouncementConfig = {
  enabled: false,
  title: "平台公告",
  content: "",
  updatedAt: new Date(0).toISOString(),
};

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

async function resolveAnnouncementFilePath() {
  const uploadRoot = await resolveRoleUploadWriteRoot();
  const configDir = path.join(uploadRoot, "system");
  await mkdir(configDir, { recursive: true });
  return path.join(configDir, "announcement.json");
}

function normalizeAnnouncement(raw: any): AnnouncementConfig {
  const title = sanitizeText(raw?.title, 80) || DEFAULT_ANNOUNCEMENT.title;
  const content = sanitizeText(raw?.content, 5000);
  const enabled = Boolean(raw?.enabled);
  const updatedAtValue = sanitizeText(raw?.updatedAt, 64);
  const updatedAt = updatedAtValue || new Date().toISOString();

  return {
    enabled,
    title,
    content,
    updatedAt,
  };
}

export async function readAnnouncementConfig(): Promise<AnnouncementConfig> {
  try {
    const filePath = await resolveAnnouncementFilePath();
    const raw = await readFile(filePath, "utf8");
    return normalizeAnnouncement(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_ANNOUNCEMENT };
  }
}

export async function writeAnnouncementConfig(
  input: Partial<AnnouncementConfig>,
): Promise<AnnouncementConfig> {
  const current = await readAnnouncementConfig();
  const next = normalizeAnnouncement({
    ...current,
    ...input,
    updatedAt: new Date().toISOString(),
  });
  const filePath = await resolveAnnouncementFilePath();
  await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}
