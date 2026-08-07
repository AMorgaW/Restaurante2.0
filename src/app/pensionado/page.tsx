import type { Metadata } from "next";
import { PensionSupabaseWorkspace } from "@/components/pension/pension-supabase-workspace";
import { PensionWorkspace } from "@/components/pension/pension-workspace";
import { createServiceSnapshot } from "@/lib/menu/service-period";
import { getAuthModeStatus, getResolvedDataMode } from "@/lib/env/server";
import { resolveServerSession } from "@/lib/session/server-resolver";
import { loadCustomerPensionForUi } from "@/server/pension/load";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Plan pensionado", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PensionadoPage() {
  const auth = getAuthModeStatus();
  if (auth.mode === "supabase" && auth.configured) {
    const session = await resolveServerSession();
    if (session.kind === "anonymous") redirect("/login?next=%2Fpensionado");
    if (session.kind !== "customer_with_membership") {
      redirect(
        session.kind === "customer_without_membership"
          ? "/cuenta?error=membership"
          : "/cuenta?error=access",
      );
    }
    if (!session.userId) redirect("/login?next=%2Fpensionado");
    if (getResolvedDataMode() === "supabase") {
      const loaded = await loadCustomerPensionForUi(session.userId);
      return (
        <PensionSupabaseWorkspace snapshot={loaded.snapshot} loadError={loaded.error} />
      );
    }
  }

  return (
    <PensionWorkspace
      initialSnapshot={createServiceSnapshot(new Date())}
      mode={auth.mode === "disabled" ? "local" : "closed"}
      requireDemoSession
    />
  );
}
