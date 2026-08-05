import { describe, expect, it } from "vitest";
import {
  hasSupabaseAuthCookie,
  isolatePrivateResponse,
  isPrivateAuthPath,
  requiresPrivateResponse,
} from "@/lib/auth/middleware-policy";

describe("aislamiento SSR en middleware", () => {
  it.each(["/auth/callback", "/cuenta", "/login", "/registro", "/recuperar-contrasena", "/actualizar-contrasena", "/admin", "/admin/pedidos", "/empleado", "/pensionado"])(
    "considera privada la ruta %s",
    (pathname) => expect(isPrivateAuthPath(pathname)).toBe(true),
  );

  it("mantiene cacheable una pagina publica anonima sin escritura de cookies", () => {
    expect(requiresPrivateResponse({
      pathname: "/menu", hadAuthCookie: false, authenticated: false, wroteCookies: false,
    })).toBe(false);
  });

  it.each([
    { pathname: "/menu", hadAuthCookie: true, authenticated: false, wroteCookies: false },
    { pathname: "/menu", hadAuthCookie: false, authenticated: true, wroteCookies: false },
    { pathname: "/menu", hadAuthCookie: false, authenticated: false, wroteCookies: true },
    { pathname: "/cuenta", hadAuthCookie: false, authenticated: false, wroteCookies: false },
  ])("aísla respuestas dependientes de Auth %#", (scenario) => {
    expect(requiresPrivateResponse(scenario)).toBe(true);
  });

  it("solo reconoce nombres de cookie Auth de Supabase", () => {
    expect(hasSupabaseAuthCookie(["theme", "rb-cart"])).toBe(false);
    expect(hasSupabaseAuthCookie(["sb-project-auth-token"])).toBe(true);
    expect(hasSupabaseAuthCookie(["sb-project-auth-token.0"])).toBe(true);
  });

  it("combina Vary y aplica private no-store", () => {
    const headers = new Headers({ Vary: "Accept-Encoding" });
    isolatePrivateResponse(headers);
    expect(headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(headers.get("Vary")).toBe("Accept-Encoding, Cookie");
    isolatePrivateResponse(headers);
    expect(headers.get("Vary")).toBe("Accept-Encoding, Cookie");
  });
});
