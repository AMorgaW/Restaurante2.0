"use client";

import {
  ArrowLeft,
  BadgeDollarSign,
  CircleAlert,
  Search,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  changePensionMembershipStatusAction,
  closePensionMenuAction,
  createAndActivatePensionMembershipAction,
  publishPensionMenuAction,
  renewPensionMembershipAction,
  savePensionMenuDraftAction,
  searchPensionCustomersAction,
  setPensionDeliveryFeeAction,
  upsertPensionMenuItemAction,
  type PensionAdminActionResult,
} from "@/app/admin/pension-actions";
import { useEffectiveAdminRole } from "@/components/admin/admin-role-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { adminRoleCan } from "@/lib/admin/authorization";
import { formatCurrency } from "@/lib/format/currency";
import { PENSION_ADMIN_STATUS_LABELS } from "@/lib/pension-admin/selectors";
import { useAdminStore } from "@/stores/admin";
import type {
  PensionAdminSnapshot,
  PensionCustomerSearchHit,
  PensionMembershipStatus,
  PensionMembershipStatusAction,
  PensionMembershipView,
  PensionMenuPeriod,
  PensionMenuStatus,
  PensionMenuView,
  PensionPaymentMethod,
} from "@/server/pension/types";

type DialogState = "renew" | "suspend" | "reactivate" | "cancel" | null;

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

const PERIOD_OPTIONS: Array<{ value: PensionMenuPeriod; label: string }> = [
  { value: "lunch", label: "Almuerzo" },
  { value: "dinner", label: "Cena" },
];

function previewEndsAt(startsAt: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsAt)) return "—";
  const date = new Date(`${startsAt}T12:00:00`);
  date.setDate(date.getDate() + 29);
  return date.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function newKey(): string {
  return crypto.randomUUID();
}

export function PensionAdminSupabaseScreen({
  snapshot,
  loadError,
}: {
  snapshot: PensionAdminSnapshot;
  loadError: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const localRole = useAdminStore((state) => state.demoRole);
  const role = useEffectiveAdminRole(localRole);
  const canManage = adminRoleCan(role, "manage-pension-memberships");
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PensionMembershipStatus | "all">("all");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const statusKeyRef = useRef(newKey());
  const renewKeyRef = useRef(newKey());

  const [renewAgreedPrice, setRenewAgreedPrice] = useState("");
  const [renewPaymentMethod, setRenewPaymentMethod] = useState<PensionPaymentMethod>("cash");
  const [renewPaymentDate, setRenewPaymentDate] = useState(todayIso());
  const [renewPaymentReference, setRenewPaymentReference] = useState("");
  const [renewStartsAt, setRenewStartsAt] = useState(todayIso());
  const [renewAllowSurcharge, setRenewAllowSurcharge] = useState(true);
  const [renewReason, setRenewReason] = useState("");

  const createKeyRef = useRef(newKey());
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerHits, setCustomerHits] = useState<PensionCustomerSearchHit[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [planId, setPlanId] = useState(snapshot.plans[0]?.id ?? "");
  const [branchId, setBranchId] = useState(snapshot.branches[0]?.id ?? "");
  const [agreedPrice, setAgreedPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PensionPaymentMethod>("cash");
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [paymentReference, setPaymentReference] = useState("");
  const [startsAt, setStartsAt] = useState(todayIso());
  const [allowSurcharge, setAllowSurcharge] = useState(true);
  const [createReason, setCreateReason] = useState("");

  const draftKeyRef = useRef(newKey());
  const [menuBranchId, setMenuBranchId] = useState(snapshot.branches[0]?.id ?? "");
  const [menuServiceDate, setMenuServiceDate] = useState(todayIso());
  const [menuPeriod, setMenuPeriod] = useState<PensionMenuPeriod>("lunch");
  const [menuNote, setMenuNote] = useState("");

  const [itemMenuId, setItemMenuId] = useState(snapshot.menus[0]?.id ?? "");
  const [itemCategory, setItemCategory] = useState("sopa");
  const [itemCategoryLabel, setItemCategoryLabel] = useState("Sopa");
  const [itemMenuItemId, setItemMenuItemId] = useState(snapshot.catalogMenuItems[0]?.id ?? "");
  const [itemIncluded, setItemIncluded] = useState(true);
  const [itemSurcharge, setItemSurcharge] = useState("0");
  const [itemAvailable, setItemAvailable] = useState(true);
  const [itemOrder, setItemOrder] = useState("0");

  const feeKeyRef = useRef(newKey());
  const [feeBranchId, setFeeBranchId] = useState(snapshot.branches[0]?.id ?? "");
  const [feeAmount, setFeeAmount] = useState(
    String(snapshot.branches[0]?.deliveryFee ?? ""),
  );

  const filteredMemberships = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("es");
    return snapshot.memberships.filter((membership) => {
      const haystack = [
        membership.profileName,
        membership.profileEmail,
        membership.id,
        membership.planName,
        membership.profileId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es");
      const matchesSearch = !needle || haystack.includes(needle);
      return matchesSearch && (statusFilter === "all" || membership.status === statusFilter);
    });
  }, [search, snapshot.memberships, statusFilter]);

  const summary = useMemo(() => {
    const byStatus = {
      pending: 0,
      active: 0,
      suspended: 0,
      expired: 0,
      cancelled: 0,
    } satisfies Record<PensionMembershipStatus, number>;
    for (const membership of snapshot.memberships) {
      byStatus[membership.status] += 1;
    }
    return byStatus;
  }, [snapshot.memberships]);

  const selected = selectedId
    ? snapshot.memberships.find((membership) => membership.id === selectedId)
    : null;

  function notify(result: PensionAdminActionResult, successTitle: string) {
    if (!result.ok) {
      toast({ title: "No se pudo completar", description: result.message, variant: "error" });
      return false;
    }
    toast({ title: successTitle, description: result.message, variant: "success" });
    router.refresh();
    return true;
  }

  function openDialog(next: DialogState, membership: PensionMembershipView) {
    setSelectedId(membership.id);
    setDialog(next);
    setReason("");
    statusKeyRef.current = newKey();
    renewKeyRef.current = newKey();
    setRenewAgreedPrice(String(membership.agreedPrice ?? membership.publicPrice));
    setRenewPaymentMethod(membership.paymentMethod ?? "cash");
    setRenewPaymentDate(membership.paymentDate ?? todayIso());
    setRenewPaymentReference("");
    setRenewStartsAt(todayIso());
    setRenewAllowSurcharge(true);
    setRenewReason("");
  }

  function closeDialog() {
    setDialog(null);
    setSelectedId(null);
  }

  function runCustomerSearch() {
    startTransition(async () => {
      const result = await searchPensionCustomersAction(customerQuery);
      if (!result.ok) {
        toast({ title: "Búsqueda fallida", description: result.message, variant: "error" });
        setCustomerHits([]);
        return;
      }
      setCustomerHits(result.hits);
      if (result.hits.length === 0) {
        toast({
          title: "Sin resultados",
          description: "No hay clientes que coincidan. También puedes pegar el UUID.",
          variant: "info",
        });
      }
    });
  }

  function submitCreate() {
    startTransition(async () => {
      const result = await createAndActivatePensionMembershipAction({
        customerId,
        planId,
        branchId,
        agreedPrice: Number(agreedPrice),
        paymentMethod,
        paymentDate,
        ...(paymentReference.trim() ? { paymentReference: paymentReference.trim() } : {}),
        startsAt,
        allowSurcharge,
        reason: createReason,
        idempotencyKey: createKeyRef.current,
      });
      if (notify(result, "Membresía creada y activada")) {
        createKeyRef.current = newKey();
        setCreateReason("");
      }
    });
  }

  function submitStatus(action: PensionMembershipStatusAction) {
    if (!selected) return;
    startTransition(async () => {
      const result = await changePensionMembershipStatusAction({
        membershipId: selected.id,
        action,
        reason,
        idempotencyKey: statusKeyRef.current,
      });
      if (notify(result, "Estado actualizado")) {
        statusKeyRef.current = newKey();
        closeDialog();
      }
    });
  }

  function submitRenew() {
    if (!selected) return;
    startTransition(async () => {
      const result = await renewPensionMembershipAction({
        membershipId: selected.id,
        agreedPrice: Number(renewAgreedPrice),
        paymentMethod: renewPaymentMethod,
        paymentDate: renewPaymentDate,
        ...(renewPaymentReference.trim()
          ? { paymentReference: renewPaymentReference.trim() }
          : {}),
        startsAt: renewStartsAt,
        allowSurcharge: renewAllowSurcharge,
        reason: renewReason,
        idempotencyKey: renewKeyRef.current,
      });
      if (notify(result, "Membresía renovada")) {
        renewKeyRef.current = newKey();
        closeDialog();
      }
    });
  }

  function submitMenuDraft() {
    startTransition(async () => {
      const result = await savePensionMenuDraftAction({
        branchId: menuBranchId,
        serviceDate: menuServiceDate,
        period: menuPeriod,
        ...(menuNote.trim() ? { note: menuNote.trim() } : {}),
        idempotencyKey: draftKeyRef.current,
      });
      if (notify(result, "Borrador guardado")) {
        draftKeyRef.current = newKey();
      }
    });
  }

  function submitMenuItem() {
    startTransition(async () => {
      const result = await upsertPensionMenuItemAction({
        menuId: itemMenuId,
        category: itemCategory,
        categoryLabel: itemCategoryLabel,
        isRequired: true,
        maxSelections: 1,
        menuItemId: itemMenuItemId,
        isIncluded: itemIncluded,
        surchargeAmount: Number(itemSurcharge) || 0,
        isAvailable: itemAvailable,
        displayOrder: Number(itemOrder) || 0,
      });
      notify(result, "Ítem de menú guardado");
    });
  }

  function submitMenuLifecycle(menu: PensionMenuView, next: "publish" | "close") {
    const key = newKey();
    startTransition(async () => {
      const payload = {
        menuId: menu.id,
        expectedStatus: menu.status as PensionMenuStatus,
        idempotencyKey: key,
      };
      const result =
        next === "publish"
          ? await publishPensionMenuAction(payload)
          : await closePensionMenuAction(payload);
      notify(result, next === "publish" ? "Menú publicado" : "Menú cerrado");
    });
  }

  function submitDeliveryFee() {
    startTransition(async () => {
      const result = await setPensionDeliveryFeeAction({
        branchId: feeBranchId,
        fee: Number(feeAmount),
        idempotencyKey: feeKeyRef.current,
      });
      if (notify(result, "Fee actualizado")) {
        feeKeyRef.current = newKey();
      }
    });
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
            <BadgeDollarSign aria-hidden className="size-7 text-lime" /> Pensionados
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Membresías, menús del día y fee de domicilio desde PostgreSQL.
          </p>
        </div>
        <Badge variant="lime">{canManage ? "Owner/Admin · gestión" : "Consulta"}</Badge>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-card border border-error/30 bg-error/10 p-4 text-sm text-error"
        >
          <CircleAlert aria-hidden className="mr-2 inline size-4" />
          {loadError}
        </div>
      ) : null}

      <section aria-label="Resumen de membresías" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(
          [
            ["Pendientes", summary.pending],
            ["Activos", summary.active],
            ["Suspendidos", summary.suspended],
            ["Vencidos", summary.expired],
            ["Cancelados", summary.cancelled],
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
              placeholder="Filtrar membresías cargadas"
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
            <p className="mt-1 text-sm text-muted">{filteredMemberships.length} registros</p>
          </div>
        </div>
        {filteredMemberships.length === 0 ? (
          <EmptyState
            className="mt-4 rounded-card border border-border-soft bg-surface"
            title="Sin membresías"
            description="No hay registros en PostgreSQL para este filtro."
          />
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {filteredMemberships.map((membership) => (
              <article
                key={membership.id}
                className="rounded-card border border-border-soft bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">
                      {membership.profileName ?? membership.profileId}
                    </h3>
                    <p className="text-xs text-muted">
                      {membership.planName ?? membership.planId}
                      {membership.profileEmail ? ` · ${membership.profileEmail}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={
                      membership.status === "active"
                        ? "success"
                        : membership.status === "pending"
                          ? "warning"
                          : membership.status === "cancelled"
                            ? "muted"
                            : "error"
                    }
                  >
                    {PENSION_ADMIN_STATUS_LABELS[membership.status]}
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
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Inicio</dt>
                    <dd>{membership.startsAt ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Fin</dt>
                    <dd>{membership.endsAt ?? "—"}</dd>
                  </div>
                </dl>
                {canManage ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {membership.status === "active" || membership.status === "expired" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openDialog("renew", membership)}
                      >
                        Renovar
                      </Button>
                    ) : null}
                    {membership.status === "active" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openDialog("suspend", membership)}
                      >
                        Suspender
                      </Button>
                    ) : null}
                    {membership.status === "suspended" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openDialog("reactivate", membership)}
                      >
                        Reactivar
                      </Button>
                    ) : null}
                    {membership.status !== "cancelled" ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => openDialog("cancel", membership)}
                      >
                        Cancelar
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {canManage ? (
        <section
          aria-labelledby="crear-membresia"
          className="rounded-card border border-border-soft bg-surface p-4 sm:p-5"
        >
          <h2 id="crear-membresia" className="text-xl font-extrabold">
            Crear y activar membresía
          </h2>
          <p className="mt-1 text-sm text-muted">
            Busca un cliente o pega su UUID. La vigencia final la define PostgreSQL.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="text-sm font-semibold">
              Buscar cliente
              <input
                value={customerQuery}
                onChange={(event) => setCustomerQuery(event.target.value)}
                placeholder="Nombre o correo"
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
              />
            </label>
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                disabled={isPending || customerQuery.trim().length < 2}
                onClick={runCustomerSearch}
              >
                Buscar
              </Button>
            </div>
          </div>
          {customerHits.length > 0 ? (
            <ul className="mt-3 grid gap-2">
              {customerHits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => setCustomerId(hit.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${customerId === hit.id ? "border-lime bg-lime/10" : "border-border-soft bg-background-secondary/50"}`}
                  >
                    <span className="font-semibold">{hit.name ?? "Sin nombre"}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {hit.email ?? hit.id}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold sm:col-span-2">
              Customer ID (UUID)
              <input
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Plan
              <select
                value={planId}
                onChange={(event) => setPlanId(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
              >
                {snapshot.plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · {formatCurrency(plan.publicPrice)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Sucursal
              <select
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
              >
                {snapshot.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Precio acordado
              <input
                type="number"
                min={0}
                value={agreedPrice}
                onChange={(event) => setAgreedPrice(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Método de pago
              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as PensionPaymentMethod)
                }
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
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
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Referencia
              <input
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Inicio
              <input
                type="date"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
              />
            </label>
            <div className="rounded-xl border border-lime/25 bg-lime/8 px-3 py-2 text-sm">
              <p className="font-semibold">Fin (vista previa)</p>
              <p className="mt-1 tabular-nums">{previewEndsAt(startsAt)}</p>
              <p className="mt-1 text-xs text-muted">
                Vista previa; PostgreSQL define el resultado
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
              <input
                type="checkbox"
                checked={allowSurcharge}
                onChange={(event) => setAllowSurcharge(event.target.checked)}
                className="size-4 accent-lime"
              />
              Permitir recargos
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Motivo
              <textarea
                value={createReason}
                onChange={(event) => setCreateReason(event.target.value)}
                rows={2}
                required
                className="mt-1 w-full rounded-xl border border-border-soft bg-background-secondary px-3 py-2 font-normal"
              />
            </label>
          </div>
          <Button className="mt-4" disabled={isPending} onClick={submitCreate}>
            Crear y activar
          </Button>
        </section>
      ) : null}

      <section
        aria-labelledby="menus-pension"
        className="rounded-card border border-border-soft bg-surface p-4 sm:p-5"
      >
        <h2 id="menus-pension" className="text-xl font-extrabold">
          Menús pensionado
        </h2>
        <p className="mt-1 text-sm text-muted">
          Borradores, ítems del catálogo y publicación.
        </p>

        {snapshot.menus.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No hay menús cargados para la sucursal.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {snapshot.menus.map((menu) => (
              <article
                key={menu.id}
                className="rounded-2xl border border-border-soft bg-background-secondary/40 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">
                      {menu.serviceDate} · {menu.period === "lunch" ? "Almuerzo" : "Cena"}
                    </p>
                    <p className="text-xs text-muted">{menu.id}</p>
                  </div>
                  <Badge variant={menu.status === "published" ? "success" : "muted"}>
                    {menu.status}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {menu.categories.length} categorías ·{" "}
                  {menu.categories.reduce((sum, category) => sum + category.items.length, 0)}{" "}
                  ítems
                </p>
                {canManage ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {menu.status === "draft" ? (
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() => submitMenuLifecycle(menu, "publish")}
                      >
                        Publicar
                      </Button>
                    ) : null}
                    {menu.status === "published" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isPending}
                        onClick={() => submitMenuLifecycle(menu, "close")}
                      >
                        Cerrar
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}

        {canManage ? (
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="grid gap-3">
              <h3 className="font-bold">Guardar borrador</h3>
              <label className="text-sm font-semibold">
                Sucursal
                <select
                  value={menuBranchId}
                  onChange={(event) => setMenuBranchId(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
                >
                  {snapshot.branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Fecha
                <input
                  type="date"
                  value={menuServiceDate}
                  onChange={(event) => setMenuServiceDate(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
                />
              </label>
              <label className="text-sm font-semibold">
                Periodo
                <select
                  value={menuPeriod}
                  onChange={(event) => setMenuPeriod(event.target.value as PensionMenuPeriod)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
                >
                  {PERIOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Nota
                <input
                  value={menuNote}
                  onChange={(event) => setMenuNote(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
                />
              </label>
              <Button disabled={isPending} onClick={submitMenuDraft}>
                Guardar borrador
              </Button>
            </div>

            <div className="grid gap-3">
              <h3 className="font-bold">Upsert ítem</h3>
              <label className="text-sm font-semibold">
                Menú
                <select
                  value={itemMenuId}
                  onChange={(event) => setItemMenuId(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
                >
                  {snapshot.menus.map((menu) => (
                    <option key={menu.id} value={menu.id}>
                      {menu.serviceDate} · {menu.period} · {menu.status}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Categoría (slug)
                  <input
                    value={itemCategory}
                    onChange={(event) => setItemCategory(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Etiqueta
                  <input
                    value={itemCategoryLabel}
                    onChange={(event) => setItemCategoryLabel(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
                  />
                </label>
              </div>
              <label className="text-sm font-semibold">
                Plato del catálogo
                <select
                  value={itemMenuItemId}
                  onChange={(event) => setItemMenuItemId(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
                >
                  {snapshot.catalogMenuItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.categorySlug}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={itemIncluded}
                    onChange={(event) => setItemIncluded(event.target.checked)}
                    className="size-4 accent-lime"
                  />
                  Incluido
                </label>
                <label className="text-sm font-semibold">
                  Recargo
                  <input
                    type="number"
                    min={0}
                    value={itemSurcharge}
                    onChange={(event) => setItemSurcharge(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Orden
                  <input
                    type="number"
                    min={0}
                    value={itemOrder}
                    onChange={(event) => setItemOrder(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={itemAvailable}
                  onChange={(event) => setItemAvailable(event.target.checked)}
                  className="size-4 accent-lime"
                />
                Disponible
              </label>
              <Button disabled={isPending || !itemMenuId} onClick={submitMenuItem}>
                Guardar ítem
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby="fee-domicilio"
        className="rounded-card border border-border-soft bg-surface p-4 sm:p-5"
      >
        <h2 id="fee-domicilio" className="text-xl font-extrabold">
          Fee de domicilio pensionado
        </h2>
        <p className="mt-1 text-sm text-muted">
          Por sucursal. Sin valor fijo hardcodeado; PostgreSQL valida.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {snapshot.branches.map((branch) => (
            <div
              key={branch.id}
              className="rounded-2xl border border-border-soft bg-background-secondary/40 p-3 text-sm"
            >
              <p className="font-bold">{branch.name}</p>
              <p className="mt-1 text-muted">
                Actual:{" "}
                {typeof branch.deliveryFee === "number"
                  ? formatCurrency(branch.deliveryFee)
                  : "Sin configurar"}
              </p>
            </div>
          ))}
        </div>
        {canManage ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="text-sm font-semibold">
              Sucursal
              <select
                value={feeBranchId}
                onChange={(event) => {
                  setFeeBranchId(event.target.value);
                  const branch = snapshot.branches.find(
                    (candidate) => candidate.id === event.target.value,
                  );
                  setFeeAmount(
                    branch?.deliveryFee !== null && branch?.deliveryFee !== undefined
                      ? String(branch.deliveryFee)
                      : "",
                  );
                }}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
              >
                {snapshot.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Fee (unidades menores)
              <input
                type="number"
                min={0}
                value={feeAmount}
                onChange={(event) => setFeeAmount(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-background-secondary px-3 font-normal"
              />
            </label>
            <div className="flex items-end">
              <Button disabled={isPending} onClick={submitDeliveryFee}>
                Guardar fee
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <p className="rounded-2xl border border-warning/30 bg-warning/8 px-4 py-3 text-xs leading-relaxed text-muted">
        <ShieldAlert aria-hidden className="mr-1 inline size-4 text-warning" />
        Activación y renovación son presenciales. Los totales de pedido los calcula
        PostgreSQL; esta pantalla no envía precios como autoridad.
      </p>

      <Dialog
        open={dialog === "renew" && Boolean(selected)}
        onOpenChange={(openState) => !openState && closeDialog()}
        title="Renovar membresía"
        description="Pago presencial y nueva vigencia. PostgreSQL define ends_at."
      >
        {selected ? (
          <div className="grid gap-3">
            <label className="text-sm font-semibold">
              Precio acordado
              <input
                type="number"
                min={0}
                value={renewAgreedPrice}
                onChange={(event) => setRenewAgreedPrice(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3"
              />
            </label>
            <label className="text-sm font-semibold">
              Método
              <select
                value={renewPaymentMethod}
                onChange={(event) =>
                  setRenewPaymentMethod(event.target.value as PensionPaymentMethod)
                }
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
                value={renewPaymentDate}
                onChange={(event) => setRenewPaymentDate(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3"
              />
            </label>
            <label className="text-sm font-semibold">
              Referencia
              <input
                value={renewPaymentReference}
                onChange={(event) => setRenewPaymentReference(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3"
              />
            </label>
            <label className="text-sm font-semibold">
              Inicio
              <input
                type="date"
                value={renewStartsAt}
                onChange={(event) => setRenewStartsAt(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3"
              />
            </label>
            <p className="text-xs text-muted">
              Vista previa fin: {previewEndsAt(renewStartsAt)} · PostgreSQL define el resultado
            </p>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={renewAllowSurcharge}
                onChange={(event) => setRenewAllowSurcharge(event.target.checked)}
                className="size-4 accent-lime"
              />
              Permitir recargos
            </label>
            <label className="text-sm font-semibold">
              Motivo
              <textarea
                value={renewReason}
                onChange={(event) => setRenewReason(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-border-soft bg-surface px-3 py-2"
              />
            </label>
            <Button disabled={isPending || !renewReason.trim()} onClick={submitRenew}>
              Confirmar renovación
            </Button>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(dialog && ["suspend", "reactivate", "cancel"].includes(dialog)) && Boolean(selected)}
        onOpenChange={(openState) => !openState && closeDialog()}
        title={
          dialog === "suspend"
            ? "Suspender membresía"
            : dialog === "reactivate"
              ? "Reactivar membresía"
              : "Cancelar membresía"
        }
        description="El motivo queda registrado en PostgreSQL."
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
              disabled={isPending || !reason.trim()}
              onClick={() =>
                submitStatus(
                  dialog === "suspend"
                    ? "suspended"
                    : dialog === "reactivate"
                      ? "reactivated"
                      : "cancelled",
                )
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
