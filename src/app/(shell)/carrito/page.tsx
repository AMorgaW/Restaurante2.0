import type { Metadata } from "next";
import { CartScreen } from "@/components/cart/cart-screen";
import { EmptyState } from "@/components/ui/states";
import { loadPublicCatalog } from "@/server/catalog/load-public-catalog";
import { CatalogReadError } from "@/server/repositories/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Carrito",
  description: "Revisa tu pedido antes de continuar.",
  robots: { index: false },
};

export default async function CartPage() {
  try {
    const catalog = await loadPublicCatalog();
    return (
      <CartScreen
        menuItems={catalog.items}
        allowDemoOverrides={catalog.allowDemoOverrides}
      />
    );
  } catch (error) {
    const message = error instanceof CatalogReadError
      ? error.message
      : "No pudimos sincronizar el carrito con el menú.";
    return <EmptyState title="Catálogo no disponible" description={message} />;
  }
}
