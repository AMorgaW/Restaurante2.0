"use client";

import Link from "next/link";
import {
  CircleAlert,
  CircleUserRound,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  Utensils,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { placePensionOrderAction } from "@/app/pensionado/pension-order-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkipLink } from "@/components/ui/skip-link";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format/currency";
import { PENSION_STATUS_LABELS } from "@/lib/pension/selectors";
import { useTableContextStore } from "@/stores/table-context";
import type {
  CreatePensionOrderResult,
  PensionCustomerSnapshot,
  PensionFulfillmentType,
  PensionMenuPeriod,
  PensionMenuView,
  PensionMembershipStatus,
} from "@/server/pension/types";

type PensionOrderFieldErrors = {
  selection?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  street?: string;
};

const STATUS_VARIANT: Record<
  PensionMembershipStatus | "none",
  "lime" | "success" | "warning" | "error" | "muted"
> = {
  none: "muted",
  pending: "warning",
  active: "success",
  suspended: "warning",
  expired: "error",
  cancelled: "muted",
};

const FULFILLMENT_OPTIONS: Array<{ value: PensionFulfillmentType; label: string }> = [
  { value: "local", label: "En local" },
  { value: "pickup", label: "Para llevar" },
  { value: "delivery", label: "Domicilio" },
];

function formatDateLabel(date: string): string {
  return new Date(`${date}T12:00:00-05:00`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function statusCopy(status: PensionMembershipStatus): { title: string; text: string } {
  if (status === "pending") {
    return {
      title: "Pendiente de activación",
      text: "El jefe debe activar personalmente la membresía antes de habilitar beneficios.",
    };
  }
  if (status === "suspended") {
    return {
      title: "Beneficios suspendidos",
      text: "Habla con el jefe para revisar tu membresía.",
    };
  }
  if (status === "expired") {
    return {
      title: "Plan vencido",
      text: "La vigencia terminó. Consulta la renovación presencial con el jefe.",
    };
  }
  return {
    title: "Membresía cancelada",
    text: "Conservamos tu historial, pero los beneficios ya no están disponibles.",
  };
}

export function PensionSupabaseWorkspace({
  snapshot,
  loadError,
}: {
  snapshot: PensionCustomerSnapshot;
  loadError: string | null;
}) {
  const membership = snapshot.membership;
  const planName =
    membership?.planName ??
    snapshot.plans.find((plan) => plan.id === membership?.planId)?.name ??
    "Plan pensionado";

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background">
      <SkipLink />
      <header className="border-b border-border-soft bg-background-secondary/80 px-4 pb-5 pt-[calc(1rem+env(safe-area-inset-top))] md:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-lime">
              BRISAS DEL SINÚ
            </p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-foreground">
              Restaurante
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="action">
              <CircleUserRound aria-hidden className="size-4" /> Pensionado
            </Badge>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                aria-label="Cerrar sesión"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-soft px-3 text-sm font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-lime"
              >
                <LogOut aria-hidden className="size-4" /> Salir
              </button>
            </form>
          </div>
        </div>
        {membership ? (
          <section
            aria-labelledby="pension-resumen"
            className="mx-auto mt-5 max-w-6xl rounded-card border border-border-soft bg-gradient-to-br from-cobalt/65 to-surface p-5 shadow-card md:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-muted">¡Bienvenido!</p>
                <h1 id="pension-resumen" className="mt-1 text-3xl font-extrabold">
                  {planName}
                </h1>
                <Badge className="mt-3" variant={STATUS_VARIANT[membership.status]}>
                  {PENSION_STATUS_LABELS[membership.status]}
                </Badge>
              </div>
              <div className="grid min-w-[13rem] gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-background/30 p-3">
                  <p className="text-xs text-muted">Vigencia</p>
                  <p className="mt-1 text-sm font-bold">
                    {membership.startsAt ?? "—"} → {membership.endsAt ?? "—"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-background/30 p-3">
                  <p className="text-xs text-muted">Precio acordado</p>
                  <p className="mt-1 text-lg font-extrabold">
                    {membership.agreedPrice !== undefined
                      ? formatCurrency(membership.agreedPrice)
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-5 flex items-start gap-2 text-sm leading-relaxed text-muted">
              <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-lime" />
              El pago y la activación se realizan personalmente con el jefe.
            </p>
          </section>
        ) : null}
      </header>

      <main id="contenido" className="mx-auto w-full max-w-6xl px-4 py-6 pb-10 md:px-8">
        <div className="grid gap-6">
          {loadError ? (
            <div
              role="alert"
              className="rounded-card border border-error/30 bg-error/10 p-4 text-sm text-error"
            >
              <CircleAlert aria-hidden className="mr-2 inline size-4" />
              {loadError}
            </div>
          ) : null}

          {!membership ? (
            <EmptyState
              title="Sin membresía activa en el sistema"
              description="Si ya pagaste presencialmente, el jefe debe activar tu plan. Mientras tanto puedes usar el menú general."
              action={
                <Link
                  href="/menu"
                  className="inline-flex min-h-11 items-center rounded-button bg-action px-4 text-sm font-extrabold text-action-foreground"
                >
                  Ir al menú
                </Link>
              }
            />
          ) : membership.status !== "active" ? (
            <InactiveMembershipPanel
              status={membership.status}
              startsAt={membership.startsAt}
              endsAt={membership.endsAt}
              planName={planName}
              agreedPrice={membership.agreedPrice}
            />
          ) : (
            <>
              <ActiveMembershipCard
                planName={planName}
                status={membership.status}
                startsAt={membership.startsAt}
                endsAt={membership.endsAt}
                agreedPrice={membership.agreedPrice}
              />
              <PensionOrderForm snapshot={snapshot} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function InactiveMembershipPanel({
  status,
  startsAt,
  endsAt,
  planName,
  agreedPrice,
}: {
  status: PensionMembershipStatus;
  startsAt?: string;
  endsAt?: string;
  planName: string;
  agreedPrice?: number;
}) {
  const copy = statusCopy(status);
  return (
    <section className="rounded-card border border-border-soft bg-surface p-5">
      <Badge variant={STATUS_VARIANT[status]}>{copy.title}</Badge>
      <h2 className="mt-3 text-2xl font-extrabold">{copy.title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">{copy.text}</p>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Plan</dt>
          <dd className="mt-1 font-semibold">{planName}</dd>
        </div>
        <div>
          <dt className="text-muted">Inicio</dt>
          <dd className="mt-1 font-semibold">{startsAt ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Fin</dt>
          <dd className="mt-1 font-semibold">{endsAt ?? "—"}</dd>
        </div>
        {agreedPrice !== undefined ? (
          <div>
            <dt className="text-muted">Precio acordado</dt>
            <dd className="mt-1 font-semibold">{formatCurrency(agreedPrice)}</dd>
          </div>
        ) : null}
      </dl>
      <Link
        href="/menu"
        className="mt-5 inline-flex min-h-11 items-center rounded-button border border-border-soft px-4 text-sm font-bold"
      >
        Consultar menú general
      </Link>
    </section>
  );
}

function ActiveMembershipCard({
  planName,
  status,
  startsAt,
  endsAt,
  agreedPrice,
}: {
  planName: string;
  status: PensionMembershipStatus;
  startsAt?: string;
  endsAt?: string;
  agreedPrice?: number;
}) {
  return (
    <section
      id="plan"
      aria-labelledby="plan-titulo"
      className="rounded-card border border-border-soft bg-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lime">
            Información del plan
          </p>
          <h2 id="plan-titulo" className="mt-1 text-2xl font-extrabold">
            {planName}
          </h2>
        </div>
        <Badge variant="success">{PENSION_STATUS_LABELS[status]}</Badge>
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-muted">Inicio</dt>
          <dd className="mt-1 font-semibold">{startsAt ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Fin</dt>
          <dd className="mt-1 font-semibold">{endsAt ?? "—"}</dd>
        </div>
        {agreedPrice !== undefined ? (
          <div>
            <dt className="text-muted">Precio acordado</dt>
            <dd className="mt-1 text-xl font-extrabold">{formatCurrency(agreedPrice)}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function PensionOrderForm({ snapshot }: { snapshot: PensionCustomerSnapshot }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const selectionGroupRef = useRef<HTMLDivElement>(null);
  const customerNameRef = useRef<HTMLInputElement>(null);
  const customerPhoneRef = useRef<HTMLInputElement>(null);
  const customerEmailRef = useRef<HTMLInputElement>(null);
  const streetRef = useRef<HTMLInputElement>(null);
  const tableQrToken = useTableContextStore((state) => state.tableQrToken);
  const tableCode = useTableContextStore((state) => state.tableCode);
  const hydrateTableContext = useTableContextStore((state) => state.hydrateFromSession);
  const commercialDate = snapshot.commercialDate;
  const day = commercialDate ? snapshot.menusByDate[commercialDate] : undefined;
  const [period, setPeriod] = useState<PensionMenuPeriod>("lunch");
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [fulfillmentType, setFulfillmentType] = useState<PensionFulfillmentType>("local");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [street, setStreet] = useState("");
  const [details, setDetails] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PensionOrderFieldErrors>({});
  const [lastOrder, setLastOrder] = useState<CreatePensionOrderResult | null>(null);

  useEffect(() => {
    hydrateTableContext();
  }, [hydrateTableContext]);

  useEffect(() => {
    if (tableQrToken) setFulfillmentType("local");
  }, [tableQrToken]);

  const menu: PensionMenuView | null =
    period === "lunch" ? (day?.lunch ?? null) : (day?.dinner ?? null);
  const consumed =
    period === "lunch" ? Boolean(day?.lunchConsumed) : Boolean(day?.dinnerConsumed);
  const published = menu?.status === "published";

  const requiredCategories = useMemo(
    () => (menu?.categories ?? []).filter((category) => category.isRequired),
    [menu],
  );

  const selectionComplete =
    Boolean(menu && published && !consumed) &&
    requiredCategories.every((category) => Boolean(selections[category.id]));

  function clearFieldError(key: keyof PensionOrderFieldErrors) {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function changePeriod(next: PensionMenuPeriod) {
    setPeriod(next);
    setSelections({});
    clearFieldError("selection");
  }

  function choose(categoryId: string, itemId: string) {
    setSelections((current) => ({ ...current, [categoryId]: itemId }));
    clearFieldError("selection");
  }

  function collectClientErrors(): PensionOrderFieldErrors {
    const errors: PensionOrderFieldErrors = {};
    if (!selectionComplete) {
      errors.selection = "Elige una opción en cada categoría obligatoria.";
    }

    const trimmedName = customerName.trim();
    if (!trimmedName) {
      errors.customerName = "El nombre es obligatorio.";
    } else if (trimmedName.length < 2) {
      errors.customerName = "El nombre es demasiado corto.";
    }

    const trimmedPhone = customerPhone.trim();
    if (!trimmedPhone) {
      errors.customerPhone = "El teléfono es obligatorio.";
    } else if (trimmedPhone.length < 7) {
      errors.customerPhone = "El teléfono no es válido.";
    }

    const trimmedEmail = customerEmail.trim();
    if (!trimmedEmail) {
      errors.customerEmail = "El correo es obligatorio.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.customerEmail = "El correo no es válido.";
    }

    if (fulfillmentType === "delivery") {
      const trimmedStreet = street.trim();
      if (!trimmedStreet) {
        errors.street = "La dirección es obligatoria.";
      } else if (trimmedStreet.length < 4) {
        errors.street = "La dirección es incompleta.";
      }
    }

    return errors;
  }

  function focusFirstInvalid(errors: PensionOrderFieldErrors) {
    if (errors.selection) {
      const firstRequired = requiredCategories.find((category) => !selections[category.id]);
      const target =
        (firstRequired
          ? selectionGroupRef.current?.querySelector<HTMLInputElement>(
              `input[name="pension-cat-${firstRequired.id}"]:not(:disabled)`,
            )
          : null) ?? selectionGroupRef.current?.querySelector<HTMLInputElement>('input[type="radio"]:not(:disabled)');
      target?.focus();
      return;
    }
    if (errors.customerName) {
      customerNameRef.current?.focus();
      return;
    }
    if (errors.customerPhone) {
      customerPhoneRef.current?.focus();
      return;
    }
    if (errors.customerEmail) {
      customerEmailRef.current?.focus();
      return;
    }
    if (errors.street) {
      streetRef.current?.focus();
    }
  }

  /** Autoridad de creación del pedido; no duplicar lógica aquí. */
  function submit() {
    if (!menu || !selectionComplete) return;
    const pensionMenuItemIds = Object.values(selections);
    startTransition(async () => {
      const result = await placePensionOrderAction({
        idempotencyKey: idempotencyKeyRef.current,
        menuId: menu.id,
        pensionMenuItemIds,
        fulfillmentType,
        customerName,
        customerPhone,
        customerEmail,
        ...(fulfillmentType === "delivery"
          ? {
              address: {
                street,
                ...(details.trim() ? { details: details.trim() } : {}),
                ...(neighborhood.trim() ? { neighborhood: neighborhood.trim() } : {}),
              },
            }
          : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(fulfillmentType === "local" && tableQrToken ? { tableQrToken } : {}),
      });
      if (!result.ok) {
        toast({ title: "No se pudo crear el pedido", description: result.message, variant: "error" });
        return;
      }
      idempotencyKeyRef.current = crypto.randomUUID();
      setLastOrder(result.data);
      toast({
        title: result.data.replay ? "Pedido ya confirmado" : "Pedido pensionado creado",
        description: `Pedido ${result.data.orderNumber} · ${formatCurrency(result.data.total)} · pago pendiente`,
        variant: "success",
      });
    });
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (consumed || isPending) return;
    const errors = collectClientErrors();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid(errors);
      return;
    }
    submit();
  }

  return (
    <section
      id="menu-plan"
      aria-labelledby="menu-plan-titulo"
      className="rounded-card border border-border-soft bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lime">
            Beneficio del plan
          </p>
          <h2 id="menu-plan-titulo" className="mt-1 text-2xl font-extrabold">
            Arma tu comida
          </h2>
          <p className="mt-1 text-sm text-muted">
            {commercialDate
              ? `Menú del ${formatDateLabel(commercialDate)}`
              : "Fecha comercial no disponible"}
          </p>
        </div>
        <Badge variant="lime">
          <Utensils aria-hidden className="size-4" /> Pedido real
        </Badge>
      </div>

      {!commercialDate || !day ? (
        <div
          role="status"
          className="mt-5 rounded-2xl border border-border-soft bg-background-secondary/50 p-4 text-sm text-muted"
        >
          No disponible
        </div>
      ) : !menu || menu.status !== "published" ? (
        <div
          role="status"
          className="mt-5 rounded-2xl border border-border-soft bg-background-secondary/50 p-4 text-sm text-muted"
        >
          No disponible
        </div>
      ) : (
        <>
          {consumed ? (
            <div
              role="status"
              className="mt-5 flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning"
            >
              <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
              Ya registraste un consumo para este periodo. PostgreSQL es la autoridad final.
            </div>
          ) : null}

          <form
            aria-label="Pedido pensionado"
            className="mt-5 grid gap-5"
            noValidate
            onSubmit={handleFormSubmit}
          >
            <div>
              <span className="text-sm font-semibold">Periodo</span>
              <div
                role="group"
                aria-label="Periodo del menú"
                className="mt-1 grid grid-cols-2 rounded-xl border border-border-soft bg-background-secondary p-1"
              >
                <button
                  type="button"
                  aria-pressed={period === "lunch"}
                  onClick={() => changePeriod("lunch")}
                  className={`min-h-11 rounded-lg text-sm font-bold focus-visible:outline-2 focus-visible:outline-lime ${period === "lunch" ? "bg-action text-action-foreground" : "text-muted"}`}
                >
                  <Sun aria-hidden className="mr-1 inline size-4" />
                  Almuerzo
                </button>
                <button
                  type="button"
                  aria-pressed={period === "dinner"}
                  onClick={() => changePeriod("dinner")}
                  className={`min-h-11 rounded-lg text-sm font-bold focus-visible:outline-2 focus-visible:outline-lime ${period === "dinner" ? "bg-action text-action-foreground" : "text-muted"}`}
                >
                  <Moon aria-hidden className="mr-1 inline size-4" />
                  Cena
                </button>
              </div>
            </div>

            <div ref={selectionGroupRef} className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {menu.categories.map((category) => {
                const categoryInvalid =
                  Boolean(fieldErrors.selection) &&
                  category.isRequired &&
                  !selections[category.id];
                return (
                  <fieldset
                    key={category.id}
                    aria-invalid={categoryInvalid ? true : undefined}
                    aria-describedby={
                      categoryInvalid ? "pension-order-selection-error" : undefined
                    }
                    className={`rounded-2xl border bg-background-secondary/40 p-3 ${categoryInvalid ? "border-error/60" : "border-border-soft"}`}
                  >
                    <legend className="px-1 text-sm font-extrabold">
                      {category.label}{" "}
                      <span className="text-lime">
                        {category.isRequired ? "(elige 1)" : "(opcional)"}
                      </span>
                    </legend>
                    <div className="mt-2 grid gap-2">
                      {category.items
                        .filter((item) => item.isAvailable)
                        .map((item) => {
                          const selected = selections[category.id] === item.id;
                          return (
                            <label
                              key={item.id}
                              className={`flex min-h-14 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${selected ? "border-lime bg-lime/10" : "border-border-soft bg-surface"} ${consumed ? "opacity-60" : ""}`}
                            >
                              <input
                                type="radio"
                                name={`pension-cat-${category.id}`}
                                value={item.id}
                                checked={selected}
                                disabled={consumed}
                                onChange={() => choose(category.id, item.id)}
                                className="size-4 accent-lime"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block font-semibold">{item.name}</span>
                                <span className="block text-xs text-lime">
                                  {item.isIncluded
                                    ? "Incluido"
                                    : `+${formatCurrency(item.surchargeAmount)}`}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  </fieldset>
                );
              })}
            </div>
            {fieldErrors.selection ? (
              <p
                id="pension-order-selection-error"
                role="alert"
                className="text-[13px] font-medium text-error"
              >
                {fieldErrors.selection}
              </p>
            ) : null}

            <div className="grid gap-4 rounded-2xl border border-border-soft bg-background-secondary/40 p-4">
              {tableQrToken ? (
                <p className="rounded-xl border border-lime/40 bg-lime/10 px-3 py-2 text-sm font-semibold">
                  Pedido en mesa {tableCode ?? "—"}. Se asociará a la cuenta de la mesa.
                </p>
              ) : null}
              <fieldset>
                <legend className="text-sm font-extrabold">Entrega</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {FULFILLMENT_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-semibold ${fulfillmentType === option.value ? "border-lime bg-lime/10" : "border-border-soft bg-surface"} ${tableQrToken && option.value !== "local" ? "opacity-45" : ""}`}
                    >
                      <input
                        type="radio"
                        name="pension-fulfillment"
                        value={option.value}
                        checked={fulfillmentType === option.value}
                        disabled={Boolean(tableQrToken) && option.value !== "local"}
                        onChange={() => {
                          setFulfillmentType(option.value);
                          if (option.value !== "delivery") clearFieldError("street");
                        }}
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              {fulfillmentType === "delivery" ? (
                <div
                  role="status"
                  className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm"
                >
                  {typeof snapshot.deliveryFee === "number" ? (
                    <p>
                      Fee de domicilio:{" "}
                      <span className="font-bold">{formatCurrency(snapshot.deliveryFee)}</span>
                    </p>
                  ) : (
                    <p className="text-warning">
                      El fee de domicilio puede no estar configurado. PostgreSQL rechazará el pedido
                      si falta.
                    </p>
                  )}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold" htmlFor="pension-customer-name">
                  Nombre
                  <input
                    id="pension-customer-name"
                    ref={customerNameRef}
                    value={customerName}
                    onChange={(event) => {
                      setCustomerName(event.target.value);
                      clearFieldError("customerName");
                    }}
                    required
                    autoComplete="name"
                    aria-invalid={fieldErrors.customerName ? true : undefined}
                    aria-describedby={
                      fieldErrors.customerName ? "pension-customer-name-error" : undefined
                    }
                    className={`mt-1 min-h-11 w-full rounded-xl border bg-surface px-3 font-normal ${fieldErrors.customerName ? "border-error/60" : "border-border-soft"}`}
                  />
                  {fieldErrors.customerName ? (
                    <span
                      id="pension-customer-name-error"
                      role="alert"
                      className="mt-1 block text-[13px] font-medium text-error"
                    >
                      {fieldErrors.customerName}
                    </span>
                  ) : null}
                </label>
                <label className="text-sm font-semibold" htmlFor="pension-customer-phone">
                  Teléfono
                  <input
                    id="pension-customer-phone"
                    ref={customerPhoneRef}
                    value={customerPhone}
                    onChange={(event) => {
                      setCustomerPhone(event.target.value);
                      clearFieldError("customerPhone");
                    }}
                    required
                    autoComplete="tel"
                    aria-invalid={fieldErrors.customerPhone ? true : undefined}
                    aria-describedby={
                      fieldErrors.customerPhone ? "pension-customer-phone-error" : undefined
                    }
                    className={`mt-1 min-h-11 w-full rounded-xl border bg-surface px-3 font-normal ${fieldErrors.customerPhone ? "border-error/60" : "border-border-soft"}`}
                  />
                  {fieldErrors.customerPhone ? (
                    <span
                      id="pension-customer-phone-error"
                      role="alert"
                      className="mt-1 block text-[13px] font-medium text-error"
                    >
                      {fieldErrors.customerPhone}
                    </span>
                  ) : null}
                </label>
                <label className="text-sm font-semibold sm:col-span-2" htmlFor="pension-customer-email">
                  Correo
                  <input
                    id="pension-customer-email"
                    ref={customerEmailRef}
                    type="email"
                    value={customerEmail}
                    onChange={(event) => {
                      setCustomerEmail(event.target.value);
                      clearFieldError("customerEmail");
                    }}
                    required
                    autoComplete="email"
                    aria-invalid={fieldErrors.customerEmail ? true : undefined}
                    aria-describedby={
                      fieldErrors.customerEmail ? "pension-customer-email-error" : undefined
                    }
                    className={`mt-1 min-h-11 w-full rounded-xl border bg-surface px-3 font-normal ${fieldErrors.customerEmail ? "border-error/60" : "border-border-soft"}`}
                  />
                  {fieldErrors.customerEmail ? (
                    <span
                      id="pension-customer-email-error"
                      role="alert"
                      className="mt-1 block text-[13px] font-medium text-error"
                    >
                      {fieldErrors.customerEmail}
                    </span>
                  ) : null}
                </label>
              </div>

              {fulfillmentType === "delivery" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold sm:col-span-2" htmlFor="pension-street">
                    Dirección
                    <input
                      id="pension-street"
                      ref={streetRef}
                      value={street}
                      onChange={(event) => {
                        setStreet(event.target.value);
                        clearFieldError("street");
                      }}
                      required
                      autoComplete="street-address"
                      aria-invalid={fieldErrors.street ? true : undefined}
                      aria-describedby={fieldErrors.street ? "pension-street-error" : undefined}
                      className={`mt-1 min-h-11 w-full rounded-xl border bg-surface px-3 font-normal ${fieldErrors.street ? "border-error/60" : "border-border-soft"}`}
                    />
                    {fieldErrors.street ? (
                      <span
                        id="pension-street-error"
                        role="alert"
                        className="mt-1 block text-[13px] font-medium text-error"
                      >
                        {fieldErrors.street}
                      </span>
                    ) : null}
                  </label>
                  <label className="text-sm font-semibold">
                    Detalles
                    <input
                      value={details}
                      onChange={(event) => setDetails(event.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3 font-normal"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Barrio
                    <input
                      value={neighborhood}
                      onChange={(event) => setNeighborhood(event.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3 font-normal"
                    />
                  </label>
                </div>
              ) : null}

              <label className="text-sm font-semibold">
                Notas
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-border-soft bg-surface px-3 py-2 font-normal"
                />
              </label>

              <Button
                type="submit"
                fullWidth
                size="lg"
                className="sm:w-auto"
                disabled={consumed || isPending}
              >
                {isPending ? "Enviando…" : "Confirmar pedido pensionado"}
              </Button>
            </div>
          </form>
        </>
      )}

      {lastOrder ? (
        <div
          role="status"
          className="mt-5 rounded-2xl border border-lime/30 bg-lime/8 p-4 text-sm"
        >
          <p className="font-extrabold">Pedido {lastOrder.orderNumber}</p>
          <p className="mt-1 text-muted">
            Total {formatCurrency(lastOrder.total)} · pago {lastOrder.paymentStatus} (nunca
            marcado como pagado desde esta pantalla)
          </p>
        </div>
      ) : null}
    </section>
  );
}
