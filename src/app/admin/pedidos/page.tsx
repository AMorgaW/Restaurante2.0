import { OrdersAdminScreen } from "@/components/admin/orders-admin-screen";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";

export const metadata = { title: "Pedidos" };

export default async function AdminOrdersPage() {
  await authorizeAdminSection("orders");
  return <OrdersAdminScreen />;
}
