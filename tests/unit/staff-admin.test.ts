import { describe, expect, it } from "vitest";
import { DEMO_STAFF_MEMBERS } from "@/lib/staff/fixtures";
import { assignStaffBranches, changeStaffRole, setStaffStatus, StaffDomainError } from "@/lib/staff/operations";
import { filterStaff, getStaffCapabilities, isStaffRole, toEmployeeDemoProfile } from "@/lib/staff/selectors";

describe("gestión local de empleados", () => {
  it("filtra por cargo, sucursal y estado sin duplicar perfiles", () => {
    expect(filterStaff(DEMO_STAFF_MEMBERS, { search: "cocina", role: "kitchen", branchId: "branch-centro", status: "active" })).toHaveLength(1);
    expect(filterStaff(DEMO_STAFF_MEMBERS, { search: "", role: "all", branchId: "branch-norte", status: "all" }).map((member) => member.id)).toContain("staff-owner");
  });

  it("solo permite cargos de empleado y conserva la protección del jefe", () => {
    expect(isStaffRole("customer")).toBe(false);
    const changed = changeStaffRole(DEMO_STAFF_MEMBERS, "owner", "demo-kitchen", "cashier");
    expect(changed.find((member) => member.id === "demo-kitchen")?.role).toBe("cashier");
    expect(() => changeStaffRole(DEMO_STAFF_MEMBERS, "admin", "demo-kitchen", "cashier")).toThrowError(StaffDomainError);
    expect(() => changeStaffRole(DEMO_STAFF_MEMBERS, "owner", "demo-kitchen", "customer")).toThrowError(StaffDomainError);
    expect(() => setStaffStatus(DEMO_STAFF_MEMBERS, "owner", "staff-owner", "suspended")).toThrowError(StaffDomainError);
  });

  it("valida sucursal y refleja capacidades en el perfil de empleado", () => {
    const changed = assignStaffBranches(DEMO_STAFF_MEMBERS, "owner", "demo-support", ["branch-norte"], ["branch-centro", "branch-norte"]);
    const support = changed.find((member) => member.id === "demo-support")!;
    expect(support.branchIds).toEqual(["branch-norte"]);
    expect(toEmployeeDemoProfile(support)?.branchId).toBe("branch-norte");
    expect(getStaffCapabilities("cashier")).toContain("transition-orders");
    expect(() => assignStaffBranches(DEMO_STAFF_MEMBERS, "owner", "demo-support", [], ["branch-centro"])).toThrowError(StaffDomainError);
  });
});
