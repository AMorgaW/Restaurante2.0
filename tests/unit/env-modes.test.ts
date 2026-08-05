import { describe, expect, it } from "vitest";
import { getAuthModeStatusFromEnv, getDataModeStatusFromEnv } from "@/lib/env/modes";

const configured = {
  NEXT_PUBLIC_SUPABASE_URL: "https://nasenphzywwufntvrzpc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo_value",
};

describe("modos independientes de Auth y datos", () => {
  it("aplica defaults solo cuando las variables estan ausentes", () => {
    expect(getAuthModeStatusFromEnv({})).toEqual({ mode: "disabled", configured: false, missing: [], invalid: [] });
    expect(getDataModeStatusFromEnv({})).toEqual({ mode: "local", configured: false, missing: [], invalid: [] });
  });

  it("permite Auth Supabase con datos locales", () => {
    expect(getAuthModeStatusFromEnv({ ...configured, AUTH_MODE: "supabase" })).toEqual({
      mode: "supabase", configured: true, missing: [], invalid: [],
    });
    expect(getDataModeStatusFromEnv({ ...configured, AUTH_MODE: "supabase" })).toEqual({
      mode: "local", configured: false, missing: [], invalid: [],
    });
  });

  it.each(["supabse", "SUPABASE", " supabase", "supabase ", ""])(
    "falla cerrado ante AUTH_MODE presente e invalido (%j)",
    (AUTH_MODE) => expect(getAuthModeStatusFromEnv({ ...configured, AUTH_MODE })).toEqual({
      mode: "invalid", configured: false, missing: [], invalid: ["AUTH_MODE"],
    }),
  );

  it.each(["locall", "LOCAL", " local", "local ", ""])(
    "falla cerrado ante DATA_MODE presente e invalido (%j)",
    (DATA_MODE) => expect(getDataModeStatusFromEnv({ ...configured, DATA_MODE })).toEqual({
      mode: "invalid", configured: false, missing: [], invalid: ["DATA_MODE"],
    }),
  );

  it("distingue configuracion faltante de configuracion invalida", () => {
    expect(getAuthModeStatusFromEnv({ AUTH_MODE: "supabase" })).toEqual({
      mode: "supabase",
      configured: false,
      missing: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
      invalid: [],
    });
    expect(getDataModeStatusFromEnv({
      DATA_MODE: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "arbitrary",
    })).toEqual({
      mode: "supabase",
      configured: false,
      missing: [],
      invalid: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
    });
  });
});
