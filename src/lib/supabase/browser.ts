"use client";

import { createBrowserClient } from "@supabase/ssr";
import { safeSupabasePublishableKey, supabaseUrl } from "@/lib/env/client";
import type { Database } from "@/types/database.generated";

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient<Database>>;

let browserClient: BrowserSupabaseClient | null = null;

/** Cliente singleton del navegador; la sesión vive en cookies gestionadas por supabase-ssr. */
export function getSupabaseBrowserClient(): BrowserSupabaseClient {
  if (!supabaseUrl || !safeSupabasePublishableKey) {
    throw new Error(
      "Supabase no está configurado: completa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  browserClient ??= createBrowserClient<Database>(supabaseUrl, safeSupabasePublishableKey);
  return browserClient;
}
