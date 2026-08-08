import {
  adminRoleCan,
  allowedOrderStatusTransitions,
  isAdminRole,
  type AdminCapability,
  type AdminRole,
} from "@/lib/admin/authorization";
import type { OrderStatus } from "@/types/order";

export const EMPLOYEE_ROLES = ["manager", "kitchen", "cashier", "editor", "support"] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export type EmployeeSection = "home" | "orders" | "menu" | "catalog" | "inventory" | "history" | "incidents" | "tables";
export type EmployeeAction =
  | "view-orders"
  | "prepare-order"
  | "confirm-order"
  | "deliver-order"
  | "view-menu"
  | "edit-catalog"
  | "view-inventory"
  | "view-history"
  | "view-incidents"
  | "record-incident"
  | "view-tables"
  | "confirm-manual-payments";

const SECTION_CAPABILITY: Partial<Record<Exclude<EmployeeSection, "home">, AdminCapability>> = {
  orders: "read-orders",
  menu: "read-catalog",
  catalog: "edit-catalog",
  inventory: "read-inventory",
  history: "read-history",
  incidents: "read-incidents",
  tables: "confirm-manual-payments",
};

const ACTION_CAPABILITY: Record<Exclude<EmployeeAction, "prepare-order" | "confirm-order" | "deliver-order" | "record-incident">, AdminCapability> = {
  "view-orders": "read-orders",
  "view-menu": "read-catalog",
  "edit-catalog": "edit-catalog",
  "view-inventory": "read-inventory",
  "view-history": "read-history",
  "view-incidents": "read-incidents",
  "view-tables": "confirm-manual-payments",
  "confirm-manual-payments": "confirm-manual-payments",
};

export function isEmployeeRole(value: unknown): value is EmployeeRole {
  return typeof value === "string" && (EMPLOYEE_ROLES as readonly string[]).includes(value);
}

export function canAccessEmployeeSection(role: AdminRole | null | undefined, section: EmployeeSection): boolean {
  if (!isEmployeeRole(role)) return false;
  if (section === "home") return true;
  const capability = SECTION_CAPABILITY[section];
  return capability ? adminRoleCan(role, capability) : false;
}

export function canEmployeeAction(
  role: AdminRole | null | undefined,
  action: EmployeeAction,
  currentStatus?: OrderStatus,
  desiredStatus?: OrderStatus,
): boolean {
  if (!isEmployeeRole(role)) return false;
  if (action === "prepare-order") return (role === "kitchen" || role === "manager") && Boolean(currentStatus && desiredStatus && allowedOrderStatusTransitions(role, currentStatus).includes(desiredStatus));
  if (action === "confirm-order") return (role === "cashier" || role === "manager") && Boolean(currentStatus && desiredStatus && allowedOrderStatusTransitions(role, currentStatus).includes(desiredStatus));
  if (action === "deliver-order") return (role === "cashier" || role === "manager") && Boolean(currentStatus && desiredStatus && allowedOrderStatusTransitions(role, currentStatus).includes(desiredStatus));
  if (action === "record-incident") return role === "manager" || role === "cashier";
  return adminRoleCan(role, ACTION_CAPABILITY[action]);
}

export function getEmployeeNavigation(role: AdminRole | null | undefined): Array<{
  section: EmployeeSection;
  label: string;
  href?: string;
}> {
  const candidates: Array<{ section: EmployeeSection; label: string; href?: string }> = [
    { section: "home", label: "Inicio" },
    { section: "orders", label: "Pedidos" },
    { section: "tables", label: "Mesas", href: "/empleado/mesas" },
    { section: "menu", label: isEmployeeRole(role) && role === "editor" ? "Menú del día" : "Menú" },
    { section: "catalog", label: "Gestionar catálogo", href: "/empleado/catalogo" },
    { section: "inventory", label: "Inventario" },
    { section: "history", label: "Historial" },
    { section: "incidents", label: "Incidencias" },
  ];
  return candidates.filter((item) => canAccessEmployeeSection(role, item.section));
}

export function isAdminOnlyRole(role: AdminRole | null | undefined): boolean {
  return isAdminRole(role) && (role === "owner" || role === "admin");
}
