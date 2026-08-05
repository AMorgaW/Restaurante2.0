import type { Metadata } from "next";
import { InventoryScreen } from "@/components/admin/inventory-screen";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";

export const metadata: Metadata = {
  title: "Inventario",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  await authorizeAdminSection("inventory");
  return <InventoryScreen />;
}
