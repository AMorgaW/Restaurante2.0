"use client";

import Link from "next/link";
import { BarChart3, BookOpen, CircleUserRound, LogOut, PackageSearch, ShieldAlert, ShoppingBag, Store, Timer } from "lucide-react";
import { useMemo } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import { EmployeeMenuDay } from "@/components/employee/employee-menu-day";
import { EmployeeOrderQueue } from "@/components/employee/employee-order-queue";
import { EmployeeQuickInventory } from "@/components/employee/employee-quick-inventory";
import { EmployeeShiftPanels } from "@/components/employee/employee-shift-panels";
import { Badge } from "@/components/ui/badge";
import { SkipLink } from "@/components/ui/skip-link";
import { useMounted } from "@/hooks/use-mounted";
import { useServicePeriod } from "@/hooks/use-service-period";
import { branches } from "@/config/restaurant";
import { menuItems } from "@/data/menu";
import { canAccessEmployeeSection, isEmployeeRole, getEmployeeNavigation, type EmployeeRole } from "@/lib/employee/authorization";
import { DEMO_EMPLOYEE_ACTIVITIES, DEMO_EMPLOYEE_INCIDENTS, DEMO_EMPLOYEE_PROFILES, DEMO_EMPLOYEE_SHIFTS } from "@/lib/employee/fixtures";
import { getEmployeeMenuItems, getEmployeeMetrics, getQuickInventoryItems, servicePeriodLabel } from "@/lib/employee/selectors";
import { toEmployeeDemoProfile } from "@/lib/staff/selectors";
import type { ServiceSnapshot } from "@/lib/menu/service-period";
import { getOpeningStatus } from "@/lib/menu/opening-hours";
import { useAdminStore } from "@/stores/admin";
import { useInventoryStore } from "@/stores/inventory";
import { useOrdersStore } from "@/stores/orders";
import { useStaffStore } from "@/stores/staff";
import { resetStaffDemo } from "@/stores/staff";
import { resetPensionDemo } from "@/stores/pension";

const ROLE_LABELS: Record<EmployeeRole, string> = {
  manager: "Gerente",
  kitchen: "Cocina",
  cashier: "Caja",
  editor: "Editor",
  support: "Atención",
};

const NAV_ICONS = { home: Store, orders: ShoppingBag, menu: BookOpen, inventory: PackageSearch, history: BarChart3, incidents: ShieldAlert } as const;

export function EmployeeWorkspace({ initialSnapshot, mode, supabaseRole, supabaseProfile }: { initialSnapshot: ServiceSnapshot; mode: "local" | "supabase" | "closed"; supabaseRole?: EmployeeRole; supabaseProfile?: { id: string; name: string | null; email: string | null; branchIds?: string[]; branchNames?: string[] } }) {
  const mounted = useMounted();
  const demoRole = useAdminStore((state) => state.demoRole);
  const staffMembers = useStaffStore((state) => state.members);
  const selectedEmployeeId = useStaffStore((state) => state.selectedEmployeeId);
  const logout = useAdminStore((state) => state.logout);
  const orders = useOrdersStore((state) => state.orders);
  const inventoryItems = useInventoryStore((state) => state.items);
  const service = useServicePeriod(initialSnapshot);
  const branch = branches[0]!;
  const selectedStaff = selectedEmployeeId ? staffMembers.find((member) => member.id === selectedEmployeeId) ?? null : null;
  const selectedStaffRole = selectedStaff && selectedStaff.status === "active" && isEmployeeRole(selectedStaff.role) ? selectedStaff.role : null;
  const effectiveRole = mode === "supabase" ? supabaseRole ?? null : selectedStaffRole ?? demoRole;
  const staffBranchIds = useMemo(() => mode === "supabase" ? (supabaseProfile?.branchIds?.length ? supabaseProfile.branchIds : [branch.id]) : selectedStaff?.branchIds ?? [branch.id], [branch.id, mode, selectedStaff?.branchIds, supabaseProfile?.branchIds]);
  const scopedOrders = useMemo(() => orders.filter((order) => staffBranchIds.includes(order.branchId)), [orders, staffBranchIds]);
  const metrics = useMemo(() => getEmployeeMetrics(scopedOrders), [scopedOrders]);
  const menu = useMemo(() => getEmployeeMenuItems(menuItems, service.period, inventoryItems), [service.period, inventoryItems]);
  const quickInventory = useMemo(() => getQuickInventoryItems(inventoryItems), [inventoryItems]);

  if (mode === "closed") {
    return <div className="flex min-h-dvh items-center justify-center px-5 py-10"><main id="contenido" className="w-full max-w-md rounded-card border border-border-soft bg-surface p-6 text-center"><BrandMark size="md" className="justify-center" /><h1 className="mt-5 text-2xl font-extrabold">Experiencia de empleado cerrada</h1><p role="alert" className="mt-3 text-sm leading-relaxed text-muted">La resolución real del perfil se habilitará con Auth en la Etapa 6. El modo demo no se activa fuera de DATA_MODE local.</p><Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-button bg-action px-5 font-bold text-action-foreground">Volver a la tienda</Link></main></div>;
  }

  if (!mounted) return <div aria-busy="true" className="flex min-h-dvh items-center justify-center px-5"><div className="skeleton h-64 w-full max-w-3xl rounded-card" /></div>;

  if (mode !== "supabase" && ((selectedEmployeeId && (!selectedStaff || selectedStaff.status !== "active" || !selectedStaffRole)) || !isEmployeeRole(effectiveRole))) {
    return <div className="flex min-h-dvh items-center justify-center px-5 py-10"><main id="contenido" className="w-full max-w-md rounded-card border border-border-soft bg-surface p-6 text-center" tabIndex={-1}><ShieldAlert aria-hidden className="mx-auto size-10 text-warning" /><h1 className="mt-4 text-2xl font-extrabold">Acceso de empleado no disponible</h1><p role="alert" className="mt-3 text-sm leading-relaxed text-muted">Selecciona un cargo de empleado en el modo demo local. Administrador y cliente usan entradas separadas.</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Link href="/admin" className="inline-flex min-h-11 items-center rounded-button bg-action px-5 font-bold text-action-foreground">Ir a administración</Link><Link href="/" className="inline-flex min-h-11 items-center rounded-button border border-border-soft px-5 font-bold">Volver</Link></div></main></div>;
  }

  const role = effectiveRole as EmployeeRole;
  const profile = mode === "supabase"
    ? { id: supabaseProfile?.id ?? "supabase-user", name: supabaseProfile?.name ?? "Empleado", role, branchId: staffBranchIds[0] ?? branch.id, branchName: supabaseProfile?.branchNames?.[0] ?? branch.name }
    : (selectedStaff ? toEmployeeDemoProfile(selectedStaff) : null) ?? DEMO_EMPLOYEE_PROFILES.find((candidate) => candidate.role === role)!;
  const shift = DEMO_EMPLOYEE_SHIFTS.find((candidate) => candidate.profileId === profile.id)!;
  const opening = getOpeningStatus(branch, new Date(service.observedAt));
  const navigation = getEmployeeNavigation(role);
  const time = new Date(service.observedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  function handleLogout() {
    logout();
    resetStaffDemo();
    resetPensionDemo();
    window.location.assign("/login");
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background">
      <SkipLink />
      <header className="border-b border-border-soft bg-background-secondary/80 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] md:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div><BrandMark size="sm" /><p className="mt-2 text-xs font-extrabold uppercase tracking-[0.18em] text-lime">Empleado · demo local</p></div>
          <div className="flex items-center gap-2"><div className="hidden text-right sm:block"><p className="text-sm font-bold">{profile.name}</p><p className="text-xs text-muted">{ROLE_LABELS[role]} · {profile.branchName}</p></div><div className="flex size-11 items-center justify-center rounded-full border border-border-soft bg-white/6" aria-hidden><CircleUserRound className="size-6 text-lime" /></div>{mode === "supabase" ? <form action="/auth/signout" method="post"><button type="submit" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-soft px-3 text-sm font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-lime"><LogOut aria-hidden className="size-4" />Salir</button></form> : <button type="button" onClick={handleLogout} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-soft px-3 text-sm font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-lime"><LogOut aria-hidden className="size-4" />Salir</button>}</div>
        </div>
        <div className="mx-auto mt-4 flex max-w-6xl flex-wrap items-center gap-2 text-sm"><Badge variant={opening.open ? "success" : "warning"}>{opening.open ? "Servicio activo" : "Servicio cerrado"}</Badge><span className="text-muted">{servicePeriodLabel(service.period)} · {time}</span><span className="text-muted">· Turno {shift.status === "active" ? "activo" : "finalizado"}</span></div>
      </header>

      <main id="contenido" className="mx-auto w-full max-w-6xl px-4 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pb-10">
        <section aria-labelledby="empleado-resumen" className="rounded-card border border-border-soft bg-surface p-4 md:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lime">Operación rápida</p><h1 id="empleado-resumen" className="mt-1 text-2xl font-extrabold">Hola, {profile.name.split(" ")[0]}</h1><p className="mt-1 text-sm text-muted">{shift.summary}</p></div><Badge variant="lime">Datos locales</Badge></div><div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-6">{[["Nuevos", metrics.newOrders], ["Preparando", metrics.preparing], ["Listos", metrics.ready], ["Entregados", metrics.delivered], ["Domicilios", metrics.deliveries], ["Locales", metrics.localOrders]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-border-soft bg-background-secondary/50 p-3"><p className="text-2xl font-extrabold tabular-nums">{value}</p><p className="mt-1 text-xs font-semibold text-muted">{label}</p></div>)}</div></section>

        <nav aria-label="Secciones de empleado" className="sticky top-0 z-20 -mx-4 mt-5 border-y border-border-soft bg-background/95 px-4 py-2 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0"><ul className="no-scrollbar flex gap-2 overflow-x-auto pb-1 md:flex-wrap">{navigation.map((item) => { const Icon = NAV_ICONS[item.section]; return <li key={item.section}><a href={item.section === "home" ? "#contenido" : `#${item.section}`} className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-soft bg-surface px-3 text-sm font-semibold text-muted hover:border-lime/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-lime"><Icon aria-hidden className="size-4" />{item.label}</a></li>; })}</ul></nav>

        <div className="mt-6 grid gap-8">
          {canAccessEmployeeSection(role, "orders") ? <EmployeeOrderQueue role={role} observedAt={service.observedAt} orders={scopedOrders} /> : null}
          {canAccessEmployeeSection(role, "menu") ? <EmployeeMenuDay role={role} period={service.period} menuItems={menu} /> : null}
          {canAccessEmployeeSection(role, "inventory") ? <EmployeeQuickInventory items={quickInventory} /> : null}
          <EmployeeShiftPanels role={role} profile={profile} shift={shift} activities={DEMO_EMPLOYEE_ACTIVITIES} incidents={DEMO_EMPLOYEE_INCIDENTS} orders={scopedOrders} observedAt={service.observedAt} showHistory={canAccessEmployeeSection(role, "history")} showIncidents={canAccessEmployeeSection(role, "incidents")} />
        </div>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-soft bg-background/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden"><p className="mx-auto flex max-w-md items-center justify-center gap-2 text-center text-xs font-semibold text-muted"><Timer aria-hidden className="size-4 text-lime" />{ROLE_LABELS[role]} · {profile.branchName}</p></div>
    </div>
  );
}
