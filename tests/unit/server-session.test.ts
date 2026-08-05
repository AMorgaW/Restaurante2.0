import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data: unknown; error: unknown };

const state = vi.hoisted(() => ({
  user: { data: { user: null as unknown }, error: null as unknown } as {
    data: { user: unknown };
    error: unknown;
  },
  tables: {} as Record<string, QueryResult>,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));
vi.mock("@/lib/env/server", () => ({
  getAuthModeStatus: () => ({ mode: "supabase", configured: true }),
  getServerEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }),
  getSupabasePublishableKey: () => "sb_publishable_test",
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => buildFakeClient() }));

function buildBuilder(result: QueryResult) {
  const builder: {
    eq: () => typeof builder;
    maybeSingle: () => Promise<QueryResult>;
    then: (onfulfilled: (value: QueryResult) => unknown) => Promise<unknown>;
  } = {
    eq: () => builder,
    maybeSingle: () => Promise.resolve(result),
    then: (onfulfilled) => Promise.resolve(result).then(onfulfilled),
  };
  return builder;
}

function buildFakeClient() {
  return {
    auth: { getUser: async () => state.user },
    from: (table: string) => ({
      select: () => buildBuilder(state.tables[table] ?? { data: null, error: null }),
    }),
  };
}

import { resolveServerSession } from "@/lib/session/server-resolver";

const USER_ID = "40000000-0000-0000-0000-000000000005";

function setUser(metadata: Record<string, unknown> = {}) {
  state.user = {
    data: { user: { id: USER_ID, email: "persona@example.test", app_metadata: metadata, user_metadata: metadata } },
    error: null,
  };
}

function profile(role: string, staffStatus: string | null = null): QueryResult {
  return {
    data: {
      id: USER_ID,
      name: "Persona",
      email: "persona@example.test",
      phone: null,
      avatar_url: null,
      preferred_branch_id: null,
      language: "es",
      marketing_consent: false,
      role,
      staff_status: staffStatus,
      created_at: "2026-01-01T00:00:00Z",
    },
    error: null,
  };
}

function membership(status: string): QueryResult {
  return { data: [{ status, created_at: "2026-01-01T00:00:00Z" }], error: null };
}

describe("resolveServerSession (integración Supabase)", () => {
  beforeEach(() => {
    setUser();
    state.tables = {};
  });

  it("customer sin membresía → /cuenta", async () => {
    state.tables = { profiles: profile("customer"), pension_memberships: { data: [], error: null } };
    const session = await resolveServerSession();
    expect(session).toMatchObject({ kind: "customer_without_membership", destination: "/cuenta" });
  });

  it.each(["pending", "active", "suspended", "expired", "cancelled"] as const)(
    "customer con membresía %s → /pensionado",
    async (status) => {
      state.tables = { profiles: profile("customer"), pension_memberships: membership(status) };
      const session = await resolveServerSession();
      expect(session).toMatchObject({ kind: "customer_with_membership", destination: "/pensionado", membershipStatus: status });
    },
  );

  it("prioriza la membresía abierta sobre el historial cancelado", async () => {
    state.tables = {
      profiles: profile("customer"),
      pension_memberships: {
        data: [
          { status: "cancelled", created_at: "2026-02-01T00:00:00Z" },
          { status: "active", created_at: "2026-01-01T00:00:00Z" },
        ],
        error: null,
      },
    };
    const session = await resolveServerSession();
    expect(session).toMatchObject({ kind: "customer_with_membership", membershipStatus: "active" });
  });

  it("solo historial (expired/cancelled) sigue enviando a /pensionado", async () => {
    state.tables = {
      profiles: profile("customer"),
      pension_memberships: {
        data: [
          { status: "expired", created_at: "2026-01-01T00:00:00Z" },
          { status: "cancelled", created_at: "2026-03-01T00:00:00Z" },
        ],
        error: null,
      },
    };
    const session = await resolveServerSession();
    expect(session).toMatchObject({ kind: "customer_with_membership", membershipStatus: "cancelled" });
  });

  it.each([
    ["owner", "/admin"],
    ["admin", "/admin"],
    ["manager", "/empleado"],
    ["kitchen", "/empleado"],
    ["cashier", "/empleado"],
    ["editor", "/empleado"],
    ["support", "/empleado"],
  ] as const)("%s activo → %s", async (role, destination) => {
    state.tables = {
      profiles: profile(role, "active"),
      staff_branch_permissions: { data: [{ branch_id: "20000000-0000-0000-0000-000000000001" }], error: null },
    };
    const session = await resolveServerSession();
    expect(session).toMatchObject({ kind: role, destination });
    expect(session.profile?.branchIds).toContain("20000000-0000-0000-0000-000000000001");
  });

  it.each(["suspended", "inactive", "invited"] as const)(
    "personal con estado %s no accede al shell privado (→ /cuenta)",
    async (staffStatus) => {
      state.tables = {
        profiles: profile("manager", staffStatus),
        staff_branch_permissions: { data: [{ branch_id: "20000000-0000-0000-0000-000000000001" }], error: null },
      };
      const session = await resolveServerSession();
      expect(session).toMatchObject({ kind: "suspended_staff", destination: "/cuenta" });
    },
  );

  it("perfil inexistente → destino seguro", async () => {
    state.tables = { profiles: { data: null, error: null } };
    const session = await resolveServerSession();
    expect(session).toMatchObject({ kind: "authenticated_without_profile", destination: "/cuenta" });
  });

  it("metadata del usuario no puede falsificar el rol", async () => {
    setUser({ role: "owner" });
    state.tables = { profiles: profile("customer"), pension_memberships: { data: [], error: null } };
    const session = await resolveServerSession();
    expect(session.kind).toBe("customer_without_membership");
    expect(session.destination).toBe("/cuenta");
  });

  it("consulta de membresía fallida falla cerrado (→ /cuenta)", async () => {
    state.tables = {
      profiles: profile("customer"),
      pension_memberships: { data: null, error: new Error("db") },
    };
    const session = await resolveServerSession();
    expect(session).toMatchObject({ kind: "customer_without_membership", destination: "/cuenta" });
  });
});
