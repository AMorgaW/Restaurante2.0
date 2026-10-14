"use client";

import { ArrowRight, TicketPercent, Trash2, X } from "lucide-react";
// Router plano (sin view transition): el salto carrito→checkout no comparte
// elementos visuales y el snapshot de barras fijas con backdrop-blur es
// inestable en WebKit (fallback estable previsto).
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartItemRow } from "@/components/cart/cart-item-row";
import { CartSummary } from "@/components/cart/cart-summary";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { branches, coupons, restaurantConfig } from "@/config/restaurant";
import { calculateTotals, cartItemCount } from "@/features/cart/calculations";
import { track } from "@/lib/analytics";
import { useMenuItemsWithAdminOverrides } from "@/hooks/use-menu-items";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { consumeCartRepairNotice, useCartStore } from "@/stores/cart";
import type { MenuItem } from "@/types/menu";

/**
 * Pantalla del carrito: líneas editables, cupón, propina, desglose y CTA
 * hacia el checkout. Detecta cambios de precio/disponibilidad frente al
 * menú vigente al montar.
 */
export function CartScreen({
  menuItems,
  allowDemoOverrides = true,
}: {
  menuItems: MenuItem[];
  allowDemoOverrides?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const mounted = useMounted();
  const adjustedMenu = useMenuItemsWithAdminOverrides(menuItems, allowDemoOverrides);

  const items = useCartStore((state) => state.items);
  const couponCode = useCartStore((state) => state.couponCode);
  const setCoupon = useCartStore((state) => state.setCoupon);
  const tipPercent = useCartStore((state) => state.tipPercent);
  const setTip = useCartStore((state) => state.setTip);
  const fulfillmentType = useCartStore((state) => state.fulfillmentType);
  const branchId = useCartStore((state) => state.branchId);
  const clear = useCartStore((state) => state.clear);
  const reconcileWithMenu = useCartStore((state) => state.reconcileWithMenu);
  const [persistHydrated, setPersistHydrated] = useState(
    () => typeof window !== "undefined" && Boolean(useCartStore.persist?.hasHydrated()),
  );

  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [reconciliationNotice, setReconciliationNotice] = useState<string[]>([]);

  useEffect(() => {
    const persistApi = useCartStore.persist;
    if (!persistApi) {
      setPersistHydrated(true);
      return;
    }
    if (persistApi.hasHydrated()) setPersistHydrated(true);
    return persistApi.onFinishHydration(() => setPersistHydrated(true));
  }, []);

  // Sincroniza snapshots con el menú vigente una sola vez tras montar.
  const reconciled = useRef(false);
  useEffect(() => {
    if (!mounted || !persistHydrated || reconciled.current) return;
    reconciled.current = true;
    const persistedRepair = consumeCartRepairNotice();
    const report = items.length > 0
      ? reconcileWithMenu(adjustedMenu)
      : {
          priceChanged: [],
          updated: [],
          modified: [],
          removed: [],
          nonPurchasable: [],
          invalid: [],
          merged: [],
        };
    const { priceChanged, removed } = report;
    if (removed.length > 0) {
      toast({
        title: "Carrito actualizado",
        description: `Ya no disponible: ${removed.join(", ")}.`,
        variant: "error",
      });
    }
    if (priceChanged.length > 0) {
      toast({
        title: "Precios actualizados",
        description: `Cambió el precio de: ${priceChanged.join(", ")}.`,
      });
    }
    const messages = [
      ...(persistedRepair?.removed.length
        ? [`Retiramos datos incompletos de ${persistedRepair.removed.join(", ")}.`]
        : []),
      ...(persistedRepair?.adjusted.length
        ? [`Ajustamos cantidades o notas de ${persistedRepair.adjusted.join(", ")}.`]
        : []),
      ...(report.nonPurchasable.length
        ? [`Retiramos productos que aún no se venden por separado: ${report.nonPurchasable.join(", ")}.`]
        : []),
      ...(report.removed.length
        ? [`Retiramos productos que ya no están disponibles: ${report.removed.join(", ")}.`]
        : []),
      ...(report.priceChanged.length
        ? [`Actualizamos el precio vigente de ${report.priceChanged.join(", ")}.`]
        : []),
      ...(report.updated.length
        ? [`Actualizamos nombre, fotografía o identidad de ${report.updated.join(", ")}.`]
        : []),
      ...(report.modified.length
        ? [`Revisamos opciones guardadas de ${report.modified.join(", ")}.`]
        : []),
      ...(report.merged.length
        ? [`Unificamos líneas repetidas de ${report.merged.join(", ")}.`]
        : []),
    ];
    setReconciliationNotice([...new Set(messages)]);
  }, [mounted, persistHydrated, items.length, adjustedMenu, reconcileWithMenu, toast]);

  const activeCoupon = useMemo(
    () => coupons.find((coupon) => coupon.code === couponCode && coupon.active) ?? null,
    [couponCode],
  );

  const branch = branches.find((candidate) => candidate.id === branchId) ?? branches[0];
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

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (code.length === 0) return;
    const found = coupons.find((coupon) => coupon.code === code && coupon.active);
    if (!found) {
      setCouponError("El cupón ingresado no es válido o ya expiró.");
      return;
    }
    setCouponError(null);
    setCoupon(code);
    setCouponInput("");
    toast({ title: "Cupón aplicado", description: found.description, variant: "success" });
  };

  if (!mounted) {
    return (
      <div aria-busy="true" className="cart-screen flex flex-col gap-3 px-4 pt-5 md:px-0">
        <div className="skeleton h-8 w-40 rounded-xl" />
        <div className="skeleton h-28 w-full rounded-card" />
        <div className="skeleton h-28 w-full rounded-card" />
      </div>
    );
  }

  if (!persistHydrated) {
    return (
      <div aria-busy="true" className="cart-screen flex flex-col gap-3 px-4 pt-5 md:px-0">
        <div className="skeleton h-8 w-40 rounded-xl" />
        <div className="skeleton h-28 w-full rounded-card" />
      </div>
    );
  }

  const notice = reconciliationNotice.length > 0 ? (
    <section
      role="status"
      aria-label="Actualizaciones del carrito"
      data-testid="cart-reconciliation-notice"
      className="cart-reconciliation-notice rounded-2xl border px-4 py-3 text-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-extrabold">Revisamos tu carrito</p>
        <button
          type="button"
          aria-label="Cerrar aviso de actualización del carrito"
          onClick={() => setReconciliationNotice([])}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/8 hover:text-foreground"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-[13px]">
        {reconciliationNotice.map((message) => <li key={message}>{message}</li>)}
      </ul>
    </section>
  ) : null;

  if (items.length === 0) {
    return (
      <div className="cart-screen px-4 pt-5 md:px-0">
        <h1 className="text-screen-title font-extrabold tracking-tight">Carrito</h1>
        {notice}
        <EmptyState
          title="Tu carrito está vacío"
          description="Explora el menú y añade tus platos favoritos."
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
    <div className="cart-screen flex flex-col gap-5 px-4 pt-5 pb-8 md:px-0">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-screen-title font-extrabold tracking-tight">Carrito</h1>
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          className="flex items-center gap-1.5 rounded-full bg-white/6 px-3.5 py-2 text-[13px] font-semibold text-muted transition-colors hover:bg-error/15 hover:text-error"
        >
          <Trash2 aria-hidden className="size-4" />
          Vaciar
        </button>
      </div>

      <p className="-mt-3 text-sm text-muted">
        {cartItemCount(items)} {cartItemCount(items) === 1 ? "producto" : "productos"} ·{" "}
        {branch?.name}
      </p>

      {notice}

      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <CartItemRow key={item.lineId} item={item} />
        ))}
      </ul>

      {/* Cupón */}
      <section aria-labelledby="cupon-titulo" className="rounded-card border border-border-soft bg-surface p-4">
        <h2 id="cupon-titulo" className="flex items-center gap-2 text-base font-bold">
          <TicketPercent aria-hidden className="size-5 text-lime" />
          Cupón de descuento
        </h2>
        {activeCoupon ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-lime/40 bg-lime/10 px-4 py-3">
            <div className="min-w-0">
              <p className="font-bold text-lime">{activeCoupon.code}</p>
              <p className="text-[13px] text-muted">{activeCoupon.description}</p>
            </div>
            <button
              type="button"
              onClick={() => setCoupon(null)}
              className="shrink-0 rounded-full bg-white/8 px-3.5 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-white/14"
            >
              Quitar
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <label htmlFor="cupon-input" className="sr-only">
                Código de cupón
              </label>
              <input
                id="cupon-input"
                value={couponInput}
                onChange={(event) => {
                  setCouponInput(event.target.value);
                  setCouponError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyCoupon();
                }}
                placeholder="Ej. BIENVENIDA10"
                autoComplete="off"
                aria-invalid={couponError ? true : undefined}
                aria-describedby={couponError ? "cupon-error" : undefined}
                className={cn(
                  "h-12 min-w-0 flex-1 rounded-button border border-border-soft bg-white/6 px-4 text-[15px] uppercase text-foreground placeholder:normal-case placeholder:text-faint outline-none transition-colors focus:border-lime/60",
                  couponError && "border-error/60",
                )}
              />
              <Button size="md" variant="secondary" onClick={applyCoupon}>
                Aplicar
              </Button>
            </div>
            {couponError ? (
              <p id="cupon-error" role="alert" className="text-[13px] font-medium text-error">
                {couponError}
              </p>
            ) : null}
          </div>
        )}
      </section>

      {/* Propina */}
      <section aria-labelledby="propina-titulo" className="rounded-card border border-border-soft bg-surface p-4">
        <h2 id="propina-titulo" className="text-base font-bold">
          Propina <span className="font-normal text-muted">(opcional)</span>
        </h2>
        <div role="group" aria-label="Porcentaje de propina" className="mt-3 flex flex-wrap gap-2">
          {restaurantConfig.checkout.tipOptions.map((percent) => (
            <button
              key={percent}
              type="button"
              aria-pressed={tipPercent === percent}
              onClick={() => setTip(percent)}
              className={cn(
                "h-11 min-w-16 rounded-chip px-4 text-sm font-bold transition-colors",
                tipPercent === percent
                  ? "bg-action text-action-foreground"
                  : "border border-border-soft bg-white/6 text-muted hover:text-foreground",
              )}
            >
              {percent === 0 ? "Sin propina" : `${percent}%`}
            </button>
          ))}
        </div>
      </section>

      {/* Desglose */}
      <section
        aria-labelledby="resumen-titulo"
        className="rounded-card border border-border-soft bg-surface p-4"
      >
        <h2 id="resumen-titulo" className="mb-3 text-base font-bold">
          Resumen
        </h2>
        <CartSummary totals={totals} fulfillmentType={fulfillmentType} />
      </section>

      {/* CTA en el flujo: queda después del resumen y no tapa líneas en teléfonos bajos. */}
      <div className="cart-checkout-bar -mx-4 px-4 py-3 md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="mx-auto max-w-lg md:max-w-none">
          <Button
            fullWidth
            onClick={() => {
              track("begin_checkout", { items: items.length, total: totals.total });
              router.push("/checkout");
            }}
          >
            Continuar con el pedido
            <ArrowRight aria-hidden className="size-5" />
          </Button>
        </div>
      </div>

      <Dialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="¿Vaciar el carrito?"
        description="Se eliminarán todos los productos añadidos. Esta acción no puede deshacerse."
        footer={
          <>
            <Button
              variant="destructive"
              size="md"
              fullWidth
              onClick={() => {
                clear();
                setConfirmClear(false);
                toast({ title: "Carrito vaciado" });
              }}
            >
              Sí, vaciar carrito
            </Button>
            <Button variant="secondary" size="md" fullWidth onClick={() => setConfirmClear(false)}>
              Conservar productos
            </Button>
          </>
        }
      />
    </div>
  );
}
