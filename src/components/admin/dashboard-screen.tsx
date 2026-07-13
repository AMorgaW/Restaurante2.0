"use client";

import { ArrowRight, CalendarClock, ReceiptText, Star, UtensilsCrossed, Wrench } from "lucide-react";
import Link from "next/link";
import { useMenuItemsWithAdminOverrides } from "@/hooks/use-menu-items";
import { useAdminStore } from "@/stores/admin";
import { useOrdersStore } from "@/stores/orders";
import { useReservationsStore } from "@/stores/reservations";
import type { MenuItem } from "@/types/menu";

/** Resumen del panel con métricas locales reales. */
export function DashboardScreen({ items }: { items: MenuItem[] }) {
  const adjusted = useMenuItemsWithAdminOverrides(items);
  const orders = useOrdersStore((state) => state.orders);
  const reservations = useReservationsStore((state) => state.reservations);
  const overrides = useAdminStore((state) => state.overrides);

  const stats = [
    {
      label: "Platos en el menú",
      value: adjusted.length,
      icon: UtensilsCrossed,
      href: "/admin/platos",
    },
    {
      label: "Disponibles ahora",
      value: adjusted.filter((item) => item.available).length,
      icon: Star,
      href: "/admin/platos",
    },
    {
      label: "Pedidos (este navegador)",
      value: orders.length,
      icon: ReceiptText,
      href: "/admin/pedidos",
    },
    {
      label: "Reservas (este navegador)",
      value: reservations.filter((reservation) => reservation.status !== "cancelled").length,
      icon: CalendarClock,
      href: "/admin/reservas",
    },
  ];

  const overridesCount = Object.keys(overrides).length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Resumen</h1>
        <p className="mt-1 text-sm text-muted">
          Panel en modo demostración: los cambios se guardan en este navegador. Con Supabase
          conectado se sincronizan con la base de datos.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group flex flex-col gap-2 rounded-card border border-border-soft bg-surface p-4 transition-colors hover:border-border-strong"
            >
              <Icon aria-hidden className="size-5 text-lime" />
              <span className="text-3xl font-extrabold tabular-nums">{stat.value}</span>
              <span className="text-[13px] font-semibold text-muted">{stat.label}</span>
            </Link>
          );
        })}
      </div>

      {overridesCount > 0 ? (
        <div className="flex items-start gap-3 rounded-card border border-warning/40 bg-warning/10 p-4">
          <Wrench aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <p className="font-bold text-warning">
              {overridesCount} {overridesCount === 1 ? "plato tiene" : "platos tienen"} ajustes demo
              activos
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              Precios, disponibilidad o textos modificados desde este panel. Puedes revisarlos o
              restablecerlos en Platos y Configuración.
            </p>
          </div>
        </div>
      ) : null}

      <section aria-labelledby="accesos-titulo" className="flex flex-col gap-3">
        <h2 id="accesos-titulo" className="text-lg font-bold">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {[
            { href: "/admin/platos", label: "Editar disponibilidad y precios" },
            { href: "/admin/pedidos", label: "Gestionar pedidos entrantes" },
            { href: "/admin/reservas", label: "Revisar reservas" },
            { href: "/admin/configuracion", label: "Configuración y roles" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border-soft bg-white/4 px-4 py-3.5 text-sm font-semibold transition-colors hover:bg-white/8"
            >
              {link.label}
              <ArrowRight aria-hidden className="size-4 text-lime" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
