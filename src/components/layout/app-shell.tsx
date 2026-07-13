import type { ReactNode } from "react";
import { Footer } from "@/components/layout/footer";
import { MobileHeader } from "@/components/layout/mobile-header";
import { BottomNavigation } from "@/components/navigation/bottom-navigation";
import { SkipLink } from "@/components/ui/skip-link";
import { OfflineBanner } from "@/components/ui/states";

/**
 * Estructura común de las páginas públicas: skip link, header superior,
 * contenido principal con compensación de la navegación inferior, pie
 * con enlaces legales y la navegación móvil.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <OfflineBanner />
      <MobileHeader />
      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 pb-bottom-nav md:px-6 md:pb-0">
        {children}
      </main>
      <div className="pb-bottom-nav md:pb-0">
        <Footer />
      </div>
      <BottomNavigation />
    </div>
  );
}
