import type { AdminRole } from "@/lib/admin/authorization";
import type { PensionMembership, PensionDemoProfile } from "@/lib/pension/types";
import type { StaffMember } from "@/lib/staff/types";
import { resolveSession } from "@/lib/session/resolver";
import type { ResolvedSession } from "@/lib/session/types";

export type DemoSessionState = {
  demoSessionActive?: boolean;
  demoRole?: AdminRole | null;
  selectedEmployeeId?: string | null;
  staffMembers?: StaffMember[];
  selectedProfileId?: string | null;
  pensionProfiles?: PensionDemoProfile[];
  memberships?: PensionMembership[];
};

export function resolveDemoSession(state: DemoSessionState): ResolvedSession {
  if (!state.demoSessionActive) return resolveSession({ source: "demo", user: null });

  const selectedStaff = state.selectedEmployeeId && state.staffMembers
    ? state.staffMembers.find((member) => member.id === state.selectedEmployeeId)
    : undefined;
  const role = selectedStaff?.role ?? state.demoRole;
  if (role) {
    return resolveSession({
      source: "demo",
      user: { id: selectedStaff?.id ?? `demo-${role}`, email: selectedStaff?.email ?? `${role}.demo@example.test` },
      profile: selectedStaff
        ? { ...selectedStaff }
        : { id: `demo-${role}`, name: role === "owner" ? "Jefe demo" : "Personal demo", email: `${role}.demo@example.test`, role, branchIds: [], branchNames: [], status: "active" },
    });
  }

  const profile = state.pensionProfiles?.find((candidate) => candidate.id === state.selectedProfileId);
  if (!profile) return resolveSession({ source: "demo", user: null });
  const membership = state.memberships?.find((candidate) => candidate.profileId === profile.id);
  return resolveSession({ source: "demo", user: { id: profile.id, email: profile.email }, profile, membershipStatus: membership?.status });
}
