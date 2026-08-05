import type { Metadata } from "next";
import { PensionWorkspace } from "@/components/pension/pension-workspace";
import { createServiceSnapshot } from "@/lib/menu/service-period";
import { getAuthModeStatus } from "@/lib/env/server";
import { resolveServerSession } from "@/lib/session/server-resolver";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Plan pensionado", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PensionadoPage() {
  const auth = getAuthModeStatus();
  if (auth.mode === "supabase" && auth.configured) {
    const session = await resolveServerSession();
    if (session.kind === "anonymous") redirect("/login?next=%2Fpensionado");
    if (session.kind !== "customer_with_membership") redirect(session.kind === "customer_without_membership" ? "/cuenta?error=membership" : "/cuenta?error=access");
  }
  return <PensionWorkspace initialSnapshot={createServiceSnapshot(new Date())} mode={auth.mode === "disabled" ? "local" : "closed"} requireDemoSession />;
}
