import { DashboardScreen } from "@/components/admin/dashboard-screen";
import { menuItems } from "@/data/menu";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";
import { getResolvedDataMode } from "@/lib/env/server";
import { loadOperationalInventoryForUi } from "@/server/inventory/load-inventory";

export default async function AdminDashboardPage() {
  await authorizeAdminSection("dashboard");
  const dataMode = getResolvedDataMode();
  if (dataMode === "supabase") {
    const inventory = await loadOperationalInventoryForUi();
    return (
      <DashboardScreen
        items={menuItems}
        mode="supabase"
        inventoryItems={inventory.items}
        inventoryMovements={inventory.movements}
        inventoryError={inventory.error}
      />
    );
  }
  return <DashboardScreen items={menuItems} mode="local" />;
}
