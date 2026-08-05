"use client";

import { ArrowLeft, BriefcaseBusiness, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useEffectiveAdminRole } from "@/components/admin/admin-role-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { branches } from "@/config/restaurant";
import { getStaffRoleLabel, getStaffStatusLabel, filterStaff, toStaffView, type EmployeeRole } from "@/lib/staff/selectors";
import type { StaffFilters, StaffMember, StaffStatus } from "@/lib/staff/types";
import { useAdminStore } from "@/stores/admin";
import { useStaffStore } from "@/stores/staff";

const EMPLOYEE_ROLES: EmployeeRole[] = ["manager", "kitchen", "cashier", "editor", "support"];
const STATUS_OPTIONS: StaffStatus[] = ["active", "suspended", "inactive", "invited"];
const DEMO_NOW = "2026-08-04T12:00:00-05:00";

type DialogState = "role" | "branch" | "status" | null;

export function StaffScreen() {
  const { toast } = useToast();
  const localRole = useAdminStore((state) => state.demoRole);
  const role = useEffectiveAdminRole(localRole);
  const members = useStaffStore((state) => state.members);
  const selectedEmployeeId = useStaffStore((state) => state.selectedEmployeeId);
  const setSelectedEmployee = useStaffStore((state) => state.setSelectedEmployee);
  const changeRole = useStaffStore((state) => state.changeRole);
  const assignBranches = useStaffStore((state) => state.assignBranches);
  const setStatus = useStaffStore((state) => state.setStatus);
  const [filters, setFilters] = useState<StaffFilters>({ search: "", role: "all", branchId: "all", status: "all" });
  const [dialog, setDialog] = useState<DialogState>(null);
  const [nextRole, setNextRole] = useState<EmployeeRole>("manager");
  const [nextBranches, setNextBranches] = useState<string[]>([]);
  const [nextStatus, setNextStatus] = useState<StaffStatus>("active");
  const [reason, setReason] = useState("");
  const filtered = useMemo(() => filterStaff(members, filters), [filters, members]);
  const counts = useMemo(() => ({ active: members.filter((member) => member.status === "active").length, suspended: members.filter((member) => member.status === "suspended").length, inactive: members.filter((member) => member.status === "inactive").length }), [members]);
  const selected = selectedEmployeeId ? members.find((member) => member.id === selectedEmployeeId) : null;
  const canManage = role === "owner";

  function openDialog(next: DialogState, member: StaffMember) {
    setSelectedEmployee(member.id);
    setDialog(next);
    setNextRole(member.role === "owner" || member.role === "admin" ? "manager" : member.role);
    setNextBranches(member.branchIds);
    setNextStatus(member.status === "active" ? "suspended" : "active");
    setReason("");
  }

  function closeDialog() { setDialog(null); setSelectedEmployee(null); }
  function run(action: () => void, title: string) {
    try { action(); closeDialog(); toast({ title, description: "El cambio quedó guardado en este navegador.", variant: "success" }); }
    catch (error) { toast({ title: "No se pudo completar", description: error instanceof Error ? error.message : "Revisa los datos e inténtalo de nuevo.", variant: "error" }); }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-lime"><ArrowLeft aria-hidden className="size-4" /> Volver al dashboard</Link>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-lime">Brisas del Sinú · Administración</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-extrabold tracking-tight"><BriefcaseBusiness aria-hidden className="size-7 text-lime" /> Empleados</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">Cargos, sucursales y capacidades del equipo demo. No se crean cuentas Auth desde este panel.</p>
        </div>
        <Badge variant="lime">{canManage ? "Demo local · Jefe" : "Consulta operativa"}</Badge>
      </header>

      <section aria-label="Resumen de empleados" className="grid grid-cols-3 gap-3">
        {[['Activos', counts.active], ['Suspendidos', counts.suspended], ['Inactivos', counts.inactive]].map(([label, value]) => <div key={label} className="rounded-card border border-border-soft bg-surface p-4"><p className="text-2xl font-extrabtrabold font-extrabold tabular-nums">{value}</p><p className="mt-1 text-xs font-semibold text-muted">{label}</p></div>)}
      </section>

      <section aria-label="Filtros de empleados" className="grid gap-3 rounded-card border border-border-soft bg-surface p-4 md:grid-cols-4">
        <label className="md:col-span-2"><span className="sr-only">Buscar empleado</span><span className="flex items-center gap-2 rounded-xl border border-border-soft bg-white/4 px-3"><Search aria-hidden className="size-4 text-muted" /><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Buscar por nombre o correo" className="min-h-11 w-full bg-transparent text-sm outline-none" /></span></label>
        <label><span className="sr-only">Filtrar por cargo</span><select value={filters.role} onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value as StaffFilters['role'] }))} className="min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3 text-sm"><option value="all">Todos los cargos</option>{["owner", "admin", ...EMPLOYEE_ROLES].map((item) => <option key={item} value={item}>{getStaffRoleLabel(item as StaffMember['role'])}</option>)}</select></label>
        <label><span className="sr-only">Filtrar por estado</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as StaffFilters['status'] }))} className="min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3 text-sm"><option value="all">Todos los estados</option>{STATUS_OPTIONS.map((item) => <option key={item} value={item}>{getStaffStatusLabel(item)}</option>)}</select></label>
        <label><span className="sr-only">Filtrar por sucursal</span><select value={filters.branchId} onChange={(event) => setFilters((current) => ({ ...current, branchId: event.target.value }))} className="min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3 text-sm md:col-span-2"><option value="all">Todas las sucursales</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      </section>

      <section aria-labelledby="lista-empleados">
        <div className="flex items-end justify-between gap-3"><div><h2 id="lista-empleados" className="text-xl font-extrabold">Equipo demo</h2><p className="mt-1 text-sm text-muted">{filtered.length} de {members.length} empleados visibles</p></div><span className="text-xs text-muted">Capacidades derivadas de la matriz central</span></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">{filtered.map((member) => { const view = toStaffView(member); const employee = member.role !== "owner" && member.role !== "admin"; return <article key={member.id} className="rounded-card border border-border-soft bg-surface p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border-soft bg-white/6"><UserRound aria-hidden className="size-5 text-lime" /></div><div className="min-w-0"><h3 className="truncate font-bold">{member.name}</h3><p className="truncate text-xs text-muted">{member.email}</p></div></div><Badge variant={member.status === "active" ? "success" : member.status === "suspended" ? "warning" : "muted"}>{getStaffStatusLabel(member.status)}</Badge></div><div className="mt-4 flex flex-wrap gap-2"><Badge variant="lime">{getStaffRoleLabel(member.role)}</Badge>{member.branchNames.map((name) => <Badge key={name} variant="muted">{name}</Badge>)}</div><p className="mt-3 text-xs leading-relaxed text-muted">Capacidades: {view.capabilities.length ? view.capabilities.map((capability) => capability.replaceAll("-", " ")).join(" · ") : "Consulta limitada"}</p><div className="mt-4 flex flex-wrap gap-2">{canManage && employee ? <><Button size="sm" variant="secondary" onClick={() => openDialog("role", member)}>Cambiar cargo</Button><Button size="sm" variant="secondary" onClick={() => openDialog("branch", member)}>Asignar sucursal</Button><Button size="sm" variant="secondary" onClick={() => openDialog("status", member)}>{member.status === "active" ? "Suspender" : "Reactivar"}</Button><Link href="/empleado" onClick={() => setSelectedEmployee(member.id)} className="inline-flex h-10 items-center rounded-button border border-lime/40 px-4 text-sm font-bold text-lime">Abrir experiencia</Link></> : null}</div></article>; })}</div>
      </section>

      <Dialog open={Boolean(dialog && selected)} onOpenChange={(open) => !open && closeDialog()} title={dialog === "role" ? "Cambiar cargo" : dialog === "branch" ? "Asignar sucursal" : "Actualizar estado"} description="Los cambios son locales, auditados y aplican a la experiencia demo del empleado.">
        {selected && dialog === "role" ? <div className="flex flex-col gap-4"><label className="text-sm font-semibold">Nuevo cargo<select value={nextRole} onChange={(event) => setNextRole(event.target.value as EmployeeRole)} className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3"><option value="manager">Gerente</option><option value="kitchen">Cocina</option><option value="cashier">Caja</option><option value="editor">Editor</option><option value="support">Atención</option></select></label><Button onClick={() => run(() => changeRole(selected.id, nextRole, role, "demo-jefe", DEMO_NOW), "Cargo actualizado")}>Guardar cargo</Button></div> : null}
        {selected && dialog === "branch" ? <div className="flex flex-col gap-4"><fieldset><legend className="text-sm font-semibold">Sucursales asignadas</legend><div className="mt-2 grid gap-2">{branches.map((branch) => <label key={branch.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-border-soft px-3"><input type="checkbox" checked={nextBranches.includes(branch.id)} onChange={(event) => setNextBranches((current) => event.target.checked ? [...current, branch.id] : current.filter((id) => id !== branch.id))} className="size-4 accent-lime" />{branch.name}</label>)}</div></fieldset><Button onClick={() => run(() => assignBranches(selected.id, nextBranches, role, "demo-jefe", DEMO_NOW), "Sucursales actualizadas")}>Guardar sucursales</Button></div> : null}
        {selected && dialog === "status" ? <div className="flex flex-col gap-4"><p className="text-sm text-muted">El empleado perderá el acceso demo cuando quede suspendido o inactivo.</p><label className="text-sm font-semibold">Estado<select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as StaffStatus)} className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3">{STATUS_OPTIONS.filter((item) => item !== selected.status).map((item) => <option key={item} value={item}>{getStaffStatusLabel(item)}</option>)}</select></label><label className="text-sm font-semibold">Razón<textarea value={reason} onChange={(event) => setReason(event.target.value)} required rows={3} className="mt-1 w-full rounded-xl border border-border-soft bg-surface px-3 py-2" placeholder="Describe el motivo" /></label><Button variant={nextStatus === "active" ? "primary" : "destructive"} onClick={() => run(() => setStatus(selected.id, nextStatus, reason, role, "demo-jefe", DEMO_NOW), nextStatus === "active" ? "Empleado reactivado" : "Estado actualizado")}>Confirmar cambio de estado</Button></div> : null}
      </Dialog>
    </div>
  );
}
