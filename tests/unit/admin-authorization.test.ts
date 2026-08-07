import { describe, expect, it } from "vitest";
import {
  adminRoleCan,
  allowedOrderStatusTransitions,
  canAccessAdminPath,
  canTransitionOrderStatus,
} from "@/lib/admin/authorization";

describe("matriz administrativa deny-by-default", () => {
  it("limita editor al catalogo y excluye operaciones sensibles", () => {
    expect(canAccessAdminPath("editor", "/admin/platos")).toBe(true);
    expect(canAccessAdminPath("editor", "/admin/categorias")).toBe(true);
    for (const path of ["/admin/pedidos", "/admin/sucursales", "/admin/promociones", "/admin/configuracion", "/admin/nueva-ruta"]) {
      expect(canAccessAdminPath("editor", path)).toBe(false);
    }
    expect(adminRoleCan("editor", "edit-prices")).toBe(true);
    expect(adminRoleCan("editor", "read-orders")).toBe(false);
    expect(canAccessAdminPath("editor", "/admin/inventario")).toBe(false);
  });

  it("reserva inventario para owner y admin", () => {
    expect(canAccessAdminPath("owner", "/admin/inventario")).toBe(true);
    expect(canAccessAdminPath("admin", "/admin/inventario")).toBe(true);
    for (const role of ["manager", "kitchen", "cashier", "support", "customer", null] as const) {
      expect(canAccessAdminPath(role as never, "/admin/inventario")).toBe(false);
    }
  });

  it("mantiene support en pedidos de solo lectura", () => {
    expect(canAccessAdminPath("support", "/admin/pedidos")).toBe(true);
    expect(adminRoleCan("support", "transition-orders")).toBe(false);
  });

  it("reserva gestion de pensionados a owner y admin; manager solo lectura", () => {
    expect(adminRoleCan("owner", "manage-pension-memberships")).toBe(true);
    expect(adminRoleCan("admin", "manage-pension-memberships")).toBe(true);
    expect(adminRoleCan("admin", "read-pension-memberships")).toBe(true);
    expect(adminRoleCan("manager", "read-pension-memberships")).toBe(true);
    expect(adminRoleCan("manager", "manage-pension-memberships")).toBe(false);
    expect(canAccessAdminPath("admin", "/admin/pensionados")).toBe(true);
    expect(canAccessAdminPath("manager", "/admin/pensionados")).toBe(true);
  });
});

describe("maquina de estados de pedidos", () => {
  it("aplica el flujo de cocina", () => {
    expect(allowedOrderStatusTransitions("kitchen", "confirmed")).toEqual(["preparing"]);
    expect(allowedOrderStatusTransitions("kitchen", "preparing")).toEqual(["ready"]);
    expect(canTransitionOrderStatus("kitchen", "ready", "delivered")).toBe(false);
    expect(canTransitionOrderStatus("kitchen", "pending", "cancelled")).toBe(false);
  });

  it("aplica el flujo comercial de caja sin saltos ni cancelacion", () => {
    expect(allowedOrderStatusTransitions("cashier", "pending")).toEqual(["confirmed"]);
    expect(allowedOrderStatusTransitions("cashier", "ready")).toEqual(["delivered"]);
    expect(canTransitionOrderStatus("cashier", "confirmed", "ready")).toBe(false);
    expect(canTransitionOrderStatus("cashier", "pending", "cancelled")).toBe(false);
  });

  it("impide no-op, saltos, retrocesos y reapertura incluso a roles superiores", () => {
    for (const role of ["owner", "admin", "manager"] as const) {
      expect(canTransitionOrderStatus(role, "pending", "pending")).toBe(false);
      expect(canTransitionOrderStatus(role, "pending", "ready")).toBe(false);
      expect(canTransitionOrderStatus(role, "ready", "preparing")).toBe(false);
      expect(allowedOrderStatusTransitions(role, "delivered")).toEqual([]);
      expect(allowedOrderStatusTransitions(role, "cancelled")).toEqual([]);
    }
  });

  it("deniega mutaciones a support, editor y roles desconocidos", () => {
    expect(allowedOrderStatusTransitions("support", "pending")).toEqual([]);
    expect(allowedOrderStatusTransitions("editor", "pending")).toEqual([]);
    expect(allowedOrderStatusTransitions("unknown" as never, "pending")).toEqual([]);
  });

  it("bloquea delivered en modo operativo supabase (11B-3)", () => {
    expect(allowedOrderStatusTransitions("cashier", "ready", { blockDelivered: true })).toEqual([]);
    expect(allowedOrderStatusTransitions("manager", "ready", { blockDelivered: true })).toEqual([]);
    expect(allowedOrderStatusTransitions("owner", "ready", { blockDelivered: true })).toEqual([]);
    expect(canTransitionOrderStatus("cashier", "ready", "delivered", { blockDelivered: true })).toBe(false);
    expect(allowedOrderStatusTransitions("cashier", "ready")).toEqual(["delivered"]);
  });
});
