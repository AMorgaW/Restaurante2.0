"use client";

import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ChefHat, Utensils } from "lucide-react";
import { servicePeriodLabel } from "@/lib/employee/selectors";
import type { EmployeeRole } from "@/lib/employee/authorization";
import type { ServicePeriod } from "@/lib/menu/service-period";
import { Badge } from "@/components/ui/badge";
import type { MenuItem } from "@/types/menu";

export function EmployeeMenuDay({ role: _role, period, menuItems }: { role: EmployeeRole; period: ServicePeriod; menuItems: Array<MenuItem & { recipePending: boolean; inventoryWarning: boolean }> }) {
  const items = period === "closed" ? [] : menuItems;
  return (
    <section id="menu" aria-labelledby="empleado-menu" className="scroll-mt-5 rounded-card border border-border-soft bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-full bg-lime/10 text-lime"><Utensils aria-hidden className="size-5" /></div><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lime">Servicio</p><h2 id="empleado-menu" className="mt-1 text-xl font-extrabold">Menú del día</h2></div></div>
        <Badge variant={period === "closed" ? "warning" : "lime"}>{servicePeriodLabel(period)}</Badge>
      </div>
      {period === "closed" ? <p className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">El servicio está cerrado. La consulta del menú permanece disponible al abrir.</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => {
          const recipePending = item.recipePending;
          return <Link key={item.id} href={`/plato/${item.slug}`} className="group min-w-0 rounded-2xl border border-border-soft bg-background-secondary/60 p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime">
            <div className="relative aspect-[1.25] overflow-hidden rounded-xl bg-background-secondary"><Image src={item.image.publicPath} alt="" fill sizes="(max-width: 640px) 45vw, 220px" className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100" /></div>
            <p className="mt-2 line-clamp-2 text-sm font-bold">{item.shortName ?? item.fullName}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{!item.available ? <Badge variant="error">No disponible</Badge> : recipePending ? <Badge variant="warning"><ChefHat aria-hidden className="size-3" /> Receta pendiente</Badge> : item.inventoryWarning ? <Badge variant="error"><AlertTriangle aria-hidden className="size-3" /> Stock crítico</Badge> : <Badge variant="lime">Disponible</Badge>}</div>
          </Link>;
        })}
      </div>
      {period !== "closed" && items.length === 0 ? <p className="mt-4 text-sm text-muted">No hay productos disponibles para este servicio.</p> : null}
      <p className="mt-4 text-xs text-muted">Datos de demostración locales; las cantidades de recetas son ficticias.</p>
    </section>
  );
}
