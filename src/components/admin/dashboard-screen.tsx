"use client";

import {
  ArrowRight,
  CircleCheck,
  CircleX,
  Clock3,
  PackageSearch,
  ReceiptText,
  Star,
  Tags,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { InventoryDashboardCard } from "@/components/admin/inventory-dashboard-card";
import { useEffectiveAdminRole } from "@/components/admin/admin-role-context";
import { restaurantConfig } from "@/config/restaurant";
import { DEMO_RECENT_ORDERS } from "@/lib/inventory/fixtures";
import { getAdminDashboardMetrics, getInventorySummary } from "@/lib/inventory/selectors";
import { getOpeningStatus, getLocalDateParts } from "@/lib/menu/opening-hours";
import { canAccessAdminPath } from "@/lib/admin/authorization";
import { formatCurrency } from "@/lib/format/currency";
import { useAdminStore } from "@/stores/admin";
import { useInventoryStore } from "@/stores/inventory";
import { useOrdersStore } from "@/stores/orders";
import type { MenuItem } from "@/types/menu";
import type { OpeningStatus } from "@/types/restaurant";
import type { InventoryItem, InventoryMovement } from "@/lib/inventory/types";

/** Dashboard: local=Zustand demo; supabase=inventario PostgreSQL (sin fallback silencioso). */
export function DashboardScreen({
  items,
  mode = "local",
  inventoryItems: supabaseItems,
  inventoryMovements: supabaseMovements,
  inventoryError = null,
}: {
  items: MenuItem[];
  mode?: "local" | "supabase";
  inventoryItems?: InventoryItem[];
  inventoryMovements?: InventoryMovement[];
  inventoryError?: string | null;
}) {
  const orders = useOrdersStore((state) => state.orders);
  const overrides = useAdminStore((state) => state.overrides);
  const demoRole = useAdminStore((state) => state.demoRole);
  const storeInventoryItems = useInventoryStore((state) => state.items);
  const storeInventoryMovements = useInventoryStore((state) => state.movements);
  const inventoryItems = mode === "supabase" ? (supabaseItems ?? []) : storeInventoryItems;
  const inventoryMovements = mode === "supabase" ? (supabaseMovements ?? []) : storeInventoryMovements;
  const role = useEffectiveAdminRole(demoRole);
  const scheduleBranch =
    restaurantConfig.branches.find((branch) => branch.id === restaurantConfig.defaultBranchId) ??
    restaurantConfig.branches[0]!;
  const [openingStatus, setOpeningStatus] = useState<OpeningStatus | null>(null);
  useEffect(() => {
    const update = () => setOpeningStatus(getOpeningStatus(scheduleBranch));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [scheduleBranch]);

  const metrics = useMemo(() => getAdminDashboardMetrics(orders), [orders]);
  const inventorySummary = useMemo(
    () => getInventorySummary(inventoryItems, inventoryMovements),
    [inventoryItems, inventoryMovements],
  );
  const currentSchedule = useMemo(() => {
    if (!openingStatus) return "Consultando horario…";
    const local = getLocalDateParts(new Date(), scheduleBranch.timezone);
    const today = scheduleBranch.openingHours.find((entry) => entry.dayOfWeek === local.dayOfWeek);
    return today && !today.isClosed ? `${today.openingTime} – ${today.closingTime}` : "Sin servicio programado hoy";
  }, [scheduleBranch, openingStatus]);

  const categoryCount = useMemo(
    () => new Set(items.map((item) => item.categorySlug)).size,
    [items],
  );

  const stats = [
    { label: "Platos", value: items.length, icon: UtensilsCrossed, href: "/admin/platos" },
    { label: "Categorías", value: categoryCount, icon: Tags, href: "/admin/categorias" },
    { label: "Pedidos del día", value: metrics.ordersToday, icon: ReceiptText, href: "/admin/pedidos" },
    { label: "Ventas del día", value: formatCurrency(metrics.salesToday), icon: CircleCheck, href: "/admin/pedidos" },
    { label: "Pensionados activos", value: metrics.pensionersActive, icon: Star, href: "/admin/pensionados" },
    { label: "Domicilios pendientes", value: metrics.pendingDeliveries, icon: Clock3, href: "/admin/pedidos" },
  ];
  const visibleStats = stats.filter((stat) => canAccessAdminPath(role, stat.href));
  const overridesCount = Object.keys(overrides).length;
  const canAccessCatalog = canAccessAdminPath(role, "/admin/platos");
  const canAccessInventory = canAccessAdminPath(role, "/admin/inventario");
  const canAccessOrders = canAccessAdminPath(role, "/admin/pedidos");

  const quickLinks = [
    { href: "/admin/pedidos", label: "Gestionar pedidos" },
    { href: "/admin/platos", label: "Editar menú y precios" },
    { href: "/admin/categorias", label: "Organizar categorías" },
    { href: "/admin/inventario", label: "Controlar inventario" },
    { href: "/admin/mesas", label: "Gestionar mesas" },
    { href: "/admin/empleados", label: "Gestionar empleados" },
    { href: "/admin/pensionados", label: "Gestionar pensionados" },
    { href: "/admin/configuracion", label: "Configuración" },
  ].filter((link) => canAccessAdminPath(role, link.href));

  const primaryCta = canAccessOrders
    ? { href: "/admin/pedidos", label: "Ver pedidos" }
    : canAccessInventory
      ? { href: "/admin/inventario", label: "Ver inventario" }
      : canAccessCatalog
        ? { href: "/admin/platos", label: "Ver platos" }
        : null;

  const recentOrders = orders.length
    ? orders.slice(0, 3).map((order) => ({
        id: order.id,
        label: order.orderNumber,
        channel: order.fulfillmentType === "delivery" ? "Domicilio" : "Local",
        time: new Date(order.createdAt).toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        status: order.status,
      }))
    : DEMO_RECENT_ORDERS;

  const openingHint = openingStatus?.open
    ? "Atendiendo ahora."
    : openingStatus?.opensAt
      ? `Próxima apertura: ${openingStatus.opensAt}.`
      : "Revisa la programación del horario.";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-lime">
            Brisas del Sinú
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Resumen</h1>
          <p className="mt-1 text-sm text-muted">Operación del restaurante</p>
        </div>
        {primaryCta ? (
          <Link
            href={primaryCta.href}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-action px-4 text-sm font-bold text-action-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
          >
            {primaryCta.label}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        ) : null}
      </header>

      <div className="rounded-card border border-border-soft bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          {openingStatus?.open ? (
            <CircleCheck aria-hidden className="size-8 text-lime" />
          ) : (
            <CircleX aria-hidden className="size-8 text-warning" />
          )}
          <div>
            <p
              className={`text-xl font-extrabold ${
                openingStatus?.open ? "text-lime" : "text-warning"
              }`}
            >
              {openingStatus ? (openingStatus.open ? "Abierto" : "Cerrado") : "Horario"}
            </p>
            <p className="text-sm text-foreground">{currentSchedule}</p>
            <p className="mt-0.5 text-xs text-muted">{openingHint}</p>
          </div>
        </div>
      </div>

      <section aria-labelledby="metricas-admin">
        <h2 id="metricas-admin" className="sr-only">
          Métricas operativas
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {visibleStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link
                key={stat.label}
                href={stat.href}
                className="group flex min-h-28 flex-col justify-between rounded-card border border-border-soft bg-surface p-4 transition-colors hover:border-border-strong"
              >
                <Icon aria-hidden className="size-5 text-lime" />
                <span className="text-2xl font-extrabold tabular-nums">{stat.value}</span>
                <span className="text-xs font-semibold text-muted">{stat.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {canAccessInventory ? (
        inventoryError ? (
          <p
            role="alert"
            className="rounded-card border border-error/40 bg-error/10 p-4 text-sm text-error"
          >
            {inventoryError}
          </p>
        ) : (
          <InventoryDashboardCard items={inventoryItems} summary={inventorySummary} />
        )
      ) : null}

      {canAccessCatalog && overridesCount > 0 ? (
        <div className="flex items-start gap-3 rounded-card border border-warning/40 bg-warning/10 p-4">
          <Wrench aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <p className="font-bold text-warning">
              {overridesCount} {overridesCount === 1 ? "plato tiene" : "platos tienen"} ajustes
              demo activos
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              Precios, disponibilidad o textos modificados desde este panel.
            </p>
          </div>
        </div>
      ) : null}

      {canAccessOrders ? (
        <section
          aria-labelledby="pedidos-recientes"
          className="rounded-card border border-border-soft bg-surface p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="pedidos-recientes" className="text-lg font-bold">
              Pedidos recientes
            </h2>
            <Link href="/admin/pedidos" className="text-sm font-bold text-lime">
              Ver todos <ArrowRight aria-hidden className="inline size-4" />
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-border-soft">
            {recentOrders.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-bold">{order.label}</p>
                  <p className="text-xs text-muted">
                    {order.channel} · {order.time}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-lime/40 bg-lime/10 px-2.5 py-1 text-xs font-bold text-lime">
                  {order.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {quickLinks.length > 0 ? (
        <section aria-labelledby="accesos-titulo" className="flex flex-col gap-3">
          <h2 id="accesos-titulo" className="text-lg font-bold">
            Accesos rápidos
          </h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-border-soft bg-white/4 px-4 py-3.5 text-sm font-semibold transition-colors hover:bg-white/8"
              >
                {link.label}
                <ArrowRight aria-hidden className="size-4 text-lime" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {!canAccessInventory && canAccessCatalog ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <PackageSearch aria-hidden className="size-4 text-lime" />
          El inventario aparece aquí cuando tu rol puede gestionarlo.
        </p>
      ) : null}
    </div>
  );
}
