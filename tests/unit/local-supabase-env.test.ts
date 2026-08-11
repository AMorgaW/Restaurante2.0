import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLocalSupabaseBrowserEnv,
  getLocalSupabaseServerEnv,
  getLocalSupabaseWebServerEnv,
} from "../helpers/local-supabase-env";

function jwt(role: "anon" | "service_role") {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role })}.${"x".repeat(43)}`;
}

function stubLocalEnv() {
  vi.stubEnv("SUPABASE_LOCAL_URL", "http://127.0.0.1:54321");
  vi.stubEnv("SUPABASE_LOCAL_ANON_KEY", jwt("anon"));
  vi.stubEnv("SUPABASE_LOCAL_PUBLISHABLE_KEY", "sb_publishable_placeholder_local_test");
  vi.stubEnv("SUPABASE_LOCAL_SERVICE_ROLE_KEY", jwt("service_role"));
  vi.stubEnv("SUPABASE_LOCAL_TEST_PASSWORD", "placeholder-runtime-password");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "placeholder-server-only-key");
  vi.stubEnv("STRIPE_SECRET_KEY", "placeholder-server-only-stripe-key");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("local Supabase test env", () => {
  it("separa valores browser-safe de credenciales server-only", () => {
    stubLocalEnv();

    const browser = getLocalSupabaseBrowserEnv();
    const server = getLocalSupabaseServerEnv();

    expect(browser).toEqual({
      url: "http://127.0.0.1:54321",
      anonKey: expect.any(String),
      publishableKey: "sb_publishable_placeholder_local_test",
    });
    expect(browser).not.toHaveProperty("serviceRoleKey");
    expect(server.serviceRoleKey).toBeTruthy();
    expect(server.testPassword).toBe("placeholder-runtime-password");

    const webServer = getLocalSupabaseWebServerEnv({ siteUrl: "http://localhost:3110" });
    expect(webServer.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe(
      "sb_publishable_placeholder_local_test",
    );
    expect(webServer).not.toHaveProperty("SUPABASE_LOCAL_SERVICE_ROLE_KEY");
    expect(webServer).not.toHaveProperty("SUPABASE_LOCAL_TEST_PASSWORD");
    expect(webServer).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    expect(webServer).not.toHaveProperty("STRIPE_SECRET_KEY");
  });

  it("rechaza endpoints que no sean loopback", () => {
    stubLocalEnv();
    vi.stubEnv("SUPABASE_LOCAL_URL", "https://example.supabase.co");

    expect(() => getLocalSupabaseBrowserEnv()).toThrow(/loopback/);
  });
});
