import type { AdminRole } from "@/lib/admin/authorization";
import type { PensionMembershipStatus } from "@/lib/pension/types";

export type SessionSource = "demo" | "supabase";
export type SessionKind =
  | "anonymous"
  | "authenticated_without_profile"
  | "owner"
  | "admin"
  | "manager"
  | "kitchen"
  | "cashier"
  | "editor"
  | "support"
  | "customer_without_membership"
  | "customer_with_membership"
  | "unknown_role"
  | "suspended_staff";

export type SessionProfile = {
  id: string;
  name: string | null;
  email: string | null;
  role: AdminRole | "customer";
  branchIds: string[];
  branchNames: string[];
  status?: "active" | "invited" | "suspended" | "inactive";
};

export type ResolvedSession = {
  kind: SessionKind;
  source: SessionSource;
  destination: string;
  userId: string | null;
  email: string | null;
  profile: SessionProfile | null;
  membershipStatus?: PensionMembershipStatus;
  reason?: "profile_missing" | "unknown_role" | "staff_suspended" | "not_authenticated";
};

export type SessionInput = {
  source: SessionSource;
  user?: { id: string; email?: string | null } | null;
  profile?: {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: unknown;
    branchIds?: string[];
    branchNames?: string[];
    status?: SessionProfile["status"];
  } | null;
  membershipStatus?: PensionMembershipStatus | null;
};
