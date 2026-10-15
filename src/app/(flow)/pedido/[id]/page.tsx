import type { Metadata } from "next";
import { OrderConfirmationScreen } from "@/components/checkout/order-confirmation-screen";
import { isGuestReceiptRecoveryEnabled } from "@/lib/env/server";

export const metadata: Metadata = {
  title: "Confirmación de pedido",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <OrderConfirmationScreen
      orderId={id}
      guestReceiptRecoveryEnabled={isGuestReceiptRecoveryEnabled()}
    />
  );
}
