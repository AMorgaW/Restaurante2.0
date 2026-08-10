"use client";

import { ArrowLeft, BadgeDollarSign, CheckCircle2, Plus, Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useEffectiveAdminRole } from "@/components/admin/admin-role-context";
import { PensionSpecialPriceField } from "@/components/admin/pension-special-price-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { adminRoleCan } from "@/lib/admin/authorization";
import {
  calendarPeriodEndsAt,
} from "@/lib/pension-admin/operations";
import {
  getDerivedPensionStatus,
  getPensionAdminRows,
  getPensionAdminSummary,
  PENSION_ADMIN_STATUS_LABELS,
} from "@/lib/pension-admin/selectors";
import type { PensionCycleInput, PensionPaymentInput, PensionPaymentMethod } from "@/lib/pension-admin/types";
import type { PensionMembershipStatus } from "@/lib/pension/types";
import { PENSION_DEMO_NOW, PENSION_DEMO_PLAN, PENSION_DEMO_PROFILES } from "@/lib/pension/fixtures";
import { formatCurrency } from "@/lib/format/currency";
import { useAdminStore } from "@/stores/admin";
import { usePensionAdminStore } from "@/stores/pension-admin";
import { usePensionStore } from "@/stores/pension";

type DialogState = "create" | "payment" | "activate" | "renew" | "suspend" | "reactivate" | "cancel" | null;
const STATUS_OPTIONS: Array<PensionMembershipStatus | "all"> = [
  "all",
  "pending",
  "active",
  "suspended",
  "expired",
  "cancelled",
];
const PAYMENT_METHODS: Array<{ value: PensionPaymentMethod; label: string }> = [
  { value: "cash", label: "Efectivo" },
  { value: "bank_transfer", label: "Transferencia" },
  { value: "in_person_card", label: "Tarjeta presencial" },
  { value: "other", label: "Otro" },
];

export function PensionAdminScreen() {
  const { toast } = useToast();
  const localRole = useAdminStore((state) => state.demoRole);
  const role = useEffectiveAdminRole(localRole);
  const memberships = usePensionAdminStore((state) => state.memberships);
  const audit = usePensionAdminStore((state) => state.audit);
  const consumptions = usePensionStore((state) => state.consumptions);
  const recordPayment = usePensionAdminStore((state) => state.recordPayment);
  const activate = usePensionAdminStore((state) => state.activate);
  const createAndActivate = usePensionAdminStore((state) => state.createAndActivate);
  const renew = usePensionAdminStore((state) => state.renew);
  const suspend = usePensionAdminStore((state) => state.suspend);
  const reactivate = usePensionAdminStore((state) => state.reactivate);
  const cancel = usePensionAdminStore((state) => state.cancel);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PensionMembershipStatus | "all">("all");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agreedPrice, setAgreedPrice] = useState(String(PENSION_DEMO_PLAN.publicPrice));
  const [specialOpen, setSpecialOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PensionPaymentMethod>("cash");
  const [paymentDate, setPaymentDate] = useState(PENSION_DEMO_NOW.slice(0, 10));
  const [startsAt, setStartsAt] = useState(PENSION_DEMO_NOW.slice(0, 10));
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [createProfileId, setCreateProfileId] = useState("");
  const canManage = adminRoleCan(role, "manage-pension-memberships");
  const today = PENSION_DEMO_NOW.slice(0, 10);
  const rows = useMemo(
    () =>
      getPensionAdminRows(memberships, consumptions).filter((row) => {
        const derived = getDerivedPensionStatus(
          row.membership.status,
          row.membership.expiresAt,
          today,
        );
        const matchesSearch = `${row.profileName} ${row.plan.name}`
          .toLocaleLowerCase("es")
          .includes(search.trim().toLocaleLowerCase("es"));
        return matchesSearch && (statusFilter === "all" || derived === statusFilter);
      }),
    [consumptions, memberships, search, statusFilter, today],
  );
  const summary = useMemo(() => getPensionAdminSummary(memberships, today), [memberships, today]);
  const selected = selectedId ? memberships.find((membership) => membership.id === selectedId) : null;
  const createCandidates = useMemo(
    () =>
      PENSION_DEMO_PROFILES.filter(
        (profile) =>
          !memberships.some(
            (membership) =>
              membership.profileId === profile.id &&
              (membership.status === "pending" ||
                membership.status === "active" ||
                membership.status === "suspended"),
          ),
      ),
    [memberships],
  );

  function open(next: DialogState, id?: string) {
    setSelectedId(id ?? null);
    setDialog(next);
    setConfirmed(false);
    setReason("");
    setSpecialOpen(false);
    const membership = id ? memberships.find((candidate) => candidate.id === id) : null;
    setAgreedPrice(String(membership?.agreedPrice ?? PENSION_DEMO_PLAN.publicPrice));
    setPaymentMethod(
      membership?.paymentMethod === "in_person" ? "cash" : membership?.paymentMethod ?? "cash",
    );
    setPaymentDate(membership?.paymentDate ?? PENSION_DEMO_NOW.slice(0, 10));
    setStartsAt(membership?.startsAt ?? PENSION_DEMO_NOW.slice(0, 10));
    if (next === "create") {
      setCreateProfileId(createCandidates[0]?.id ?? "");
      setAgreedPrice(String(PENSION_DEMO_PLAN.publicPrice));
      setStartsAt(PENSION_DEMO_NOW.slice(0, 10));
      setPaymentDate(PENSION_DEMO_NOW.slice(0, 10));
      setPaymentMethod("cash");
    }
  }

  function close() {
    setDialog(null);
    setSelectedId(null);
  }

  function run(action: () => void, success: string) {
    try {
      action();
      close();
      toast({
        title: success,
        description: "La operación quedó registrada en el demo local.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "No se pudo completar",
        description: error instanceof Error ? error.message : "Revisa los datos.",
        variant: "error",
      });
    }
  }

  function resolvedAgreedPrice(): number {
    if (!specialOpen) return PENSION_DEMO_PLAN.publicPrice;
    return Number(agreedPrice);
  }

  function paymentInput(): PensionPaymentInput {
    return {
      publicPrice: PENSION_DEMO_PLAN.publicPrice,
      agreedPrice: resolvedAgreedPrice(),
      paymentMethod,
      paymentDate,
    };
  }

  function cycleInput(): PensionCycleInput {
    const ends = calendarPeriodEndsAt(startsAt);
    return {
      ...paymentInput(),
      modality: "calendar_period",
      startsAt,
      expiresAt: ends,
      confirmed,
    };
  }

  const actor = { role, id: "demo-jefe", now: PENSION_DEMO_NOW };

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
            <BadgeDollarSign aria-hidden className="size-7 text-lime" /> Pensionados
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Membresías del plan mensual. El vencimiento se muestra por fecha; la suspensión es manual.
          </p>
        </div>
        {canManage ? (
          <Button type="button" size="md" onClick={() => open("create")}>
            <Plus aria-hidden className="size-4" /> Crear pensionado
          </Button>
        ) : (
          <Badge variant="muted">{memberships.length} membresías</Badge>
        )}
      </header>

      <section aria-label="Resumen de membresías" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(
          [
            ["Pendientes", summary.byStatus.pending],
            ["Activos", summary.byStatus.active],
            ["Suspendidos", summary.byStatus.suspended],
            ["Vencidos", summary.byStatus.expired],
            ["Cancelados", summary.byStatus.cancelled],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-card border border-border-soft bg-surface p-4">
            <p className="text-2xl font-extrabold tabular-nums">{value}</p>
            <p className="mt-1 text-xs font-semibold text-muted">{label}</p>
          </div>
        ))}
      </section>

      <section
        aria-label="Filtros de pensionados"
        className="grid gap-3 rounded-card border border-border-soft bg-surface p-4 md:grid-cols-[1fr_auto]"
      >
        <label>
          <span className="sr-only">Buscar pensionado</span>
          <span className="flex items-center gap-2 rounded-xl border border-border-soft bg-white/4 px-3">
            <Search aria-hidden className="size-4 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente o plan"
              className="min-h-11 w-full bg-transparent text-sm outline-none"
            />
          </span>
        </label>
        <label>
          <span className="sr-only">Filtrar por estado</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as PensionMembershipStatus | "all")
            }
            className="min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3 text-sm"
          >
            {STATUS_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "Todos los estados" : PENSION_ADMIN_STATUS_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section aria-labelledby="lista-pensionados">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="lista-pensionados" className="text-xl font-extrabold">
              Membresías
            </h2>
            <p className="mt-1 text-sm text-muted">
              {rows.length} registros · {summary.expiringSoon} próximos a vencer
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {rows.map((row) => {
            const membership = row.membership;
            const derived = getDerivedPensionStatus(membership.status, membership.expiresAt, today);
            const actions = canManage ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {membership.status === "pending" ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => open("payment", membership.id)}>
                      Registrar pago
                    </Button>
                    <Button size="sm" onClick={() => open("activate", membership.id)}>
                      Activar pensionado
                    </Button>
                  </>
                ) : null}
                {membership.status === "active" || membership.status === "expired" || derived === "expired" ? (
                  <Button size="sm" variant="secondary" onClick={() => open("renew", membership.id)}>
                    Renovar membresía
                  </Button>
                ) : null}
                {membership.status === "active" && derived === "active" ? (
                  <Button size="sm" variant="secondary" onClick={() => open("suspend", membership.id)}>
                    Suspender membresía
                  </Button>
                ) : null}
                {membership.status === "suspended" ? (
                  <Button size="sm" variant="secondary" onClick={() => open("reactivate", membership.id)}>
                    Reactivar membresía
                  </Button>
                ) : null}
                {membership.status !== "cancelled" ? (
                  <Button size="sm" variant="destructive" onClick={() => open("cancel", membership.id)}>
                    Finalizar membresía
                  </Button>
                ) : null}
              </div>
            ) : null;
            return (
              <article
                key={membership.id}
                className="rounded-card border border-border-soft bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{row.profileName}</h3>
                    <p className="text-xs text-muted">{row.plan.name}</p>
                  </div>
                  <Badge
                    variant={
                      derived === "active"
                        ? "success"
                        : derived === "pending"
                          ? "warning"
                          : derived === "cancelled"
                            ? "muted"
                            : "error"
                    }
                  >
                    {PENSION_ADMIN_STATUS_LABELS[derived]}
                  </Badge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted">Precio público</dt>
                    <dd className="font-bold">{formatCurrency(membership.publicPrice)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Precio acordado</dt>
                    <dd className="font-bold">
                      {membership.agreedPrice !== undefined
                        ? formatCurrency(membership.agreedPrice)
                        : "Pendiente"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Inicio</dt>
                    <dd>{membership.startsAt ?? "Pendiente"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Fin</dt>
                    <dd>{membership.expiresAt ?? "Pendiente"}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted">
                  Consumos: {row.consumptions} · Excedentes: {formatCurrency(row.surplusTotal)}
                </p>
                {actions}
              </article>
            );
          })}
        </div>
      </section>

      <section
        aria-labelledby="auditoria-pension"
        className="rounded-card border border-border-soft bg-surface p-4"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 aria-hidden className="size-5 text-lime" />
          <h2 id="auditoria-pension" className="font-bold">
            Auditoría local append-only
          </h2>
        </div>
        <ul className="mt-3 space-y-2">
          {audit
            .slice(-5)
            .reverse()
            .map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap justify-between gap-2 border-t border-border-soft pt-2 text-xs"
              >
                <span>{entry.summary}</span>
                <span className="text-muted">
                  {entry.actor} · {entry.createdAt.slice(0, 10)}
                </span>
              </li>
            ))}
          {audit.length === 0 ? (
            <li className="text-sm text-muted">Aún no hay acciones registradas en este demo.</li>
          ) : null}
        </ul>
      </section>

      <p className="rounded-2xl border border-warning/30 bg-warning/8 px-4 py-3 text-xs leading-relaxed text-muted">
        <ShieldAlert aria-hidden className="mr-1 inline size-4 text-warning" />
        El pago y la activación se realizan personalmente. Suspendido es solo por acción admin; el
        vencimiento se deriva de la fecha fin.
      </p>

      <Dialog
        open={dialog === "create"}
        onOpenChange={(openState) => !openState && close()}
        title="Crear pensionado"
        description="Activa el plan mensual con pago presencial. Vigencia: 30 días calendario."
      >
        <div className="grid gap-3">
          <div className="rounded-xl border border-lime/25 bg-lime/8 px-3 py-3 text-sm">
            <p className="font-extrabold uppercase tracking-[0.12em] text-lime">Plan mensual</p>
            <p className="mt-1 font-bold">{formatCurrency(PENSION_DEMO_PLAN.publicPrice)}</p>
            <p className="mt-1 text-xs text-muted">30 días · ends_at = starts_at + 29</p>
          </div>
          <label className="text-sm font-semibold">
            Cliente
            <select
              value={createProfileId}
              onChange={(event) => setCreateProfileId(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3 font-normal"
            >
              {createCandidates.length === 0 ? (
                <option value="">No hay clientes disponibles</option>
              ) : (
                createCandidates.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <PensionSpecialPriceField
            publicPrice={PENSION_DEMO_PLAN.publicPrice}
            agreedPrice={agreedPrice}
            onAgreedPriceChange={setAgreedPrice}
            specialOpen={specialOpen}
            onSpecialOpenChange={setSpecialOpen}
          />
          <label className="text-sm font-semibold">
            Método de pago
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PensionPaymentMethod)}
              className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3 font-normal"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Fecha de pago
              <input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Inicio
              <input
                type="date"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3 font-normal"
              />
            </label>
          </div>
          <div className="rounded-xl border border-border-soft px-3 py-2 text-sm">
            <p className="font-semibold">Fin (calculado)</p>
            <p className="mt-1 tabular-nums">
              {/^\d{4}-\d{2}-\d{2}$/.test(startsAt) ? calendarPeriodEndsAt(startsAt) : "—"}
            </p>
          </div>
          <label className="flex items-start gap-2 rounded-xl border border-lime/25 bg-lime/8 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 size-4 accent-lime"
            />
            Confirmo el pago presencial y la activación de esta membresía.
          </label>
          <Button
            disabled={!confirmed || !createProfileId}
            onClick={() =>
              run(() => {
                createAndActivate(createProfileId, { ...cycleInput(), confirmed: true }, actor);
              }, "Pensionado creado")
            }
          >
            Crear y activar
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "payment" && Boolean(selected)}
        onOpenChange={(openState) => !openState && close()}
        title="Registrar pago presencial"
        description="Registra el pago antes de activar la membresía."
      >
        {selected ? (
          <div className="grid gap-3">
            <PensionSpecialPriceField
              publicPrice={PENSION_DEMO_PLAN.publicPrice}
              agreedPrice={agreedPrice}
              onAgreedPriceChange={setAgreedPrice}
              specialOpen={specialOpen}
              onSpecialOpenChange={setSpecialOpen}
            />
            <label className="text-sm font-semibold">
              Método de pago
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PensionPaymentMethod)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Fecha de pago
              <input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3"
              />
            </label>
            <Button
              onClick={() =>
                run(() => recordPayment(selected.id, paymentInput(), actor), "Pago presencial registrado")
              }
            >
              Guardar pago presencial
            </Button>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={(dialog === "activate" || dialog === "renew") && Boolean(selected)}
        onOpenChange={(openState) => !openState && close()}
        title={dialog === "activate" ? "Activar pensionado" : "Renovar membresía"}
        description="Plan mensual · 30 días calendario. Confirma el pago presencial."
      >
        {selected ? (
          <div className="grid gap-3">
            <label className="flex items-start gap-2 rounded-xl border border-lime/25 bg-lime/8 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1 size-4 accent-lime"
              />
              Confirmo el pago presencial y la{" "}
              {dialog === "activate" ? "activación" : "renovación"} de esta membresía.
            </label>
            <div className="rounded-xl border border-lime/25 bg-lime/8 px-3 py-3 text-sm">
              <p className="font-extrabold uppercase tracking-[0.12em] text-lime">Plan mensual</p>
              <p className="mt-1 font-bold">{formatCurrency(PENSION_DEMO_PLAN.publicPrice)}</p>
              <p className="mt-1 text-xs text-muted">30 días</p>
            </div>
            <PensionSpecialPriceField
              publicPrice={PENSION_DEMO_PLAN.publicPrice}
              agreedPrice={agreedPrice}
              onAgreedPriceChange={setAgreedPrice}
              specialOpen={specialOpen}
              onSpecialOpenChange={setSpecialOpen}
            />
            {dialog === "renew" ? (
              <>
                <label className="text-sm font-semibold">
                  Método
                  <select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as PensionPaymentMethod)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3"
                  >
                    {PAYMENT_METHODS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Fecha de pago
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3"
                  />
                </label>
              </>
            ) : (
              <p className="rounded-xl border border-lime/25 bg-lime/8 px-3 py-2 text-xs text-muted">
                Pago presencial registrado; la activación conserva sus datos.
              </p>
            )}
            <label className="text-sm font-semibold">
              Inicio
              <input
                type="date"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3"
              />
            </label>
            <div className="rounded-xl border border-border-soft px-3 py-2 text-sm">
              <p className="font-semibold">Fin (calculado)</p>
              <p className="mt-1 tabular-nums">
                {/^\d{4}-\d{2}-\d{2}$/.test(startsAt) ? calendarPeriodEndsAt(startsAt) : "—"}
              </p>
            </div>
            <Button
              disabled={!confirmed}
              onClick={() =>
                run(() => {
                  if (dialog === "activate") {
                    activate(selected.id, cycleInput(), actor);
                  } else {
                    renew(selected.id, cycleInput(), actor);
                  }
                }, dialog === "activate" ? "Pensionado activado" : "Membresía renovada")
              }
            >
              {dialog === "activate" ? "Confirmar activación" : "Confirmar renovación"}
            </Button>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(dialog && ["suspend", "reactivate", "cancel"].includes(dialog)) && Boolean(selected)}
        onOpenChange={(openState) => !openState && close()}
        title={
          dialog === "suspend"
            ? "Suspender membresía"
            : dialog === "reactivate"
              ? "Reactivar membresía"
              : "Finalizar membresía"
        }
        description="La razón queda registrada en la auditoría local."
      >
        {selected ? (
          <div className="flex flex-col gap-4">
            <label className="text-sm font-semibold">
              Razón
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                required
                className="mt-1 w-full rounded-xl border border-border-soft bg-surface px-3 py-2"
                placeholder="Escribe una razón"
              />
            </label>
            <Button
              variant={dialog === "cancel" ? "destructive" : "primary"}
              onClick={() =>
                run(() => {
                  if (dialog === "suspend") suspend(selected.id, reason, actor);
                  else if (dialog === "reactivate") reactivate(selected.id, reason, actor);
                  else cancel(selected.id, reason, actor);
                }, dialog === "suspend"
                  ? "Membresía suspendida"
                  : dialog === "reactivate"
                    ? "Membresía reactivada"
                    : "Membresía finalizada")
              }
            >
              Confirmar operación
            </Button>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
