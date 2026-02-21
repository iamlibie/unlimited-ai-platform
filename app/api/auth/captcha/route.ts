import { NextResponse } from "next/server";

import { createCaptchaChallenge } from "@/lib/captcha";

export const runtime = "nodejs";

export async function GET() {
  const challenge = createCaptchaChallenge();
  return NextResponse.json(
    { data: challenge },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}
