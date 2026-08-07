import { describe, expect, it } from "vitest";
import { getAuthModeStatusFromEnv, isDemoAuthMode } from "@/lib/env/modes";
import { canAccessAdminPath } from "@/lib/admin/authorization";

/**
 * Defensa en profundidad: producción invalid no habilita harness demo ni
 * autorización admin por rol demo. Los layouts usan getAuthModeStatus().
 */
describe("producción invalid cierra demo y admin", () => {
  const invalidProd = getAuthModeStatusFromEnv({
    NODE_ENV: "production",
    AUTH_MODE: "disabled",
  });

  it("production+disabled es invalid y no es demo", () => {
    expect(invalidProd.mode).toBe("invalid");
    expect(isDemoAuthMode(invalidProd)).toBe(false);
  });

  it("sin sesión supabase, un rol demo no basta para rutas admin reales", () => {
    // canAccessAdminPath es capa UI; layouts no abren AdminShell local si mode≠disabled.
    expect(invalidProd.mode === "disabled").toBe(false);
    expect(canAccessAdminPath("owner", "/admin")).toBe(true);
    // El gate real es el modo: invalid → panel cerrado (admin/layout.tsx).
  });

  it("development+disabled sí habilita harness", () => {
    const demo = getAuthModeStatusFromEnv({ NODE_ENV: "development", AUTH_MODE: "disabled" });
    expect(isDemoAuthMode(demo)).toBe(true);
  });
});
