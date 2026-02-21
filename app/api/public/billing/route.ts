import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { getBillingStatusWithOptions } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const peek = url.searchParams.get("peek") === "1";
  const data = await getBillingStatusWithOptions(
    userId,
    { applyDailyLoginBonus: !peek },
  );
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
