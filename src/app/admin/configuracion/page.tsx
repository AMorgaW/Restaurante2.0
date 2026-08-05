import { SettingsScreen } from "@/components/admin/settings-screen";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";

export const metadata = { title: "Configuración" };

export default async function AdminSettingsPage() {
  await authorizeAdminSection("settings");
  return <SettingsScreen />;
}
