import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function getAdminUser() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string } | undefined;

  if (!sessionUser?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      role: true,
      status: true,
    },
  });

  if (!user || user.status !== "ACTIVE" || user.role !== "ADMIN") {
    return null;
  }

  return {
    id: user.id,
    role: user.role,
  };
}
