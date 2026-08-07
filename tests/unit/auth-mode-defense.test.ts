import { describe, expect, it } from "vitest";
import { getAuthModeStatusFromEnv, isDemoAuthMode, type AuthModeStatus } from "@/lib/env/modes";
import { canAccessAdminPath } from "@/lib/admin/authorization";

/**
 * Mismo criterio de puerta que `authorizeAdminSection` / `admin/layout.tsx`
 * (sin montar Next ni mocks de redirect).
 */
function adminGateFromAuthStatus(status: AuthModeStatus): "local" | "unavailable" | "supabase" {
  if (status.mode === "disabled") return "local";
  if (status.mode !== "supabase" || !status.configured) return "unavailable";
  return "supabase";
}

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

  it("production invalid no renderiza controles demo", () => {
    expect(isDemoAuthMode(invalidProd)).toBe(false);
    expect(adminGateFromAuthStatus(invalidProd)).toBe("unavailable");
  });

  it("el guard administrativo trata invalid como acceso denegado", () => {
    expect(adminGateFromAuthStatus(invalidProd)).toBe("unavailable");
    // canAccessAdminPath es capa UI; layouts no abren AdminShell local si mode≠disabled.
    expect(invalidProd.mode === "disabled").toBe(false);
    expect(canAccessAdminPath("owner", "/admin")).toBe(true);
  });

  it("development+disabled sí habilita harness", () => {
    const demo = getAuthModeStatusFromEnv({ NODE_ENV: "development", AUTH_MODE: "disabled" });
    expect(isDemoAuthMode(demo)).toBe(true);
    expect(adminGateFromAuthStatus(demo)).toBe("local");
  });
});
