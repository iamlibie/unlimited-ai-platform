import type { ReactNode } from "react";

import MobileTopbar from "@/components/layout/mobile-topbar";
import Sidebar from "@/components/layout/sidebar";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-blue-50 text-slate-900 lg:h-screen lg:overflow-hidden">
      <div className="flex min-h-screen lg:h-full lg:min-h-0">
        <Sidebar />
        <main className="min-w-0 flex flex-1 flex-col bg-slate-50 lg:min-h-0">
          <MobileTopbar />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto h-[calc(100dvh-44px)] w-full max-w-[1240px] lg:h-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
