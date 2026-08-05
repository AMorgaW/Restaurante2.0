import { NextResponse, type NextRequest } from "next/server";
import { getAuthModeStatus } from "@/lib/env/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const configuredOrigin = new URL(request.url).origin;
  let requestOrigin = origin;
  if (!requestOrigin && referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch {
      requestOrigin = null;
    }
  }
  if (!requestOrigin || requestOrigin !== configuredOrigin) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
  if (getAuthModeStatus().mode !== "supabase") {
    const response = NextResponse.redirect(new URL("/", request.url), 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  let operationalFailure = false;
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error && !/session.*(missing|not found)|authsessionmissing/i.test(`${error.name} ${error.message}`)) {
      operationalFailure = true;
    }
  } catch {
    operationalFailure = true;
  }
  const response = NextResponse.redirect(new URL(operationalFailure ? "/cuenta?error=logout" : "/", request.url), 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
