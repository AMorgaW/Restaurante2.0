"use client";

import { Clock3, Flag, History, Send, Timer } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { canEmployeeAction, type EmployeeRole } from "@/lib/employee/authorization";
import { statusLabel } from "@/lib/employee/selectors";
import type { EmployeeActivity, EmployeeDemoProfile, EmployeeIncident, EmployeeShift, IncidentCategory, IncidentPriority } from "@/lib/employee/types";
import type { Order } from "@/types/order";

const ROLE_LABELS: Record<EmployeeRole, string> = {
  manager: "Gerente",
  kitchen: "Cocina",
  cashier: "Caja",
  editor: "Editor",
  support: "Atención",
};

const INCIDENT_CATEGORIES: Array<{ value: IncidentCategory; label: string }> = [
  { value: "pedido", label: "Pedido" },
  { value: "inventario", label: "Inventario" },
  { value: "servicio", label: "Servicio" },
  { value: "sistema", label: "Sistema" },
];

function formatDate(value: string): string {
  return new Date(value).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

export function EmployeeShiftPanels({
  role,
  profile,
  shift,
  activities,
  incidents: initialIncidents,
  orders,
  observedAt,
  showHistory,
  showIncidents,
}: {
  role: EmployeeRole;
  profile: EmployeeDemoProfile;
  shift: EmployeeShift;
  activities: EmployeeActivity[];
  incidents: EmployeeIncident[];
  orders: Order[];
  observedAt: string;
  showHistory: boolean;
  showIncidents: boolean;
}) {
  const { toast } = useToast();
  const [incidents, setIncidents] = useState(initialIncidents);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<IncidentCategory>("servicio");
  const [priority, setPriority] = useState<IncidentPriority>("media");
  const [orderId, setOrderId] = useState("");
  const canRecord = canEmployeeAction(role, "record-incident");
  const recentActivities = useMemo(() => {
    const orderActivities: EmployeeActivity[] = orders
      .filter((order) => ["confirmed", "preparing", "ready", "delivered"].includes(order.status))
      .slice(0, 3)
      .map((order) => ({
        id: `activity-order-${order.id}`,
        action: `Pedido ${order.orderNumber}: ${statusLabel(order.status)}`,
        orderId: order.id,
        createdAt: order.createdAt,
        result: "correcto" as const,
      }));
    return [...activities, ...orderActivities].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 5);
  }, [activities, orders]);

  function submitIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanDescription = description.trim();
    if (!cleanDescription) return;
    setIncidents((current) => [
      {
        id: `incident-local-${current.length + 1}`,
        category,
        priority,
        ...(orderId ? { orderId } : {}),
        description: cleanDescription,
        status: "abierta",
        createdAt: observedAt,
      },
      ...current,
    ]);
    setDescription("");
    setOrderId("");
    toast({ title: "Incidencia registrada", description: "Se guardó solo en este navegador.", variant: "success" });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section id="turno" aria-labelledby="turno-titulo" className="rounded-card border border-border-soft bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lime">Turno</p>
            <h2 id="turno-titulo" className="mt-1 text-xl font-extrabold">{ROLE_LABELS[role]} · {profile.branchName}</h2>
          </div>
          <Badge variant={shift.status === "active" ? "success" : "muted"}>{shift.status === "active" ? "Activo" : "Finalizado"}</Badge>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted">Inicio</dt><dd className="mt-1 flex items-center gap-1.5 font-semibold"><Timer aria-hidden className="size-4 text-lime" />{formatDate(shift.startedAt)}</dd></div>
          <div><dt className="text-muted">Estado</dt><dd className="mt-1 flex items-center gap-1.5 font-semibold"><Clock3 aria-hidden className="size-4 text-lime" />{shift.status === "active" ? "En curso" : "Cerrado"}</dd></div>
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-muted">{shift.summary}</p>
      </section>

      {showHistory ? <section id="historial" aria-labelledby="historial-titulo" className="rounded-card border border-border-soft bg-surface p-4">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lime">Actividad</p><h2 id="historial-titulo" className="mt-1 text-xl font-extrabold">Historial reciente</h2></div><History aria-hidden className="size-6 text-lime" /></div>
        <ul className="mt-4 divide-y divide-border-soft">
          {recentActivities.map((activity) => <li key={activity.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="text-sm font-semibold">{activity.action}</p><p className="mt-1 text-xs text-muted">{formatDate(activity.createdAt)}{activity.orderId ? ` · ${activity.orderId}` : ""}</p></div><Badge variant={activity.result === "correcto" ? "success" : activity.result === "rechazado" ? "error" : "warning"}>{activity.result}</Badge></li>)}
        </ul>
      </section> : null}

      {showIncidents ? <section id="incidencias" aria-labelledby="incidencias-titulo" className="rounded-card border border-border-soft bg-surface p-4 md:col-span-2">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lime">Seguimiento</p><h2 id="incidencias-titulo" className="mt-1 text-xl font-extrabold">Incidencias</h2></div><Flag aria-hidden className="size-6 text-lime" /></div>
        {canRecord ? <form onSubmit={submitIncident} className="mt-4 grid gap-3 rounded-2xl border border-border-soft bg-background-secondary/40 p-3 md:grid-cols-4">
          <label className="grid gap-1 text-sm font-semibold">Categoría<select value={category} onChange={(event) => setCategory(event.target.value as IncidentCategory)} className="min-h-11 rounded-xl border border-border-soft bg-surface px-3 font-normal text-foreground focus-visible:outline-2 focus-visible:outline-lime">{INCIDENT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-semibold">Prioridad<select value={priority} onChange={(event) => setPriority(event.target.value as IncidentPriority)} className="min-h-11 rounded-xl border border-border-soft bg-surface px-3 font-normal text-foreground focus-visible:outline-2 focus-visible:outline-lime"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select></label>
          <label className="grid gap-1 text-sm font-semibold">Pedido opcional<select aria-label="Pedido relacionado opcional" value={orderId} onChange={(event) => setOrderId(event.target.value)} className="min-h-11 rounded-xl border border-border-soft bg-surface px-3 font-normal text-foreground focus-visible:outline-2 focus-visible:outline-lime"><option value="">Sin pedido</option>{orders.slice(0, 10).map((order) => <option key={order.id} value={order.id}>#{order.orderNumber}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-semibold md:col-span-4">Descripción<textarea required value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="rounded-xl border border-border-soft bg-surface px-3 py-2 font-normal text-foreground focus-visible:outline-2 focus-visible:outline-lime" placeholder="Describe brevemente lo ocurrido." /></label>
          <Button type="submit" size="md" className="md:col-span-4 md:justify-self-start"><Send aria-hidden className="size-4" />Registrar incidencia demo</Button>
        </form> : <p className="mt-4 rounded-xl border border-border-soft bg-background-secondary/40 p-3 text-sm text-muted">Este cargo puede consultar incidencias, pero no registrarlas.</p>}
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {incidents.map((incident) => <li key={incident.id} className="rounded-2xl border border-border-soft bg-background-secondary/30 p-3"><div className="flex items-start justify-between gap-2"><p className="font-semibold">{incident.description}</p><Badge variant={incident.priority === "alta" ? "error" : incident.priority === "media" ? "warning" : "muted"}>{incident.priority}</Badge></div><p className="mt-2 text-xs text-muted">{incident.category} · {incident.status} · {formatDate(incident.createdAt)}</p></li>)}
        </ul>
        {incidents.length === 0 ? <p className="mt-4 text-sm text-muted">No hay incidencias demo.</p> : null}
      </section> : null}
    </div>
  );
}
