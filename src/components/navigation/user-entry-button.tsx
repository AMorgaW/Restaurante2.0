"use client";

import { UserRound } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { PENSION_DEMO_MEMBERSHIPS, PENSION_DEMO_PROFILES } from "@/lib/pension/fixtures";
import { resolveDemoSession } from "@/lib/session/demo-resolver";
import { useAdminStore } from "@/stores/admin";
import { usePensionStore } from "@/stores/pension";
import { useStaffStore } from "@/stores/staff";

/** Entrada de cuenta: las cuentas son opcionales y el acceso siempre es una ruta interna. */
export function UserEntryButton({
  className,
  ...props
}: { className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const admin = useAdminStore();
  const pension = usePensionStore();
  const staff = useStaffStore();
  const session = resolveDemoSession({
    demoSessionActive: admin.demoSessionActive || pension.demoSessionActive,
    demoRole: admin.demoRole,
    selectedEmployeeId: staff.selectedEmployeeId,
    staffMembers: staff.members,
    selectedProfileId: pension.selectedProfileId,
    pensionProfiles: PENSION_DEMO_PROFILES,
    memberships: PENSION_DEMO_MEMBERSHIPS,
  });
  return (
    <button
      type="button"
      {...props}
      aria-label={session.kind === "anonymous" ? "Iniciar sesión" : "Ver mi cuenta"}
      title={session.kind === "anonymous" ? "Iniciar sesión" : "Ver mi cuenta"}
      onClick={async (event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented && !props.disabled) {
          if (session.kind !== "anonymous") {
            window.location.assign("/cuenta");
            return;
          }
          try {
            const response = await fetch("/auth/state", { cache: "no-store" });
            const state = await response.json() as { authenticated?: boolean };
            window.location.assign(state.authenticated ? "/cuenta" : "/login");
          } catch {
            window.location.assign("/login");
          }
        }
      }}
      className={cn(
        "group/user relative inline-flex size-11 shrink-0 items-center justify-center rounded-full",
        "border border-white/14 bg-white/[0.07] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        "transition-[transform,background-color,border-color,box-shadow] duration-200",
        "hover:border-lime/35 hover:bg-white/[0.11] hover:shadow-[0_12px_30px_-18px_rgba(183,255,60,0.7)]",
        "active:scale-[0.95] motion-reduce:active:scale-100",
        className,
      )}
    >
      <UserRound aria-hidden className="size-5 transition-transform duration-200 group-hover/user:scale-105 motion-reduce:transition-none" />
    </button>
  );
}
