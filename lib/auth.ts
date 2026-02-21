import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { verifyCaptchaChallenge } from "./captcha";
import { prisma } from "./db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Username", type: "text" },
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        captcha: { label: "Captcha", type: "text" },
        captchaToken: { label: "Captcha Token", type: "text" },
      },
      async authorize(credentials) {
        const identifier =
          credentials?.identifier?.trim() || credentials?.email?.trim() || "";
        const password = credentials?.password ?? "";
        const captcha = typeof credentials?.captcha === "string" ? credentials.captcha : "";
        const captchaToken =
          typeof credentials?.captchaToken === "string" ? credentials.captchaToken : "";

        if (!identifier || !password) return null;
        if (!verifyCaptchaChallenge(captchaToken, captcha)) return null;

        const user = await prisma.user.findFirst({
          where: {
            OR: [{ email: identifier }, { name: identifier }],
          },
        });

        if (!user) return null;
        if (user.status !== "ACTIVE") return null;

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name ?? user.email,
          email: user.email,
          role: user.role,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as any).id = (user as any).id;
        (token as any).role = (user as any).role;
      }

      const tokenUserId = (token as any)?.id as string | undefined;
      if (tokenUserId) {
        const latestUser = await prisma.user.findUnique({
          where: { id: tokenUserId },
          select: { role: true, name: true, email: true },
        });

        if (latestUser) {
          (token as any).role = latestUser.role;
          (token as any).name = latestUser.name ?? latestUser.email;
          (token as any).email = latestUser.email;
        }
      }
      return token;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return url;
      try {
        const parsed = new URL(url);
        if (parsed.origin === baseUrl) {
          return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
        }
      } catch {
        // ignored
      }
      return "/";
    },
    async session({ session, token, user }) {
      if (session.user) {
        const sessionUser = session.user as {
          id?: string;
          role?: string;
        };
        sessionUser.id = (user as any)?.id ?? (token as any)?.id;
        sessionUser.role = (user as any)?.role ?? (token as any)?.role;
      }
      return session;
    },
  },
};
