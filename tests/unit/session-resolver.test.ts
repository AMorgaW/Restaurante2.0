import { describe, expect, it } from "vitest";
import { resolveSession } from "@/lib/session/resolver";
import { resolvePostLoginDestination, canSessionUsePath } from "@/lib/session/destination";
import { resolveDemoSession } from "@/lib/session/demo-resolver";

const base = { id: "user-1", email: "user@example.test", name: "Usuario", branchIds: [], branchNames: [] };

describe("resolvedor central de sesión", () => {
  it.each([
    ["owner", "/admin"], ["admin", "/admin"], ["manager", "/empleado"],
    ["kitchen", "/empleado"], ["cashier", "/empleado"], ["editor", "/empleado"], ["support", "/empleado"],
  ] as const)("asigna destino seguro a %s", (role, destination) => {
    const session = resolveSession({ source: "supabase", user: base, profile: { ...base, role } });
    expect(session.kind).toBe(role);
    expect(session.destination).toBe(destination);
  });

  it("separa customer sin membresía de los estados comerciales", () => {
    const without = resolveSession({ source: "supabase", user: base, profile: { ...base, role: "customer" } });
    const pending = resolveSession({ source: "supabase", user: base, profile: { ...base, role: "customer" }, membershipStatus: "pending" });
    expect(without).toMatchObject({ kind: "customer_without_membership", destination: "/cuenta" });
    expect(pending).toMatchObject({ kind: "customer_with_membership", destination: "/pensionado", membershipStatus: "pending" });
  });

  it("falla cerrado para perfil ausente, rol desconocido y staff suspendido", () => {
    expect(resolveSession({ source: "supabase", user: base, profile: null }).kind).toBe("authenticated_without_profile");
    expect(resolveSession({ source: "supabase", user: base, profile: { ...base, role: "root" } }).kind).toBe("unknown_role");
    expect(resolveSession({ source: "supabase", user: base, profile: { ...base, role: "kitchen", status: "suspended" } }).kind).toBe("suspended_staff");
  });

  it("distingue active → espacio staff y suspended/inactive → /cuenta", () => {
    const active = resolveSession({
      source: "supabase",
      user: base,
      profile: { ...base, role: "manager", status: "active" },
    });
    const suspended = resolveSession({
      source: "supabase",
      user: base,
      profile: { ...base, role: "manager", status: "suspended" },
    });
    const inactive = resolveSession({
      source: "supabase",
      user: base,
      profile: { ...base, role: "cashier", status: "inactive" },
    });
    expect(active).toMatchObject({ kind: "manager", destination: "/empleado" });
    expect(suspended).toMatchObject({ kind: "suspended_staff", destination: "/cuenta" });
    expect(inactive).toMatchObject({ kind: "suspended_staff", destination: "/cuenta" });
  });
});

describe("destino posterior al login", () => {
  it("solo conserva next cuando el rol puede usarlo", () => {
    const owner = resolveSession({ source: "supabase", user: base, profile: { ...base, role: "owner" } });
    const customer = resolveSession({ source: "supabase", user: base, profile: { ...base, role: "customer" } });
    const manager = resolveSession({ source: "supabase", user: base, profile: { ...base, role: "manager" } });
    const editor = resolveSession({ source: "supabase", user: base, profile: { ...base, role: "editor" } });
    expect(resolvePostLoginDestination(owner, "/admin/pedidos")).toBe("/admin/pedidos");
    expect(resolvePostLoginDestination(customer, "/admin")).toBe("/cuenta");
    expect(resolvePostLoginDestination(owner, "//evil.example")).toBe("/admin");
    expect(canSessionUsePath(owner, "/admin/inventario")).toBe(true);
    expect(canSessionUsePath(customer, "/admin")).toBe(false);
    expect(canSessionUsePath(manager, "/admin")).toBe(false);
    expect(canSessionUsePath(manager, "/admin/platos")).toBe(false);
    expect(canSessionUsePath(editor, "/admin")).toBe(false);
    expect(canSessionUsePath(manager, "/empleado/catalogo")).toBe(true);
    expect(canSessionUsePath(editor, "/empleado/catalogo")).toBe(true);
    expect(resolvePostLoginDestination(manager, "/admin/platos")).toBe("/empleado");
    expect(resolvePostLoginDestination(editor, "/empleado/catalogo")).toBe("/empleado/catalogo");
  });
});

describe("sesión demo", () => {
  it("no crea identidad hasta que el acceso demo se inicia", () => {
    expect(resolveDemoSession({ demoSessionActive: false }).kind).toBe("anonymous");
    expect(resolveDemoSession({ demoSessionActive: true, demoRole: "owner" })).toMatchObject({ kind: "owner", source: "demo", destination: "/admin" });
  });
});
