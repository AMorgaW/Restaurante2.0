import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv, getSupabasePublishableKey } from "@/lib/env/server";
import type { Database } from "@/types/database.generated";

/**
 * Cliente público sin persistencia de sesión. Se usa únicamente para lecturas
 * de catálogo que no dependen de la identidad de una persona.
 */
let publicClient: SupabaseClient<Database> | null = null;

export function getSupabaseAnonClient(): SupabaseClient<Database> {
  const env = getServerEnv();
  const key = getSupabasePublishableKey(env);
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !key) {
    throw new Error(
      "Supabase no está configurado: faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  if (!publicClient) {
    publicClient = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return publicClient;
}

/**
 * Cliente privilegiado reservado a webhooks firmados y tareas internas.
 * Nunca se importa desde componentes cliente ni endpoints públicos.
 */
let serviceClient: SupabaseClient<Database> | null = null;

export function getSupabaseServiceClient(): SupabaseClient<Database> {
  const env = getServerEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase service role no está configurado para una operación interna segura.",
    );
  }
  if (!serviceClient) {
    serviceClient = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return serviceClient;
}
