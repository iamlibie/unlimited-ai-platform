import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { verifyCaptchaChallenge } from "@/lib/captcha";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const captcha = typeof body?.captcha === "string" ? body.captcha : "";
  const captchaToken =
    typeof body?.captchaToken === "string" ? body.captchaToken : "";

  if (!email || !password) {
    return NextResponse.json({ error: "邮箱和密码不能为空" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
  }

  if (!verifyCaptchaChallenge(captchaToken, captcha)) {
    return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "邮箱已注册" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash,
      role: "USER",
      status: "ACTIVE",
    },
  });

  return NextResponse.json({ ok: true });
}
