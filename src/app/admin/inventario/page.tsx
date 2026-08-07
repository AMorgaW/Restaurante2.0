import type { Metadata } from "next";
import { InventoryScreen } from "@/components/admin/inventory-screen";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";
import { getResolvedDataMode } from "@/lib/env/server";
import { loadOperationalInventoryForUi } from "@/server/inventory/load-inventory";

export const metadata: Metadata = {
  title: "Inventario",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  await authorizeAdminSection("inventory");
  const dataMode = getResolvedDataMode();
  if (dataMode === "supabase") {
    const loaded = await loadOperationalInventoryForUi();
    return (
      <InventoryScreen
        mode="supabase"
        initialItems={loaded.items}
        initialMovements={loaded.movements}
        loadError={loaded.error}
      />
    );
  }
  return <InventoryScreen mode="local" />;
}
