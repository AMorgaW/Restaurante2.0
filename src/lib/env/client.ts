/**
 * Valores públicos disponibles en el cliente. Solo variables con prefijo
 * NEXT_PUBLIC_ (inyectadas en build); nunca contiene secretos.
 */
import { isSafeSupabasePublishableKey } from "@/lib/env/publishable-key";
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

/** Solo variables públicas; nunca incluye service role ni contraseñas. */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export const safeSupabasePublishableKey = isSafeSupabasePublishableKey(supabasePublishableKey)
  ? supabasePublishableKey
  : "";
