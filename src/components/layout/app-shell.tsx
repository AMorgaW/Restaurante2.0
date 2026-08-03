import type { ReactNode } from "react";
import { Footer } from "@/components/layout/footer";
import { MobileHeader } from "@/components/layout/mobile-header";
import { SkipLink } from "@/components/ui/skip-link";
import { OfflineBanner } from "@/components/ui/states";

/** Shell sin navegación persistente: el menú es la puerta de exploración. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <OfflineBanner />
      <MobileHeader />
      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 md:px-6">
        {children}
      </main>
      <Footer />
    </div>
  );
}
