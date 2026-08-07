import { describe, expect, it } from "vitest";
import {
  getAuthModeStatusFromEnv,
  getDataModeStatusFromEnv,
  isDemoAuthMode,
} from "@/lib/env/modes";

const configured = {
  NEXT_PUBLIC_SUPABASE_URL: "https://nasenphzywwufntvrzpc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo_value",
};

describe("matriz canónica AUTH_MODE", () => {
  describe("NODE_ENV=production", () => {
    const prod = { NODE_ENV: "production" as const };

    it("ausente → invalid", () => {
      expect(getAuthModeStatusFromEnv(prod)).toEqual({
        mode: "invalid", configured: false, missing: ["AUTH_MODE"], invalid: [],
      });
    });

    it("supabase + config válida → supabase", () => {
      expect(getAuthModeStatusFromEnv({ ...prod, AUTH_MODE: "supabase", ...configured })).toEqual({
        mode: "supabase", configured: true, missing: [], invalid: [],
      });
    });

    it("supabase + URL ausente → invalid", () => {
      expect(getAuthModeStatusFromEnv({
        ...prod,
        AUTH_MODE: "supabase",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: configured.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      })).toEqual({
        mode: "invalid",
        configured: false,
        missing: ["NEXT_PUBLIC_SUPABASE_URL"],
        invalid: [],
      });
    });

    it("supabase + clave ausente → invalid", () => {
      expect(getAuthModeStatusFromEnv({
        ...prod,
        AUTH_MODE: "supabase",
        NEXT_PUBLIC_SUPABASE_URL: configured.NEXT_PUBLIC_SUPABASE_URL,
      })).toEqual({
        mode: "invalid",
        configured: false,
        missing: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
        invalid: [],
      });
    });

    it("supabase + clave secreta → invalid", () => {
      const status = getAuthModeStatusFromEnv({
        ...prod,
        AUTH_MODE: "supabase",
        NEXT_PUBLIC_SUPABASE_URL: configured.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_should_never_be_public",
      });
      expect(status).toEqual({
        mode: "invalid",
        configured: false,
        missing: [],
        invalid: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
      });
      expect(JSON.stringify(status)).not.toMatch(/sb_secret_/);
    });

    it("disabled → invalid (sin bypass productivo)", () => {
      expect(getAuthModeStatusFromEnv({ ...prod, AUTH_MODE: "disabled" })).toEqual({
        mode: "invalid", configured: false, missing: [], invalid: ["AUTH_MODE"],
      });
      expect(isDemoAuthMode(getAuthModeStatusFromEnv({ ...prod, AUTH_MODE: "disabled" }))).toBe(false);
    });

    it.each(["demo", "DEMO", "local", "mock", "supabse", "SUPABASE", " supabase", "supabase ", ""])(
      "valor no canónico %j → invalid",
      (AUTH_MODE) => expect(getAuthModeStatusFromEnv({ ...prod, AUTH_MODE, ...configured })).toEqual({
        mode: "invalid", configured: false, missing: [], invalid: ["AUTH_MODE"],
      }),
    );
  });

  describe.each(["development", "test"] as const)("NODE_ENV=%s", (NODE_ENV) => {
    it("ausente → invalid (sin fallback implícito)", () => {
      expect(getAuthModeStatusFromEnv({ NODE_ENV })).toEqual({
        mode: "invalid", configured: false, missing: ["AUTH_MODE"], invalid: [],
      });
    });

    it("disabled → disabled (harness demo explícito)", () => {
      const status = getAuthModeStatusFromEnv({ NODE_ENV, AUTH_MODE: "disabled" });
      expect(status).toEqual({ mode: "disabled", configured: false, missing: [], invalid: [] });
      expect(isDemoAuthMode(status)).toBe(true);
    });

    it("supabase + config válida → supabase", () => {
      expect(getAuthModeStatusFromEnv({ NODE_ENV, AUTH_MODE: "supabase", ...configured })).toEqual({
        mode: "supabase", configured: true, missing: [], invalid: [],
      });
    });

    it("supabase + URL inválida → invalid", () => {
      expect(getAuthModeStatusFromEnv({
        NODE_ENV,
        AUTH_MODE: "supabase",
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: configured.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      })).toEqual({
        mode: "invalid",
        configured: false,
        missing: [],
        invalid: ["NEXT_PUBLIC_SUPABASE_URL"],
      });
    });

    it("supabase + clave inválida → invalid", () => {
      expect(getAuthModeStatusFromEnv({
        NODE_ENV,
        AUTH_MODE: "supabase",
        NEXT_PUBLIC_SUPABASE_URL: configured.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_should_never_be_public",
      })).toEqual({
        mode: "invalid",
        configured: false,
        missing: [],
        invalid: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
      });
    });

    it.each(["demo", "unknown", "SUPABASE", ""])("valor no canónico %j → invalid", (AUTH_MODE) => {
      expect(getAuthModeStatusFromEnv({ NODE_ENV, AUTH_MODE, ...configured })).toEqual({
        mode: "invalid", configured: false, missing: [], invalid: ["AUTH_MODE"],
      });
    });
  });

  it("NODE_ENV desconocido no habilita disabled", () => {
    expect(getAuthModeStatusFromEnv({ AUTH_MODE: "disabled" })).toEqual({
      mode: "invalid", configured: false, missing: [], invalid: ["AUTH_MODE"],
    });
  });
});

describe("DATA_MODE", () => {
  it("ausente → local; inválidos fallan cerrado", () => {
    expect(getDataModeStatusFromEnv({})).toEqual({ mode: "local", configured: false, missing: [], invalid: [] });
  });

  it.each(["locall", "LOCAL", " local", "local ", ""])(
    "DATA_MODE inválido %j",
    (DATA_MODE) => expect(getDataModeStatusFromEnv({ ...configured, DATA_MODE })).toEqual({
      mode: "invalid", configured: false, missing: [], invalid: ["DATA_MODE"],
    }),
  );
});
