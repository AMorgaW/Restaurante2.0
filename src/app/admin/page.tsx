import { DashboardScreen } from "@/components/admin/dashboard-screen";
import { menuItems } from "@/data/menu";

export default function AdminDashboardPage() {
  return <DashboardScreen items={menuItems} />;
}
