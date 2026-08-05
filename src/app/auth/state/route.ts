import { NextResponse } from "next/server";
import { getAuthModeStatus } from "@/lib/env/server";
import { resolveServerSession } from "@/lib/session/server-resolver";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getAuthModeStatus();
  const authenticated = status.mode === "supabase" && status.configured && (await resolveServerSession()).kind !== "anonymous";
  const response = NextResponse.json({ authenticated });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}
