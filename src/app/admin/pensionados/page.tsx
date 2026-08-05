import type { Metadata } from "next";
import { PensionAdminScreen } from "@/components/admin/pension-admin-screen";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";

export const metadata: Metadata = { title: "Pensionados", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PensionersPage() {
  await authorizeAdminSection("pensioners");
  return <PensionAdminScreen />;
}
