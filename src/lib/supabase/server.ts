import "server-only";

import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerEnv, getSupabasePublishableKey } from "@/lib/env/server";
import type { Database } from "@/types/database.generated";
import type { PensionMembershipStatus } from "@/lib/pension/types";

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

export type StaffStatus = "invited" | "active" | "suspended" | "inactive";

const STAFF_STATUSES = new Set<StaffStatus>(["invited", "active", "suspended", "inactive"]);
const MEMBERSHIP_STATUSES = new Set<PensionMembershipStatus>([
  "pending",
  "active",
  "suspended",
  "expired",
  "cancelled",
]);
// Estados que representan una membresía todavía abierta; el índice parcial
// `pension_memberships_one_open_idx` garantiza a lo sumo una en este conjunto.
const OPEN_MEMBERSHIP_STATUSES = new Set<PensionMembershipStatus>(["pending", "active", "suspended"]);

function isStaffStatus(value: unknown): value is StaffStatus {
  return typeof value === "string" && STAFF_STATUSES.has(value as StaffStatus);
}

function isMembershipStatus(value: unknown): value is PensionMembershipStatus {
  return typeof value === "string" && MEMBERSHIP_STATUSES.has(value as PensionMembershipStatus);
}

/**
 * Elige la membresía más relevante para decidir el destino de sesión: primero
 * una membresía abierta (a lo sumo una por el índice parcial) y, si solo hay
 * historial, la más reciente. Devuelve `null` si no hay ninguna reconocida.
 */
function pickRelevantMembershipStatus(
  rows: ReadonlyArray<{ status: string; created_at: string }>,
): PensionMembershipStatus | null {
  const valid = rows.filter(
    (row): row is { status: PensionMembershipStatus; created_at: string } => isMembershipStatus(row.status),
  );
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => {
    const priorityA = OPEN_MEMBERSHIP_STATUSES.has(a.status) ? 0 : 1;
    const priorityB = OPEN_MEMBERSHIP_STATUSES.has(b.status) ? 0 : 1;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return b.created_at.localeCompare(a.created_at);
  });
  return sorted[0]!.status;
}

export type ServerSessionContext = {
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>;
  profile: (UserProfile & { staffStatus: StaffStatus | null }) | null;
  branchIds: string[];
  membershipStatus: PensionMembershipStatus | null;
};

/**
 * Resuelve el contexto de sesión desde PostgreSQL con datos confiables:
 * identidad de `getUser()`, rol y estado de personal del perfil, sucursales
 * autorizadas y estado de membresía comercial. Nunca confía en parámetros de
 * cliente, cookies editables ni `user_metadata` para decidir el rol. Ante datos
 * ausentes o consultas fallidas, falla cerrado (perfil nulo o sin membresía).
 */
export async function getServerSessionContext(): Promise<ServerSessionContext | null> {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;
  const user = userData.user;

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, name, email, phone, avatar_url, preferred_branch_id, language, marketing_consent, role, staff_status, created_at",
    )
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profileRow || !isProfileRole((profileRow as { role?: unknown }).role)) {
    return { user, profile: null, branchIds: [], membershipStatus: null };
  }

  const typedRow = profileRow as UserProfile & { staff_status: string | null };
  const profile = { ...typedRow, staffStatus: isStaffStatus(typedRow.staff_status) ? typedRow.staff_status : null };

  let branchIds: string[] = [];
  let membershipStatus: PensionMembershipStatus | null = null;

  if (isStaffRole(profile.role)) {
    const { data: permissions } = await supabase
      .from("staff_branch_permissions")
      .select("branch_id")
      .eq("profile_id", user.id);
    const permissionRows = (permissions ?? []) as ReadonlyArray<{ branch_id: string | null }>;
    branchIds = permissionRows
      .map((row) => row.branch_id)
      .filter((value): value is string => typeof value === "string");
  } else if (profile.role === "customer") {
    const { data: memberships, error: membershipError } = await supabase
      .from("pension_memberships")
      .select("status, created_at")
      .eq("profile_id", user.id);
    // Si la consulta de membresía falla, se trata como sin membresía (destino
    // seguro /cuenta); jamás se abre acceso por defecto ante un error.
    membershipStatus = membershipError ? null : pickRelevantMembershipStatus(memberships ?? []);
  }

  return { user, profile, branchIds, membershipStatus };
}
