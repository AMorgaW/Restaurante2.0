import type { Metadata } from "next";
import { PensionAdminScreen } from "@/components/admin/pension-admin-screen";
import { PensionAdminSupabaseScreen } from "@/components/admin/pension-admin-supabase-screen";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";
import { getResolvedDataMode } from "@/lib/env/server";
import { loadAdminPensionForUi } from "@/server/pension/load";

export const metadata: Metadata = { title: "Pensionados", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PensionersPage() {
  await authorizeAdminSection("pensioners");
  if (getResolvedDataMode() === "supabase") {
    const loaded = await loadAdminPensionForUi();
    return (
      <PensionAdminSupabaseScreen snapshot={loaded.snapshot} loadError={loaded.error} />
    );
  }
  return <PensionAdminScreen />;
}
