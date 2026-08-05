// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scenario = vi.hoisted(() => ({
  mode: "supabase" as "supabase" | "disabled" | "invalid",
  configured: true,
  user: null as null | { id: string },
  error: null as null | Error,
  cookiesToWrite: [] as Array<{ name: string; value: string; options: Record<string, unknown> }>,
}));
const getUser = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getAuthModeStatus: () => ({ mode: scenario.mode, configured: scenario.configured, missing: [], invalid: [] }),
  getServerEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo_value",
  }),
  getSupabasePublishableKey: () => "sb_publishable_demo_value",
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: {
    cookies: { setAll: (values: typeof scenario.cookiesToWrite) => void };
  }) => ({
    auth: {
      getUser: async () => {
        getUser();
        options.cookies.setAll(scenario.cookiesToWrite);
        return { data: { user: scenario.user }, error: scenario.error };
      },
    },
  }),
}));

import { middleware } from "../../middleware";

describe("middleware SSR real", () => {
  beforeEach(() => {
    scenario.mode = "supabase";
    scenario.configured = true;
    scenario.user = null;
    scenario.error = null;
    scenario.cookiesToWrite = [];
    getUser.mockClear();
  });

  it("no hace llamadas Auth cuando esta disabled", async () => {
    scenario.mode = "disabled";
    const response = await middleware(new NextRequest("http://localhost/menu"));
    expect(getUser).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBeNull();
  });

  it("deja cacheable una pagina publica anonima sin refresh", async () => {
    const response = await middleware(new NextRequest("http://localhost/menu"));
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(response.headers.get("Cache-Control")).toBeNull();
  });

  it("aísla pagina publica autenticada y rutas privadas", async () => {
    scenario.user = { id: "user-1" };
    const authenticated = await middleware(new NextRequest("http://localhost/menu"));
    expect(authenticated.headers.get("Cache-Control")).toContain("private, no-store");
    expect(authenticated.headers.get("Vary")).toContain("Cookie");

    scenario.user = null;
    const account = await middleware(new NextRequest("http://localhost/cuenta"));
    expect(account.headers.get("Cache-Control")).toContain("private, no-store");
  });

  it("propaga opciones Set-Cookie y aísla una respuesta de refresh", async () => {
    scenario.cookiesToWrite = [{
      name: "sb-project-auth-token",
      value: "renewed",
      options: { httpOnly: true, sameSite: "lax", path: "/" },
    }];
    const response = await middleware(new NextRequest("http://localhost/menu"));
    expect(response.headers.get("set-cookie")).toContain("sb-project-auth-token=renewed");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("Cache-Control")).toContain("private, no-store");
  });

  it("aísla una pagina publica que llega con cookie Auth aunque getUser falle", async () => {
    scenario.error = new Error("invalid token");
    const request = new NextRequest("http://localhost/menu", {
      headers: { Cookie: "sb-project-auth-token=manipulated" },
    });
    const response = await middleware(request);
    expect(response.headers.get("Cache-Control")).toContain("private, no-store");
  });
});
