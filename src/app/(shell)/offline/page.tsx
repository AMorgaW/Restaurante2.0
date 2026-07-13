import type { Metadata } from "next";
import { OfflineScreen } from "@/components/feedback/offline-screen";

export const metadata: Metadata = {
  title: "Sin conexión",
  robots: { index: false },
};

/** Página de respaldo servida por el service worker sin red. */
export default function OfflinePage() {
  return <OfflineScreen />;
}
