import type { Metadata } from "next";
import { CartScreen } from "@/components/cart/cart-screen";
import { menuItems } from "@/data/menu";

export const metadata: Metadata = {
  title: "Carrito",
  description: "Revisa tu pedido antes de continuar.",
  robots: { index: false },
};

export default function CartPage() {
  return <CartScreen menuItems={menuItems} />;
}
