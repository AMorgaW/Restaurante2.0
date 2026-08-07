import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  dataMode: "supabase" as "local" | "supabase",
  session: {
    kind: "owner" as string,
    profile: {
      id: "u1",
      role: "owner" as string,
      status: "active" as string | undefined,
      name: "Owner",
      email: "o@t.local",
      branchIds: [] as string[],
      branchNames: [] as string[],
    },
  },
  updateResult: { data: { id: "plato-1" }, error: null as null | { message: string } },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getResolvedDataMode: () => harness.dataMode,
  getDataModeStatus: () => ({ mode: harness.dataMode, configured: true, missing: [], invalid: [] }),
  getAuthModeStatus: () => ({ mode: "supabase", configured: true, missing: [], invalid: [] }),
}));
vi.mock("@/lib/session/server-resolver", () => ({
  resolveServerSession: async () => harness.session,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { slug: "carnes" }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            maybeSingle: async () => harness.updateResult,
          }),
        }),
      }),
    }),
  }),
}));

import { CatalogAdminError } from "@/server/catalog/admin-errors";
import { updateMenuItemAdmin } from "@/server/catalog/admin-service";

describe("admin-service DATA_MODE y roles", () => {
  beforeEach(() => {
    harness.dataMode = "supabase";
    harness.session = {
      kind: "owner",
      profile: {
        id: "u1",
        role: "owner",
        status: "active",
        name: "Owner",
        email: "o@t.local",
        branchIds: [],
        branchNames: [],
      },
    };
    harness.updateResult = { data: { id: "plato-1" }, error: null };
  });

  it("falla cerrado en DATA_MODE=local sin caer a store", async () => {
    harness.dataMode = "local";
    await expect(updateMenuItemAdmin({ id: "plato-1", featured: true })).rejects.toMatchObject({
      code: "data-mode",
    } satisfies Partial<CatalogAdminError>);
  });

  it("deniega kitchen y staff suspendido", async () => {
    harness.session.profile.role = "kitchen";
    harness.session.kind = "kitchen";
    await expect(updateMenuItemAdmin({ id: "plato-1", featured: true })).rejects.toMatchObject({
      code: "forbidden",
    });

    harness.session.kind = "suspended_staff";
    harness.session.profile.role = "editor";
    await expect(updateMenuItemAdmin({ id: "plato-1", featured: true })).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("permite owner y no inventa éxito con cero filas", async () => {
    await expect(updateMenuItemAdmin({ id: "plato-1", featured: true })).resolves.toEqual({
      id: "plato-1",
    });
    harness.updateResult = { data: null as unknown as { id: string }, error: null };
    await expect(updateMenuItemAdmin({ id: "missing", featured: true })).rejects.toMatchObject({
      code: "not-found",
    });
  });
});
