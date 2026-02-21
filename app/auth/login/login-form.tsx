"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const navigateWithReload = (targetPath: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(targetPath);
      return;
    }
    router.replace(targetPath);
  };

  const ensureSessionAndRedirect = async (targetPath: string) => {
    for (let i = 0; i < 6; i += 1) {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        const session = await res.json();
        if (session?.user) {
          navigateWithReload(targetPath);
          return true;
        }
      } catch {
        // ignore
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  };

  const getCallbackUrl = () => {
    if (typeof window === "undefined") return "/";
    return `${window.location.origin}/`;
  };

  const getSafeRedirectPath = (url?: string | null) => {
    if (!url) return "/";
    try {
      const parsed = new URL(url, window.location.origin);
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
    } catch {
      return "/";
    }
  };

  const loadCaptcha = async () => {
    setCaptchaLoading(true);
    try {
      const res = await fetch("/api/auth/captcha", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      const data = json?.data;
      if (!res.ok || typeof data?.token !== "string" || typeof data?.image !== "string") {
        throw new Error("captcha_failed");
      }
      setCaptchaToken(data.token);
      setCaptchaImage(data.image);
      setCaptcha("");
    } catch {
      setCaptchaToken("");
      setCaptchaImage("");
    } finally {
      setCaptchaLoading(false);
    }
  };

  useEffect(() => {
    void loadCaptcha();
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const captchaInput = captcha.trim();
    if (!captchaInput || !captchaToken) {
      setError("请先输入验证码");
      setLoading(false);
      void loadCaptcha();
      return;
    }

    try {
      const result = await signIn("credentials", {
        email,
        password,
        captcha: captchaInput,
        captchaToken,
        redirect: false,
        callbackUrl: getCallbackUrl(),
      });

      if (result?.error) {
        setError("邮箱、密码或验证码错误");
        void loadCaptcha();
        return;
      }

      const safePath = getSafeRedirectPath(result?.url);
      const hasSession = await ensureSessionAndRedirect(safePath || "/");
      if (hasSession) return;

      navigateWithReload(safePath || "/");
    } catch {
      const hasSession = await ensureSessionAndRedirect("/");
      if (hasSession) return;
      setError("登录失败，请重试");
      void loadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium text-slate-700">邮箱</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-indigo-300"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">密码</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-indigo-300"
          placeholder="请输入密码"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">验证码</label>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-[56px] w-[160px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {captchaImage ? (
              <img src={captchaImage} alt="验证码" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                加载中...
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => void loadCaptcha()}
            disabled={captchaLoading}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            换一张
          </button>
        </div>
        <input
          type="text"
          value={captcha}
          onChange={(event) => setCaptcha(event.target.value.toUpperCase())}
          required
          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm uppercase tracking-[0.2em] outline-none focus:border-indigo-300"
          placeholder="请输入验证码"
        />
      </div>

      {error && <div className="text-sm text-red-500">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "登录中..." : "登录"}
      </button>

      <div className="text-center text-sm text-slate-500">
        还没有账号？
        <Link href="/auth/register" className="ml-1 text-indigo-500">
          去注册
        </Link>
      </div>
    </form>
  );
}
