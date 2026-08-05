import { describe, expect, it } from "vitest";
import { isSafeSupabasePublishableKey } from "@/lib/env/publishable-key";

function jwt(payload: Record<string, unknown>, header: Record<string, unknown> = { alg: "HS256", typ: "JWT" }) {
  const encode = (value: Record<string, unknown>) => btoa(JSON.stringify(value))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${encode(header)}.${encode(payload)}.${"a".repeat(43)}`;
}

describe("clave publicable de Supabase", () => {
  it("acepta la clave moderna y un JWT legacy anon bien formado", () => {
    expect(isSafeSupabasePublishableKey("sb_publishable_demo_value")).toBe(true);
    expect(isSafeSupabasePublishableKey(jwt({ role: "anon" }))).toBe(true);
  });

  it.each([
    "sb_secret_demo_value",
    "sb_service_role_demo_value",
    "service_role_demo_value",
    "anon_public_demo_value",
    "arbitrary",
    " sb_publishable_demo_value",
    "sb_publishable_demo_value ",
    "sb_publishable_short",
    "",
  ])("rechaza valores no publicables (%j)", (value) => {
    expect(isSafeSupabasePublishableKey(value)).toBe(false);
  });

  it("rechaza JWT privilegiado, sin rol, con JSON invalido o estructura invalida", () => {
    expect(isSafeSupabasePublishableKey(jwt({ role: "service_role" }))).toBe(false);
    expect(isSafeSupabasePublishableKey(jwt({ role: "authenticated" }))).toBe(false);
    expect(isSafeSupabasePublishableKey(jwt({}))).toBe(false);
    expect(isSafeSupabasePublishableKey("e30.bm90LWpzb24.signature")).toBe(false);
    expect(isSafeSupabasePublishableKey("eyJmalformed")).toBe(false);
  });
});
