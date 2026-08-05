import { NextResponse, type NextRequest } from "next/server";
import { getAuthModeStatus } from "@/lib/env/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function privateJson(body: Record<string, unknown>, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}

export async function POST(request: NextRequest) {
  const status = getAuthModeStatus();
  if (status.mode !== "supabase" || !status.configured) {
    return privateJson({ error: "La recuperacion no esta disponible." }, 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Solicitud invalida." }, 400);
  }

  const password = typeof body === "object" && body !== null && "password" in body
    ? (body as { password?: unknown }).password
    : undefined;
  const tokenHash = typeof body === "object" && body !== null && "tokenHash" in body
    ? (body as { tokenHash?: unknown }).tokenHash
    : undefined;

  if (typeof tokenHash !== "string" || !tokenHash || tokenHash.length > 2048) {
    return privateJson({ error: "El enlace de recuperacion no es valido o ya expiro." }, 403);
  }
  if (typeof password !== "string" || password.length < 8) {
    return privateJson({ error: "La contrasena debe tener al menos 8 caracteres." }, 422);
  }

  const supabase = await createServerSupabaseClient();
  // El tipo nunca procede del navegador. Supabase consume el OTP de forma
  // atomica, por lo que un segundo uso o una carrera concurrente deben fallar.
  const { data: verification, error: verificationError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });
  if (verificationError || !verification.user) {
    return privateJson({ error: "El enlace de recuperacion no es valido o ya expiro." }, 403);
  }

  const { data: validated, error: userError } = await supabase.auth.getUser();
  if (userError || !validated.user || validated.user.id !== verification.user.id) {
    await supabase.auth.signOut();
    return privateJson({ error: "No pudimos validar la recuperacion." }, 403);
  }

  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return privateJson({ error: "No pudimos actualizar la contrasena." }, 400);
    return privateJson({ ok: true }, 200);
  } finally {
    // La sesion temporal de recovery nunca se conserva como sesion ordinaria.
    await supabase.auth.signOut();
  }
}
