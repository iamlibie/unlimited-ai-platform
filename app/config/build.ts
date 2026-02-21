import { DEFAULT_INPUT_TEMPLATE } from "../constant";

function resolveAppVersion() {
  try {
    const fs = require("fs");
    const path = require("path");
    const tauriPath = path.join(process.cwd(), "src-tauri", "tauri.conf.json");
    if (fs.existsSync(tauriPath)) {
      const tauriConfig = JSON.parse(fs.readFileSync(tauriPath, "utf-8"));
      const version = tauriConfig?.package?.version;
      if (version) return String(version);
    }

    const pkgPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const version = pkg?.version;
      if (version) return String(version);
    }
  } catch (e) {
    console.error("[Build Config] Failed to resolve version:", e);
  }

  return process.env.APP_VERSION || "0.0.0";
}

export const getBuildConfig = () => {
  if (typeof process === "undefined") {
    throw Error(
      "[Server Config] you are importing a nodejs-only module outside of nodejs",
    );
  }

  const buildMode = process.env.BUILD_MODE ?? "standalone";
  const isApp = !!process.env.BUILD_APP;
  const version = "v" + resolveAppVersion();

  const commitInfo = (() => {
    try {
      const childProcess = require("child_process");
      const commitDate: string = childProcess
        .execSync('git log -1 --format="%at000" --date=unix')
        .toString()
        .trim();
      const commitHash: string = childProcess
        .execSync('git log --pretty=format:"%H" -n 1')
        .toString()
        .trim();

      return { commitDate, commitHash };
    } catch (e) {
      console.error("[Build Config] No git or not from git repo.");
      return {
        commitDate: "unknown",
        commitHash: "unknown",
      };
    }
  })();

  return {
    version,
    ...commitInfo,
    buildMode,
    isApp,
    template: process.env.DEFAULT_INPUT_TEMPLATE ?? DEFAULT_INPUT_TEMPLATE,
  };
};

export type BuildConfig = ReturnType<typeof getBuildConfig>;
