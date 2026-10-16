import type { Metadata } from "next";
import { CheckoutScreen } from "@/components/checkout/checkout-screen";
import {
  getDataModeStatus,
  isGuestReceiptRecoveryEnabled,
  isPublicOrderIntakeEnabled,
} from "@/lib/env/server";

export const metadata: Metadata = {
  title: "Finalizar pedido",
  description: "Completa tu pedido en pocos pasos.",
  robots: { index: false },
};

// La capacidad C2.2 es server-only y no debe quedar congelada en una página
// estática si cambia el interruptor de despliegue.
export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  const dataMode = getDataModeStatus();
  const publicOrderIntakeEnabled =
    dataMode.mode === "local" || isPublicOrderIntakeEnabled();
  return (
    <CheckoutScreen
      guestReceiptRecoveryEnabled={isGuestReceiptRecoveryEnabled()}
      publicOrderIntakeEnabled={publicOrderIntakeEnabled}
    />
  );
}
