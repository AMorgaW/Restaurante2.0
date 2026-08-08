import type { Metadata } from "next";
import {
  MesaLandingBinder,
  MesaLandingScreen,
} from "@/components/dining-tables/mesa-landing-screen";
import { DiningTablesError } from "@/server/dining-tables/errors";
import { resolveBranchConfigIdFromUuid } from "@/server/dining-tables/load";
import { resolveTableQrToken } from "@/server/dining-tables/service";

export const metadata: Metadata = {
  title: "Mesa",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MesaTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken ?? "").trim();

  if (!token) {
    return <MesaLandingScreen tableCode="—" tableName={null} invalid />;
  }

  try {
    const resolved = await resolveTableQrToken(token);
    const branchConfigId = await resolveBranchConfigIdFromUuid(resolved.branchId);

    return (
      <MesaLandingBinder
        tableQrToken={token}
        tableCode={resolved.code}
        tableName={resolved.name}
        branchConfigId={branchConfigId}
      />
    );
  } catch (error) {
    if (error instanceof DiningTablesError && error.code === "qr-invalid") {
      return <MesaLandingScreen tableCode="—" tableName={null} invalid />;
    }
    return <MesaLandingScreen tableCode="—" tableName={null} invalid />;
  }
}
