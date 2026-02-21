/* eslint-disable @next/next/no-page-custom-font */
import "./styles/tailwind.css";
import "./styles/globals.scss";
import "./styles/markdown.scss";
import "./styles/highlight.scss";
import { getClientConfig } from "./config/client";
import { APP_DESCRIPTION, APP_NAME } from "./config/branding";
import { getServerSideConfig } from "./config/server";
import type { Metadata, Viewport } from "next";
import { GoogleTagManager } from "@next/third-parties/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Providers from "./providers";

const serverConfig = getServerSideConfig();

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  appleWebApp: {
    title: APP_NAME,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edf6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1820" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const serializedConfig = JSON.stringify(getClientConfig()).replace(
    /</g,
    "\\u003c",
  );

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__BUILD_CONFIG__ = ${serializedConfig};`,
          }}
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <link rel="manifest" href="/site.webmanifest"></link>
        <script src="/serviceWorkerRegister.js" defer></script>
      </head>
      <body>
        <Providers>{children}</Providers>
        {serverConfig?.isVercel && (
          <>
            <SpeedInsights />
          </>
        )}
        {serverConfig?.gtmId && (
          <>
            <GoogleTagManager gtmId={serverConfig.gtmId} />
          </>
        )}
      </body>
    </html>
  );
}
