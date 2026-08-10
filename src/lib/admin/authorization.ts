import type { OrderStatus } from "@/types/order";

export const ADMIN_ROLES = [
  "owner",
  "admin",
  "manager",
  "kitchen",
  "cashier",
  "editor",
  "support",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];
export type AdminSection = "dashboard" | "catalog" | "inventory" | "orders" | "branches" | "marketing" | "settings" | "employees" | "pensioners" | "tables";
export type AdminCapability =
  | "view-dashboard"
  | "edit-catalog"
  | "read-catalog"
  | "edit-prices"
  | "manage-inventory"
  | "read-inventory"
  | "read-orders"
  | "transition-orders"
  | "read-history"
  | "read-incidents"
  | "view-branches"
  | "view-marketing"
  | "edit-settings"
  | "manage-users"
  | "read-employees"
  | "manage-employees"
  | "read-pension-memberships"
  | "manage-pension-memberships"
  | "read-pension-consumption"
  | "manage-dining-tables"
  | "confirm-manual-payments"
  | "void-manual-payments";

export const ROLE_CAPABILITIES: Record<AdminRole, ReadonlySet<AdminCapability>> = {
  owner: new Set(["view-dashboard", "edit-catalog", "read-catalog", "edit-prices", "manage-inventory", "read-inventory", "read-orders", "transition-orders", "read-history", "read-incidents", "view-branches", "view-marketing", "edit-settings", "manage-users", "read-employees", "manage-employees", "read-pension-memberships", "manage-pension-memberships", "read-pension-consumption", "manage-dining-tables", "confirm-manual-payments", "void-manual-payments"]),
  admin: new Set(["view-dashboard", "edit-catalog", "read-catalog", "edit-prices", "manage-inventory", "read-inventory", "read-orders", "transition-orders", "read-history", "read-incidents", "view-branches", "view-marketing", "edit-settings", "manage-users", "read-employees", "read-pension-memberships", "manage-pension-memberships", "read-pension-consumption", "manage-dining-tables", "confirm-manual-payments", "void-manual-payments"]),
  manager: new Set(["view-dashboard", "edit-catalog", "read-catalog", "edit-prices", "read-inventory", "read-orders", "transition-orders", "read-history", "read-incidents", "view-branches", "view-marketing", "read-employees", "read-pension-memberships", "read-pension-consumption", "confirm-manual-payments"]),
  kitchen: new Set(["view-dashboard", "read-catalog", "read-inventory", "read-orders", "transition-orders", "read-history"]),
  cashier: new Set(["view-dashboard", "read-inventory", "read-orders", "transition-orders", "read-history", "read-incidents", "confirm-manual-payments"]),
  editor: new Set(["view-dashboard", "edit-catalog", "read-catalog", "edit-prices"]),
  support: new Set(["view-dashboard", "read-orders", "read-incidents"]),
};

const SECTION_CAPABILITY: Record<AdminSection, AdminCapability> = {
  dashboard: "view-dashboard",
  catalog: "edit-catalog",
  inventory: "manage-inventory",
  orders: "read-orders",
  branches: "view-branches",
  marketing: "view-marketing",
  settings: "edit-settings",
  employees: "read-employees",
  pensioners: "read-pension-memberships",
  tables: "manage-dining-tables",
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function adminRoleCan(role: AdminRole | null | undefined, capability: AdminCapability): boolean {
  return isAdminRole(role) ? ROLE_CAPABILITIES[role].has(capability) : false;
}

export function canAccessAdminSection(role: AdminRole | null | undefined, section: AdminSection): boolean {
  return adminRoleCan(role, SECTION_CAPABILITY[section]);
}

export function getAdminSectionForPath(pathname: string): AdminSection | null {
  if (pathname === "/admin") return "dashboard";
  if (pathname === "/admin/platos" || pathname.startsWith("/admin/platos/") ||
      pathname === "/admin/categorias" || pathname.startsWith("/admin/categorias/")) return "catalog";
  if (pathname === "/admin/inventario" || pathname.startsWith("/admin/inventario/")) return "inventory";
  if (pathname === "/admin/pedidos" || pathname.startsWith("/admin/pedidos/")) return "orders";
  if (pathname === "/admin/sucursales" || pathname.startsWith("/admin/sucursales/")) return "branches";
  if (pathname === "/admin/promociones" || pathname.startsWith("/admin/promociones/")) return "marketing";
  if (pathname === "/admin/configuracion" || pathname.startsWith("/admin/configuracion/")) return "settings";
  if (pathname === "/admin/empleados" || pathname.startsWith("/admin/empleados/")) return "employees";
  if (pathname === "/admin/pensionados" || pathname.startsWith("/admin/pensionados/")) return "pensioners";
  if (pathname === "/admin/mesas" || pathname.startsWith("/admin/mesas/")) return "tables";
  return null;
}

/**
 * Paths kept for domain/routes but not promoted in admin product UX
 * (single-branch operation; marketing deferred from admin chrome).
 */
function isHiddenAdminProductPath(pathname: string): boolean {
  return (
    pathname === "/admin/sucursales" ||
    pathname.startsWith("/admin/sucursales/") ||
    pathname === "/admin/promociones" ||
    pathname.startsWith("/admin/promociones/")
  );
}

export function canAccessAdminPath(role: AdminRole | null | undefined, pathname: string): boolean {
  if (isHiddenAdminProductPath(pathname)) return false;
  const section = getAdminSectionForPath(pathname);
  return section !== null && canAccessAdminSection(role, section);
}

export type OrderTransitionOptions = {
  /**
   * @deprecated 11B-4: `delivered` está habilitado; PostgreSQL consume inventario.
   * Conservado solo por compatibilidad de firmas de tests legacy.
   */
  blockDelivered?: boolean;
};

export function allowedOrderStatusTransitions(
  role: AdminRole | null | undefined,
  current: OrderStatus,
  options?: OrderTransitionOptions,
): OrderStatus[] {
  if (!role || current === "delivered" || current === "cancelled") return [];
  let next: OrderStatus[] = [];
  if (role === "kitchen") {
    if (current === "confirmed") next = ["preparing"];
    else if (current === "preparing") next = ["ready"];
  } else if (role === "cashier") {
    if (current === "pending") next = ["confirmed"];
    else if (current === "ready") next = ["delivered"];
  } else if (role === "owner" || role === "admin" || role === "manager") {
    if (current === "pending") next = ["confirmed", "cancelled"];
    else if (current === "confirmed") next = ["preparing", "cancelled"];
    else if (current === "preparing") next = ["ready", "cancelled"];
    else if (current === "ready") next = ["delivered"];
  }
  if (options?.blockDelivered) {
    return next.filter((status) => status !== "delivered");
  }
  return next;
}

export function canTransitionOrderStatus(
  role: AdminRole | null | undefined,
  current: OrderStatus,
  next: OrderStatus,
  options?: OrderTransitionOptions,
): boolean {
  return allowedOrderStatusTransitions(role, current, options).includes(next);
}
