import type { Metadata } from "next";
import { CheckoutScreen } from "@/components/checkout/checkout-screen";

export const metadata: Metadata = {
  title: "Finalizar pedido",
  description: "Completa tu pedido en pocos pasos.",
  robots: { index: false },
};

export default function CheckoutPage() {
  return <CheckoutScreen />;
}
