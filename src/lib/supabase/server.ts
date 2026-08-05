import "server-only";

import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerEnv, getSupabasePublishableKey } from "@/lib/env/server";
import type { Database } from "@/types/database.generated";

type ServerSupabaseClient = ReturnType<typeof createServerClient<Database>>;

export type ProfileRole =
  | "customer"
  | "owner"
  | "admin"
  | "manager"
  | "kitchen"
  | "cashier"
  | "editor"
  | "support";

export type UserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  preferred_branch_id: string | null;
  language: string;
  marketing_consent: boolean;
  role: ProfileRole;
  created_at: string;
};

const PROFILE_ROLES = new Set<ProfileRole>([
  "customer",
  "owner",
  "admin",
  "manager",
  "kitchen",
  "cashier",
  "editor",
  "support",
]);

export function isProfileRole(value: unknown): value is ProfileRole {
  return typeof value === "string" && PROFILE_ROLES.has(value as ProfileRole);
}

export function assertSupabaseServerConfig() {
  const env = getServerEnv();
  const key = getSupabasePublishableKey(env);
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !key) {
    throw new Error(
      "Supabase no está configurado: faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, key };
}

/** Crea un cliente por request y copia correctamente todos los cambios de cookies. */
export async function createServerSupabaseClient(): Promise<ServerSupabaseClient> {
  const { url, key } = assertSupabaseServerConfig();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(values: Parameters<SetAllCookies>[0]) {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components no pueden escribir cookies; el middleware las renueva.
        }
      },
    },
  });
}

/** Identidad validada por Supabase; no usa getSession como autorización. */
export async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function getAuthenticatedProfile(): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>;
  profile: UserProfile | null;
} | null> {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, phone, avatar_url, preferred_branch_id, language, marketing_consent, role, created_at")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (error || !data || !isProfileRole((data as { role?: unknown }).role)) {
    return { user: userData.user, profile: null };
  }
  return { user: userData.user, profile: data as UserProfile };
}

export function isStaffRole(role: ProfileRole | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "manager" || role === "kitchen" ||
    role === "cashier" || role === "editor" || role === "support";
}
