import { mkdir, stat } from "fs/promises";
import path from "path";

export type RoleUploadBucket = "role-avatars" | "role-backgrounds";

const ALLOWED_BUCKETS = new Set<RoleUploadBucket>([
  "role-avatars",
  "role-backgrounds",
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg"]);
const SAFE_FILE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

function toAbsolutePath(value: string) {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function uniquePaths(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    if (!value) return;
    const normalized = path.normalize(value);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

function configuredUploadRoot() {
  const value = process.env.ROLE_UPLOAD_DIR?.trim() || process.env.UPLOAD_DIR?.trim();
  if (!value) return null;
  return toAbsolutePath(value);
}

export function getRoleUploadWriteRootCandidates() {
  const cwd = process.cwd();

  return uniquePaths([
    configuredUploadRoot(),
    path.resolve(cwd, "..", "..", "uploads"),
    path.resolve(cwd, "..", "uploads"),
    path.resolve(cwd, "uploads"),
  ]);
}

export async function resolveRoleUploadWriteRoot() {
  const candidates = getRoleUploadWriteRootCandidates();

  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isDirectory()) {
        return candidate;
      }
    } catch {
      // skip non-existing candidate
    }
  }

  const cwd = process.cwd();
  const normalizedCwd = cwd.replace(/\\/g, "/");
  const runningStandalone = normalizedCwd.endsWith("/.next/standalone");

  const createCandidates = uniquePaths([
    configuredUploadRoot(),
    runningStandalone ? path.resolve(cwd, "..", "..", "uploads") : null,
    path.resolve(cwd, "uploads"),
  ]);
  let lastError: unknown = null;

  for (const candidate of createCandidates) {
    try {
      await mkdir(candidate, { recursive: true });
      return candidate;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Unable to create upload directory");
}

export async function resolveRoleUploadDir(bucket: RoleUploadBucket) {
  if (!ALLOWED_BUCKETS.has(bucket)) {
    throw new Error("Invalid role upload bucket");
  }

  const root = await resolveRoleUploadWriteRoot();
  const target = path.join(root, bucket);
  await mkdir(target, { recursive: true });
  return target;
}

export function buildRoleUploadUrl(bucket: RoleUploadBucket, fileName: string) {
  return `/uploads/${bucket}/${fileName}`;
}

export function parseRoleUploadAssetPath(segments: string[] | undefined | null) {
  if (!Array.isArray(segments) || segments.length !== 2) {
    return null;
  }

  const [bucket, fileName] = segments;

  if (!ALLOWED_BUCKETS.has(bucket as RoleUploadBucket)) {
    return null;
  }

  if (!SAFE_FILE_NAME_PATTERN.test(fileName)) {
    return null;
  }

  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return null;
  }

  return {
    bucket: bucket as RoleUploadBucket,
    fileName,
  };
}

export async function getRoleUploadReadRoots() {
  const writeRoot = await resolveRoleUploadWriteRoot();
  const cwd = process.cwd();

  return uniquePaths([
    writeRoot,
    path.resolve(cwd, "public", "uploads"),
    path.resolve(cwd, ".next", "standalone", "public", "uploads"),
    path.resolve(cwd, "..", "public", "uploads"),
    path.resolve(cwd, "..", "..", "public", "uploads"),
  ]);
}
