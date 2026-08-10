"use client";

import { ArrowLeft, BriefcaseBusiness, Plus, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useEffectiveAdminRole } from "@/components/admin/admin-role-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  getStaffRoleLabel,
  getStaffStatusLabel,
  filterStaff,
  toStaffView,
  type EmployeeRole,
} from "@/lib/staff/selectors";
import type { StaffFilters, StaffMember, StaffStatus } from "@/lib/staff/types";
import { useAdminStore } from "@/stores/admin";
import { useStaffStore } from "@/stores/staff";

const EMPLOYEE_ROLES: EmployeeRole[] = ["manager", "kitchen", "cashier", "editor", "support"];
const STATUS_OPTIONS: StaffStatus[] = ["active", "suspended", "inactive", "invited"];
const DEMO_NOW = "2026-08-04T12:00:00-05:00";

/**
 * EMPLOYEE CREATION AUTH BLOCKER
 * Safe product path to Auth invite + profile bootstrap is not prepared.
 * `manage_staff_profile` only updates an existing profile; service_role Auth
 * admin is reserved for webhooks/runbooks, never client-facing create.
 */
const EMPLOYEE_CREATION_AUTH_BLOCKER =
  "El alta real de empleados (Auth + perfil + rol) aún no está disponible desde este panel. Se necesita un flujo privilegiado servidor preparado; no se simula con datos locales.";

type DialogState = "create" | "role" | "status" | null;

export function StaffScreen() {
  const { toast } = useToast();
  const localRole = useAdminStore((state) => state.demoRole);
  const role = useEffectiveAdminRole(localRole);
  const members = useStaffStore((state) => state.members);
  const selectedEmployeeId = useStaffStore((state) => state.selectedEmployeeId);
  const setSelectedEmployee = useStaffStore((state) => state.setSelectedEmployee);
  const changeRole = useStaffStore((state) => state.changeRole);
  const setStatus = useStaffStore((state) => state.setStatus);
  const [filters, setFilters] = useState<StaffFilters>({
    search: "",
    role: "all",
    branchId: "all",
    status: "all",
  });
  const [dialog, setDialog] = useState<DialogState>(null);
  const [nextRole, setNextRole] = useState<EmployeeRole>("manager");
  const [nextStatus, setNextStatus] = useState<StaffStatus>("active");
  const [reason, setReason] = useState("");
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState<EmployeeRole>("cashier");
  const filtered = useMemo(() => filterStaff(members, filters), [filters, members]);
  const counts = useMemo(
    () => ({
      active: members.filter((member) => member.status === "active").length,
      suspended: members.filter((member) => member.status === "suspended").length,
      inactive: members.filter((member) => member.status === "inactive").length,
    }),
    [members],
  );
  const selected = selectedEmployeeId
    ? members.find((member) => member.id === selectedEmployeeId)
    : null;
  const canManage = role === "owner" || role === "admin";

  function openManageDialog(next: Exclude<DialogState, "create" | null>, member: StaffMember) {
    setSelectedEmployee(member.id);
    setDialog(next);
    setNextRole(member.role === "owner" || member.role === "admin" ? "manager" : member.role);
    setNextStatus(member.status === "active" ? "suspended" : "active");
    setReason("");
  }

  function openCreateDialog() {
    setSelectedEmployee(null);
    setDialog("create");
    setCreateName("");
    setCreateEmail("");
    setCreateRole("cashier");
  }

  function closeDialog() {
    setDialog(null);
    setSelectedEmployee(null);
  }

  function run(action: () => void, title: string) {
    try {
      action();
      closeDialog();
      toast({
        title,
        description: "El cambio quedó guardado en este navegador.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "No se pudo completar",
        description: error instanceof Error ? error.message : "Revisa los datos e inténtalo de nuevo.",
        variant: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-lime"
          >
            <ArrowLeft aria-hidden className="size-4" /> Volver al dashboard
          </Link>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-lime">
            Brisas del Sinú · Administración
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-extrabold tracking-tight">
            <BriefcaseBusiness aria-hidden className="size-7 text-lime" /> Empleados
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Cargos y estado del equipo. Suspender o reactivar no crea cuentas Auth.
          </p>
        </div>
        {canManage ? (
          <Button type="button" size="md" onClick={openCreateDialog}>
            <Plus aria-hidden className="size-4" /> Crear empleado
          </Button>
        ) : (
          <Badge variant="muted">{members.length} en el equipo</Badge>
        )}
      </header>

      <section aria-label="Resumen de empleados" className="grid grid-cols-3 gap-3">
        {(
          [
            ["Activos", counts.active],
            ["Suspendidos", counts.suspended],
            ["Inactivos", counts.inactive],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-card border border-border-soft bg-surface p-4">
            <p className="text-2xl font-extrabold tabular-nums">{value}</p>
            <p className="mt-1 text-xs font-semibold text-muted">{label}</p>
          </div>
        ))}
      </section>

      <section
        aria-label="Filtros de empleados"
        className="grid gap-3 rounded-card border border-border-soft bg-surface p-4 md:grid-cols-3"
      >
        <label className="md:col-span-2">
          <span className="sr-only">Buscar empleado</span>
          <span className="flex items-center gap-2 rounded-xl border border-border-soft bg-white/4 px-3">
            <Search aria-hidden className="size-4 text-muted" />
            <input
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
              placeholder="Buscar por nombre o correo"
              className="min-h-11 w-full bg-transparent text-sm outline-none"
            />
          </span>
        </label>
        <label>
          <span className="sr-only">Filtrar por cargo</span>
          <select
            value={filters.role}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                role: event.target.value as StaffFilters["role"],
              }))
            }
            className="min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3 text-sm"
          >
            <option value="all">Todos los cargos</option>
            {["owner", "admin", ...EMPLOYEE_ROLES].map((item) => (
              <option key={item} value={item}>
                {getStaffRoleLabel(item as StaffMember["role"])}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filtrar por estado</span>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value as StaffFilters["status"],
              }))
            }
            className="min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3 text-sm"
          >
            <option value="all">Todos los estados</option>
            {STATUS_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {getStaffStatusLabel(item)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section aria-labelledby="lista-empleados">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="lista-empleados" className="text-xl font-extrabold">
              Equipo
            </h2>
            <p className="mt-1 text-sm text-muted">
              {filtered.length} de {members.length} empleados visibles
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {filtered.map((member) => {
            const view = toStaffView(member);
            const employee = member.role !== "owner" && member.role !== "admin";
            return (
              <article
                key={member.id}
                className="rounded-card border border-border-soft bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border-soft bg-white/6">
                      <UserRound aria-hidden className="size-5 text-lime" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-bold">{member.name}</h3>
                      <p className="truncate text-xs text-muted">{member.email}</p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      member.status === "active"
                        ? "success"
                        : member.status === "suspended"
                          ? "warning"
                          : "muted"
                    }
                  >
                    {getStaffStatusLabel(member.status)}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="lime">{getStaffRoleLabel(member.role)}</Badge>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  Capacidades:{" "}
                  {view.capabilities.length
                    ? view.capabilities.map((capability) => capability.replaceAll("-", " ")).join(" · ")
                    : "Consulta limitada"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {canManage && employee ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => openManageDialog("role", member)}>
                        Cambiar cargo
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openManageDialog("status", member)}
                      >
                        {member.status === "active" ? "Suspender" : "Reactivar"}
                      </Button>
                      <Link
                        href="/empleado"
                        onClick={() => setSelectedEmployee(member.id)}
                        className="inline-flex h-10 items-center rounded-button border border-lime/40 px-4 text-sm font-bold text-lime"
                      >
                        Abrir experiencia
                      </Link>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <Dialog
        open={dialog === "create"}
        onOpenChange={(open) => !open && closeDialog()}
        title="Crear empleado"
        description="El empleado quedaría activo al crearse. La asignación operativa se resuelve en el servidor."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <label className="text-sm font-semibold">
            Nombre
            <input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3 font-normal"
              autoComplete="name"
            />
          </label>
          <label className="text-sm font-semibold">
            Correo
            <input
              type="email"
              value={createEmail}
              onChange={(event) => setCreateEmail(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3 font-normal"
              autoComplete="email"
            />
          </label>
          <label className="text-sm font-semibold">
            Cargo
            <select
              value={createRole}
              onChange={(event) => setCreateRole(event.target.value as EmployeeRole)}
              className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3 font-normal"
            >
              {EMPLOYEE_ROLES.map((item) => (
                <option key={item} value={item}>
                  {getStaffRoleLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <p className="rounded-xl border border-lime/25 bg-lime/8 px-3 py-2 text-xs text-muted">
            Estado al crear: <span className="font-semibold text-foreground">Activo</span>. No hay
            selector de Activo/Inactivo en el alta.
          </p>
          <p
            role="status"
            className="rounded-xl border border-warning/30 bg-warning/8 px-3 py-2 text-sm text-muted"
          >
            {EMPLOYEE_CREATION_AUTH_BLOCKER}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={closeDialog}>
              Cerrar
            </Button>
            <Button type="submit" disabled title="EMPLOYEE CREATION AUTH BLOCKER">
              Crear empleado
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(dialog && dialog !== "create" && selected)}
        onOpenChange={(open) => !open && closeDialog()}
        title={dialog === "role" ? "Cambiar cargo" : "Actualizar estado"}
        description="Los cambios de gestión conservan staff_status (activo, suspendido o inactivo)."
      >
        {selected && dialog === "role" ? (
          <div className="flex flex-col gap-4">
            <label className="text-sm font-semibold">
              Nuevo cargo
              <select
                value={nextRole}
                onChange={(event) => setNextRole(event.target.value as EmployeeRole)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3"
              >
                <option value="manager">Gerente</option>
                <option value="kitchen">Cocina</option>
                <option value="cashier">Caja</option>
                <option value="editor">Editor</option>
                <option value="support">Atención</option>
              </select>
            </label>
            <Button
              onClick={() =>
                run(() => changeRole(selected.id, nextRole, role, "demo-jefe", DEMO_NOW), "Cargo actualizado")
              }
            >
              Guardar cargo
            </Button>
          </div>
        ) : null}
        {selected && dialog === "status" ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Suspender o desactivar restringe el acceso operativo. No elimina el historial.
            </p>
            <label className="text-sm font-semibold">
              Estado
              <select
                value={nextStatus}
                onChange={(event) => setNextStatus(event.target.value as StaffStatus)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3"
              >
                {STATUS_OPTIONS.filter((item) => item !== selected.status).map((item) => (
                  <option key={item} value={item}>
                    {getStaffStatusLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Razón
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                rows={3}
                className="mt-1 w-full rounded-xl border border-border-soft bg-surface px-3 py-2"
                placeholder="Describe el motivo"
              />
            </label>
            <Button
              variant={nextStatus === "active" ? "primary" : "destructive"}
              onClick={() =>
                run(
                  () => setStatus(selected.id, nextStatus, reason, role, "demo-jefe", DEMO_NOW),
                  nextStatus === "active" ? "Empleado reactivado" : "Estado actualizado",
                )
              }
            >
              Confirmar cambio de estado
            </Button>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
