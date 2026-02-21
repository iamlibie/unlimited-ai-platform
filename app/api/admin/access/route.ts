import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getAdminUser();
  return NextResponse.json({
    data: {
      isAdmin: Boolean(admin),
    },
  });
}
