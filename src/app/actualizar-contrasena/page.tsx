import { AuthForm } from "@/components/auth/auth-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { getAuthModeStatus } from "@/lib/env/server";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string | string[] }>;
}) {
  const status = getAuthModeStatus();
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : "";
  const configured = status.mode === "supabase" && status.configured;
  const enabled = configured && tokenHash.length > 0 && tokenHash.length <= 2048;

  return (
    <AuthPageShell>
      <AuthForm
        mode="update"
        enabled={enabled}
        tokenHash={enabled ? tokenHash : undefined}
        unavailableMessage={configured
          ? "El enlace de recuperacion no es valido o ya expiro. Solicita uno nuevo."
          : undefined}
      />
    </AuthPageShell>
  );
}
