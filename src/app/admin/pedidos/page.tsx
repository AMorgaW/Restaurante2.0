import { OrdersAdminScreen } from "@/components/admin/orders-admin-screen";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";
import { loadOperationalOrdersForUi } from "@/server/orders/load-operational-orders";

export const metadata = { title: "Pedidos" };

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const auth = await authorizeAdminSection("orders");
  if (auth.mode === "supabase") {
    const loaded = await loadOperationalOrdersForUi();
    return (
      <OrdersAdminScreen
        mode="supabase"
        initialOrders={loaded.mode === "supabase" ? loaded.orders : []}
        loadError={loaded.mode === "supabase" ? loaded.error : null}
      />
    );
  }
  return <OrdersAdminScreen mode="local" />;
}
