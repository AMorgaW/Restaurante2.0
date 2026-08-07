import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { getAuthModeStatus } from "@/lib/env/server";
import { resolvePostLoginDestination } from "@/lib/session/destination";
import { resolveServerSession } from "@/lib/session/server-resolver";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const status = getAuthModeStatus();
  if (status.mode !== "supabase" || !status.configured) {
    return NextResponse.json({ error: "Auth no disponible." }, { status: 503, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  }
  const body = await request.json().catch(() => ({})) as { next?: unknown };
  const next =
    typeof body.next === "string" && body.next.length > 0
      ? safeNextPath(body.next, "")
      : undefined;
  const session = await resolveServerSession();
  if (session.kind === "anonymous") return NextResponse.json({ error: "Sesión no válida." }, { status: 401, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  const response = NextResponse.json({
    destination: resolvePostLoginDestination(session, next || null),
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}
