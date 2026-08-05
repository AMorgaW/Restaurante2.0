import { canAccessAdminPath, isAdminRole, type AdminRole } from "@/lib/admin/authorization";
import { safeNextPath } from "@/lib/auth/redirect";
import type { ResolvedSession } from "@/lib/session/types";

export function isSafeInternalNext(value: string | null | undefined): value is string {
  return safeNextPath(value, "") === value && Boolean(value);
}

function matches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function canSessionUsePath(session: ResolvedSession, path: string): boolean {
  if (session.kind === "owner" || session.kind === "admin") {
    return matches(path, "/admin") && canAccessAdminPath(session.profile?.role as AdminRole, path);
  }
  if (["manager", "kitchen", "cashier", "editor", "support"].includes(session.kind)) return matches(path, "/empleado");
  if (session.kind === "customer_with_membership") return matches(path, "/pensionado") || path === "/cuenta";
  if (session.kind === "customer_without_membership") return path === "/cuenta";
  return path === "/cuenta";
}

export function resolvePostLoginDestination(session: ResolvedSession, requested?: string | null): string {
  if (isSafeInternalNext(requested) && canSessionUsePath(session, requested)) return requested;
  return session.destination;
}

export function destinationForRole(role: unknown): string {
  if (role === "owner" || role === "admin") return "/admin";
  if (isAdminRole(role) && role !== "owner" && role !== "admin") return "/empleado";
  if (role === "customer") return "/cuenta";
  return "/cuenta";
}
