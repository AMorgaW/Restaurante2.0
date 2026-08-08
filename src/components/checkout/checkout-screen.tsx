"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, BadgeCheck, Bike, CreditCard, Store, Wallet } from "lucide-react";
// Router plano: los flujos de pago no usan elementos compartidos y el
// view transition con barras fijas es inestable en WebKit.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CartSummary } from "@/components/cart/cart-summary";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { branches, coupons, restaurantConfig } from "@/config/restaurant";
import { calculateTotals } from "@/features/cart/calculations";
import { placeOrderRequest } from "@/features/checkout/place-order";
import { track } from "@/lib/analytics";
import { formatCurrency } from "@/lib/format/currency";
import { isValidPhone, cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";
import { useCartStore } from "@/stores/cart";
import { useOrdersStore } from "@/stores/orders";
import { useTableContextStore } from "@/stores/table-context";

const STEPS = ["Entrega", "Tus datos", "Pago"] as const;

const customerFormSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre completo.").max(80, "Nombre demasiado largo."),
  phone: z.string().trim().refine(isValidPhone, "Escribe un teléfono válido (7 a 15 dígitos)."),
  email: z.string().trim().email("Escribe un correo válido."),
  street: z.string().trim().max(120, "Máximo 120 caracteres.").optional().or(z.literal("")),
  details: z.string().trim().max(120, "Máximo 120 caracteres.").optional().or(z.literal("")),
  neighborhood: z.string().trim().max(80, "Máximo 80 caracteres.").optional().or(z.literal("")),
  notes: z.string().trim().max(300, "Máximo 300 caracteres.").optional().or(z.literal("")),
});

type CheckoutFormValues = z.infer<typeof customerFormSchema>;

/**
 * Checkout móvil en 3 pasos: entrega → datos → pago de demostración.
 * El servidor revalida y recalcula todo; la clave de idempotencia evita
 * pedidos duplicados ante reintentos.
 */
export function CheckoutScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const mounted = useMounted();

  const items = useCartStore((state) => state.items);
  const branchId = useCartStore((state) => state.branchId);
  const setBranch = useCartStore((state) => state.setBranch);
  const fulfillmentType = useCartStore((state) => state.fulfillmentType);
  const setFulfillment = useCartStore((state) => state.setFulfillment);
  const couponCode = useCartStore((state) => state.couponCode);
  const tipPercent = useCartStore((state) => state.tipPercent);
  const clearCart = useCartStore((state) => state.clear);
  const addOrder = useOrdersStore((state) => state.addOrder);
  const tableQrToken = useTableContextStore((state) => state.tableQrToken);
  const tableCode = useTableContextStore((state) => state.tableCode);
  const tableBranchId = useTableContextStore((state) => state.branchConfigId);
  const hydrateTableContext = useTableContextStore((state) => state.hydrateFromSession);

  const [step, setStep] = useState(0);
  const isTableLocal = Boolean(tableQrToken) && fulfillmentType === "local";
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  /** Una clave opaca por intento lógico; se reutiliza en retries del mismo intento. */
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  const inFlightRequest = useRef<ReturnType<typeof placeOrderRequest> | null>(null);

  const {
    register,
    trigger,
    getValues,
    setError,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(customerFormSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      street: "",
      details: "",
      neighborhood: "",
      notes: "",
    },
  });

  const branch = branches.find((candidate) => candidate.id === branchId) ?? branches[0];
  const activeCoupon = useMemo(
    () => coupons.find((coupon) => coupon.code === couponCode && coupon.active) ?? null,
    [couponCode],
  );
  const totals = useMemo(
    () =>
      calculateTotals({
        items,
        coupon: activeCoupon,
        taxRate: restaurantConfig.checkout.taxRate,
        serviceFeeRate: restaurantConfig.checkout.serviceFeeRate,
        deliveryFee: fulfillmentType === "delivery" ? (branch?.deliveryFee ?? 0) : 0,
        tipPercent,
      }),
    [items, activeCoupon, fulfillmentType, branch, tipPercent],
  );

  useEffect(() => {
    hydrateTableContext();
  }, [hydrateTableContext]);

  useEffect(() => {
    if (!tableQrToken) return;
    setFulfillment("local");
    if (tableBranchId) setBranch(tableBranchId);
  }, [tableQrToken, tableBranchId, setFulfillment, setBranch]);

  useEffect(() => {
    if (step === 2) track("add_payment_info", { method: "demo" });
  }, [step]);

  const deliveryBelowMinimum =
    fulfillmentType === "delivery" && totals.subtotal < restaurantConfig.checkout.deliveryMinimum;

  const goToStep = async (next: number) => {
    setServerError(null);
    if (next > step) {
      if (step === 0 && deliveryBelowMinimum) return;
      if (step === 1) {
        const baseValid = await trigger(["name", "phone", "email"]);
        if (!baseValid) return;
        if (fulfillmentType === "delivery") {
          const street = getValues("street")?.trim() ?? "";
          if (street.length < 4) {
            setError("street", { message: "Escribe la dirección de entrega." });
            return;
          }
        }
      }
    }
    setStep(Math.min(Math.max(next, 0), STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const submitOrder = async () => {
    if (submitting && inFlightRequest.current) {
      await inFlightRequest.current;
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    setServerError(null);

    const values = getValues();
    const payload = {
      idempotencyKey: idempotencyKey.current,
      branchId: branch?.id ?? "",
      fulfillmentType,
      customer: {
        name: values.name.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
      },
      ...(fulfillmentType === "delivery"
        ? {
            address: {
              street: values.street?.trim() ?? "",
              details: values.details?.trim() ?? "",
              neighborhood: values.neighborhood?.trim() ?? "",
            },
          }
        : {}),
      items: items.map((line) => ({
        slug: line.slug,
        quantity: line.quantity,
        notes: line.notes,
        modifiers: line.modifiers.map((modifier) => ({
          groupId: modifier.groupId,
          optionId: modifier.optionId,
        })),
      })),
      ...(activeCoupon ? { couponCode: activeCoupon.code } : {}),
      tipPercent,
      notes: values.notes?.trim() ?? "",
      ...(fulfillmentType === "local" && tableQrToken ? { tableQrToken } : {}),
    };

    const request = placeOrderRequest(payload);
    inFlightRequest.current = request;
    const result = await request;
    inFlightRequest.current = null;

    if (!result.ok) {
      setSubmitting(false);
      setServerError(result.error);
      toast({ title: "No pudimos completar el pedido", description: result.error, variant: "error" });
      return;
    }

    addOrder(result.order);
    track("purchase", {
      order: result.order.orderNumber,
      total: result.order.totals.total,
      items: result.order.items.length,
    });
    // Conservar contexto de mesa para pedidos adicionales en la misma session.
    // Nuevo intento lógico a partir de aquí (por si el usuario vuelve a pedir).
    idempotencyKey.current = crypto.randomUUID();
    toast({ title: "¡Pedido confirmado!", description: result.order.orderNumber, variant: "success" });
    // Navegar antes de vaciar: si clearCart corre primero, el EmptyState remonta
    // y puede cancelar el replace en WebKit/móvil.
    router.replace(`/pedido/${result.order.id}`);
    clearCart();
  };

  if (!mounted) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3 px-5 pt-5">
        <div className="skeleton h-8 w-44 rounded-xl" />
        <div className="skeleton h-40 w-full rounded-card" />
        <div className="skeleton h-40 w-full rounded-card" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-5 pt-5">
        <PageHeader title="Finalizar pedido" backHref="/carrito" className="px-0" />
        <EmptyState
          title="No hay nada para pagar"
          description="Tu carrito está vacío. Añade platos del menú para continuar."
          action={
            <Button size="md" onClick={() => router.push("/menu")}>
              Ver el menú
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-5 pb-40 pt-2">
      <PageHeader title="Finalizar pedido" backHref="/carrito" className="px-0" />

      {/* Progreso */}
      <ol aria-label="Progreso del pedido" className="flex items-center gap-2">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-full rounded-full transition-colors",
                index <= step ? "bg-action" : "bg-white/10",
              )}
            />
            <span
              aria-current={index === step ? "step" : undefined}
              className={cn(
                "text-[12px] font-bold",
                index === step ? "text-foreground" : "text-faint",
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <section aria-label="Método de entrega" className="flex flex-col gap-4">
          {isTableLocal ? (
            <div className="rounded-card border border-lime/40 bg-lime/10 p-4">
              <p className="text-sm font-bold text-lime">Pedido en mesa</p>
              <p className="mt-1 text-lg font-extrabold">
                Mesa {tableCode ?? "—"}
              </p>
              <p className="mt-2 text-[13px] text-muted">
                Tu pedido se asociará a la cuenta abierta de esta mesa.
              </p>
            </div>
          ) : (
          <div role="radiogroup" aria-label="Tipo de servicio" className="grid grid-cols-2 gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={fulfillmentType === "pickup"}
              onClick={() => setFulfillment("pickup")}
              className={cn(
                "flex min-h-24 flex-col items-center justify-center gap-2 rounded-card border p-4 transition-colors",
                fulfillmentType === "pickup"
                  ? "border-action/70 bg-action/10"
                  : "border-border-soft bg-surface hover:bg-white/6",
              )}
            >
              <Store aria-hidden className="size-6 text-lime" />
              <span className="text-sm font-bold">Recoger en tienda</span>
              <span className="text-[12px] text-muted">Sin costo adicional</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={fulfillmentType === "delivery"}
              disabled={!branch?.deliveryEnabled}
              onClick={() => setFulfillment("delivery")}
              className={cn(
                "flex min-h-24 flex-col items-center justify-center gap-2 rounded-card border p-4 transition-colors",
                "disabled:opacity-45",
                fulfillmentType === "delivery"
                  ? "border-action/70 bg-action/10"
                  : "border-border-soft bg-surface hover:bg-white/6",
              )}
            >
              <Bike aria-hidden className="size-6 text-lime" />
              <span className="text-sm font-bold">Domicilio</span>
              <span className="text-[12px] text-muted">
                {branch?.deliveryEnabled
                  ? `+${formatCurrency(branch.deliveryFee)}`
                  : "No disponible aquí"}
              </span>
            </button>
          </div>
          )}

          {!isTableLocal ? (
          <fieldset className="rounded-card border border-border-soft bg-surface p-4">
            <legend className="px-1 text-sm font-bold">Sucursal</legend>
            <div role="radiogroup" aria-label="Sucursal" className="mt-1 flex flex-col gap-2">
              {branches
                .filter((candidate) => candidate.status === "active")
                .map((candidate) => {
                  const selected = candidate.id === branch?.id;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setBranch(candidate.id)}
                      className={cn(
                        "flex w-full flex-col rounded-2xl border px-4 py-3 text-left transition-colors",
                        selected
                          ? "border-lime/50 bg-lime/10"
                          : "border-border-soft bg-white/4 hover:bg-white/8",
                      )}
                    >
                      <span className="font-bold">{candidate.name}</span>
                      <span className="text-[13px] text-muted">{candidate.address}</span>
                    </button>
                  );
                })}
            </div>
          </fieldset>
          ) : null}

          {deliveryBelowMinimum ? (
            <p role="alert" className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] font-semibold text-warning">
              El pedido mínimo para domicilio es {formatCurrency(restaurantConfig.checkout.deliveryMinimum)}.
              Añade algo más al carrito o elige recogida en tienda.
            </p>
          ) : null}

          <Button fullWidth disabled={deliveryBelowMinimum} onClick={() => goToStep(1)}>
            Continuar
            <ArrowRight aria-hidden className="size-5" />
          </Button>
        </section>
      ) : null}

      {step === 1 ? (
        <form
          aria-label="Datos del cliente"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void goToStep(2);
          }}
          noValidate
        >
          <TextField
            label="Nombre completo"
            autoComplete="name"
            placeholder="Ej. Ana María Pérez"
            error={errors.name?.message}
            {...register("name")}
          />
          <TextField
            label="Teléfono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Ej. +57 300 123 4567"
            error={errors.phone?.message}
            {...register("phone")}
          />
          <TextField
            label="Correo electrónico"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            error={errors.email?.message}
            {...register("email")}
          />

          {fulfillmentType === "delivery" ? (
            <fieldset className="flex flex-col gap-4 rounded-card border border-border-soft bg-surface p-4">
              <legend className="px-1 text-sm font-bold">Dirección de entrega</legend>
              <TextField
                label="Dirección"
                autoComplete="street-address"
                placeholder="Calle 10 # 5-51, Apto 201"
                error={errors.street?.message}
                {...register("street")}
              />
              <TextField
                label="Detalles (opcional)"
                placeholder="Torre, conjunto, punto de referencia…"
                error={errors.details?.message}
                {...register("details")}
              />
              <TextField
                label="Barrio (opcional)"
                autoComplete="address-level3"
                placeholder="Ej. La Candelaria"
                error={errors.neighborhood?.message}
                {...register("neighborhood")}
              />
              <p className="text-[12px] text-faint">{branch?.deliveryAreaNote}</p>
            </fieldset>
          ) : null}

          <TextAreaField
            label="Notas del pedido (opcional)"
            placeholder="Indicaciones generales para el restaurante…"
            error={errors.notes?.message}
            {...register("notes")}
          />

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => goToStep(0)}>
              <ArrowLeft aria-hidden className="size-5" />
              Atrás
            </Button>
            <Button type="submit" className="flex-1">
              Continuar
              <ArrowRight aria-hidden className="size-5" />
            </Button>
          </div>
        </form>
      ) : null}

      {step === 2 ? (
        <section aria-label="Pago y confirmación" className="flex flex-col gap-4">
          <fieldset className="rounded-card border border-border-soft bg-surface p-4">
            <legend className="px-1 text-sm font-bold">Método de pago</legend>
            <div role="radiogroup" aria-label="Método de pago" className="mt-1 flex flex-col gap-2">
              <div
                role="radio"
                aria-checked="true"
                className="flex items-center gap-3 rounded-2xl border border-action/70 bg-action/10 px-4 py-3.5"
              >
                <Wallet aria-hidden className="size-5 text-action" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">Pago de demostración</p>
                  <p className="text-[13px] text-muted">
                    Flujo completo sin cobro real: ideal para probar la aplicación.
                  </p>
                </div>
                <BadgeCheck aria-hidden className="size-5 shrink-0 text-action" />
              </div>
              <div
                aria-disabled="true"
                className="flex items-center gap-3 rounded-2xl border border-border-soft bg-white/4 px-4 py-3.5 opacity-55"
              >
                <CreditCard aria-hidden className="size-5 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">Tarjeta (Stripe) · Mercado Pago</p>
                  <p className="text-[13px] text-muted">
                    Se activan configurando credenciales en el servidor (ver README).
                  </p>
                </div>
                <Badge variant="muted">Requiere configuración</Badge>
              </div>
            </div>
          </fieldset>

          <section
            aria-label="Resumen final"
            className="rounded-card border border-border-soft bg-surface p-4"
          >
            <h2 className="mb-1 text-base font-bold">Resumen</h2>
            <p className="mb-3 text-[13px] text-muted">
              {fulfillmentType === "pickup"
                ? "Recogida en"
                : fulfillmentType === "local"
                  ? "Mesa en"
                  : "Entrega desde"}{" "}
              {branch?.name} · {items.length} {items.length === 1 ? "línea" : "líneas"}
            </p>
            <ul className="mb-3 flex flex-col gap-1.5 border-b border-border-soft pb-3">
              {items.map((line) => (
                <li key={line.lineId} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {line.quantity} × {line.nameSnapshot}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(
                      (line.unitPriceSnapshot +
                        line.modifiers.reduce((sum, modifier) => sum + modifier.priceSnapshot, 0)) *
                        line.quantity,
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <CartSummary totals={totals} fulfillmentType={fulfillmentType} />
          </section>

          {serverError ? (
            <p role="alert" className="rounded-2xl border border-error/40 bg-error/10 px-4 py-3 text-[13px] font-semibold text-error">
              {serverError}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={submitting} onClick={() => goToStep(1)}>
              <ArrowLeft aria-hidden className="size-5" />
              Atrás
            </Button>
            <Button className="flex-1" loading={submitting} onClick={submitOrder}>
              {submitting ? "Confirmando…" : `Confirmar pedido · ${formatCurrency(totals.total)}`}
            </Button>
          </div>
          <p className="text-center text-[12px] text-faint">
            Al confirmar aceptas nuestros términos y la política de privacidad. Este pedido usa el
            método de demostración y no genera ningún cobro.
          </p>
        </section>
      ) : null}
    </div>
  );
}
