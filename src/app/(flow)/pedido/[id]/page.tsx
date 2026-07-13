import type { Metadata } from "next";
import { OrderConfirmationScreen } from "@/components/checkout/order-confirmation-screen";

export const metadata: Metadata = {
  title: "Confirmación de pedido",
  robots: { index: false },
};

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderConfirmationScreen orderId={id} />;
}
