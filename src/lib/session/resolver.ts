import { isAdminRole } from "@/lib/admin/authorization";
import type { SessionInput, ResolvedSession, SessionProfile } from "@/lib/session/types";

const STAFF_KINDS = new Set(["owner", "admin", "manager", "kitchen", "cashier", "editor", "support"]);

export function resolveSession(input: SessionInput): ResolvedSession {
  if (!input.user) {
    return { kind: "anonymous", source: input.source, destination: "/login", userId: null, email: null, profile: null, reason: "not_authenticated" };
  }

  if (!input.profile) {
    return { kind: "authenticated_without_profile", source: input.source, destination: "/cuenta", userId: input.user.id, email: input.user.email ?? null, profile: null, reason: "profile_missing" };
  }

  const role = input.profile.role;
  const profile: SessionProfile = {
    id: input.profile.id,
    name: input.profile.name ?? null,
    email: input.profile.email ?? input.user.email ?? null,
    role: isAdminRole(role) ? role : role === "customer" ? "customer" : "customer",
    branchIds: input.profile.branchIds ?? [],
    branchNames: input.profile.branchNames ?? [],
    status: input.profile.status,
  };

  if (role === "customer") {
    return input.membershipStatus
      ? { kind: "customer_with_membership", source: input.source, destination: "/pensionado", userId: input.user.id, email: profile.email, profile, membershipStatus: input.membershipStatus }
      : { kind: "customer_without_membership", source: input.source, destination: "/cuenta", userId: input.user.id, email: profile.email, profile };
  }

  if (!isAdminRole(role)) {
    return { kind: "unknown_role", source: input.source, destination: "/cuenta", userId: input.user.id, email: profile.email, profile, reason: "unknown_role" };
  }
  if (STAFF_KINDS.has(role) && input.profile.status !== undefined && input.profile.status !== "active") {
    return { kind: "suspended_staff", source: input.source, destination: "/cuenta", userId: input.user.id, email: profile.email, profile, reason: "staff_suspended" };
  }
  return { kind: role, source: input.source, destination: role === "owner" || role === "admin" ? "/admin" : "/empleado", userId: input.user.id, email: profile.email, profile } as ResolvedSession;
}
