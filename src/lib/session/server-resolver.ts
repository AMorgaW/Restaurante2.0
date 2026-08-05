import "server-only";
import { getAuthModeStatus } from "@/lib/env/server";
import { getAuthenticatedProfile } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/session/resolver";
import type { ResolvedSession } from "@/lib/session/types";

export async function resolveServerSession(): Promise<ResolvedSession> {
  const status = getAuthModeStatus();
  if (status.mode !== "supabase" || !status.configured) return resolveSession({ source: "supabase", user: null });
  const context = await getAuthenticatedProfile();
  if (!context) return resolveSession({ source: "supabase", user: null });
  return resolveSession({
    source: "supabase",
    user: { id: context.user.id, email: context.user.email },
    profile: context.profile,
  });
}
