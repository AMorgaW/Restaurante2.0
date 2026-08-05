import { DashboardScreen } from "@/components/admin/dashboard-screen";
import { menuItems } from "@/data/menu";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";

export default async function AdminDashboardPage() {
  await authorizeAdminSection("dashboard");
  return <DashboardScreen items={menuItems} />;
}
