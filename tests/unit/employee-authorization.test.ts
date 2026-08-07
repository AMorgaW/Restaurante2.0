import { describe, expect, it } from "vitest";
import { canAccessEmployeeSection, canEmployeeAction, getEmployeeNavigation, isEmployeeRole } from "@/lib/employee/authorization";

describe("capacidades de empleado", () => {
  it("expone navegación según cargo sin crear un rol employee", () => {
    expect(isEmployeeRole("employee")).toBe(false);
    expect(getEmployeeNavigation("kitchen").map((item) => item.section)).toEqual(["home", "orders", "menu", "inventory", "history"]);
    expect(getEmployeeNavigation("cashier").map((item) => item.section)).toEqual(["home", "orders", "inventory", "history", "incidents"]);
    expect(getEmployeeNavigation("editor").map((item) => item.section)).toEqual(["home", "menu", "catalog"]);
    expect(getEmployeeNavigation("editor").find((item) => item.section === "catalog")?.href).toBe("/empleado/catalogo");
    expect(getEmployeeNavigation("manager").map((item) => item.section)).toContain("catalog");
    expect(getEmployeeNavigation("support").map((item) => item.section)).toEqual(["home", "orders", "incidents"]);
    expect(canAccessEmployeeSection("kitchen", "catalog")).toBe(false);
    expect(canAccessEmployeeSection("editor", "catalog")).toBe(true);
  });

  it("mantiene acciones operativas alineadas con la máquina de estados", () => {
    expect(canEmployeeAction("kitchen", "prepare-order", "confirmed", "preparing")).toBe(true);
    expect(canEmployeeAction("kitchen", "prepare-order", "ready", "delivered")).toBe(false);
    expect(canEmployeeAction("cashier", "confirm-order", "pending", "confirmed")).toBe(true);
    expect(canEmployeeAction("cashier", "deliver-order", "ready", "delivered")).toBe(true);
    expect(canEmployeeAction("cashier", "deliver-order", "pending", "delivered")).toBe(false);
    expect(canEmployeeAction("manager", "confirm-order", "pending", "confirmed")).toBe(true);
    expect(canEmployeeAction("manager", "deliver-order", "ready", "delivered")).toBe(true);
  });

  it("deniega perfiles inexistentes, customers y cargos administrativos", () => {
    for (const role of [null, undefined, "customer", "unknown", "owner", "admin"] as const) {
      expect(canAccessEmployeeSection(role as never, "orders")).toBe(false);
      expect(canEmployeeAction(role as never, "view-orders")).toBe(false);
    }
  });

  it("deja incidencias como capacidad explícita de cargos operativos autorizados", () => {
    expect(canEmployeeAction("support", "record-incident")).toBe(false);
    expect(canEmployeeAction("manager", "record-incident")).toBe(true);
    expect(canEmployeeAction("cashier", "record-incident")).toBe(true);
    expect(canEmployeeAction("kitchen", "record-incident")).toBe(false);
    expect(canEmployeeAction("editor", "record-incident")).toBe(false);
  });
});
