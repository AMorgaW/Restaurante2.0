import "server-only";
import { redirect } from "next/navigation";
import { getAuthModeStatus } from "@/lib/env/server";
import { resolveServerSession } from "@/lib/session/server-resolver";
import { canSessionUsePath } from "@/lib/session/destination";

export async function protectSessionPath(pathname: string): Promise<"local" | "supabase"> {
  const status = getAuthModeStatus();
  if (status.mode === "disabled") return "local";
  if (status.mode !== "supabase" || !status.configured) return "supabase";
  const session = await resolveServerSession();
  if (session.kind === "anonymous") redirect(`/login?next=${encodeURIComponent(pathname)}`);
  if (!canSessionUsePath(session, pathname)) redirect(`/cuenta?error=access`);
  return "supabase";
}
