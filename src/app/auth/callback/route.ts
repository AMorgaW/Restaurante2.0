import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { getAuthModeStatus } from "@/lib/env/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolvePostLoginDestination } from "@/lib/session/destination";
import { resolveServerSession } from "@/lib/session/server-resolver";

export const dynamic = "force-dynamic";

function privateRedirect(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}

/** Callback PKCE para confirmacion/login. Recovery usa token_hash en su ruta propia. */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return privateRedirect(request, "/login?error=callback");

  try {
    const status = getAuthModeStatus();
    if (status.mode !== "supabase" || !status.configured) {
      return privateRedirect(request, "/login?error=configuration");
    }
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return privateRedirect(request, "/login?error=callback");
    const session = await resolveServerSession();
    if (session.kind === "anonymous") return privateRedirect(request, "/login?error=callback");
    return privateRedirect(request, resolvePostLoginDestination(session, next));
  } catch {
    return privateRedirect(request, "/login?error=configuration");
  }
}
