import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { safeNextPath } from "@/lib/auth/redirect";
import { getAuthModeStatus } from "@/lib/env/server";
import { resolvePostLoginDestination } from "@/lib/session/destination";
import { resolveServerSession } from "@/lib/session/server-resolver";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const status = getAuthModeStatus();
  const nextValue = (await searchParams).next;
  const rawNext = Array.isArray(nextValue) ? nextValue[0] : nextValue;
  const nextPath = rawNext ? safeNextPath(rawNext, "") || undefined : undefined;
  const enabled = status.mode === "supabase" && status.configured;
  const unavailableMessage = status.mode === "invalid"
    ? "La configuracion de Auth es invalida o incompleta. El acceso permanece cerrado."
    : undefined;
  if (enabled) {
    const session = await resolveServerSession();
    if (session.kind !== "anonymous") redirect(resolvePostLoginDestination(session, nextPath ?? null));
  }
  return <AuthPageShell><AuthForm mode="login" enabled={enabled} nextPath={nextPath} unavailableMessage={unavailableMessage} /></AuthPageShell>;
}
