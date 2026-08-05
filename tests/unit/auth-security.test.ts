import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";

describe("redirecciones de Auth", () => {
  it("acepta rutas internas y conserva su query", () => {
    expect(safeNextPath("/cuenta?tab=perfil")).toBe("/cuenta?tab=perfil");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "\\\\evil.example",
    "/\\evil.example",
    "%2f%2fevil.example",
    "%252f%252fevil.example",
    "/%5cevil.example",
    "/login?next=https://evil.example",
    "/login?next=%252f%252fevil.example",
    "/cuenta%00",
    "javascript:alert(1)",
  ])(
    "rechaza open redirect %s",
    (value) => expect(safeNextPath(value)).toBe("/cuenta"),
  );

  it("usa un fallback controlado cuando falta next", () => {
    expect(safeNextPath(null, "/menu")).toBe("/menu");
  });
});
