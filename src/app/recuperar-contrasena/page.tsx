import { AuthForm } from "@/components/auth/auth-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { getAuthModeStatus } from "@/lib/env/server";

export const dynamic = "force-dynamic";

export default function RecoverPasswordPage() {
  const status = getAuthModeStatus();
  const enabled = status.mode === "supabase" && status.configured;
  const unavailableMessage = status.mode === "invalid"
    ? "La configuracion de Auth es invalida o incompleta. La recuperacion permanece cerrada."
    : undefined;
  return <AuthPageShell><AuthForm mode="recover" enabled={enabled} unavailableMessage={unavailableMessage} /></AuthPageShell>;
}
