import { AuthForm } from "@/components/auth/auth-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { safeNextPath } from "@/lib/auth/redirect";
import { getAuthModeStatus } from "@/lib/env/server";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const status = getAuthModeStatus();
  const value = (await searchParams).next;
  const nextPath = safeNextPath(Array.isArray(value) ? value[0] : value);
  const enabled = status.mode === "supabase" && status.configured;
  const unavailableMessage = status.mode === "invalid" || (status.mode === "supabase" && !status.configured)
    ? "La configuracion de Auth es invalida o incompleta. El registro permanece cerrado."
    : undefined;
  return <AuthPageShell><AuthForm mode="register" enabled={enabled} nextPath={nextPath} unavailableMessage={unavailableMessage} /></AuthPageShell>;
}
