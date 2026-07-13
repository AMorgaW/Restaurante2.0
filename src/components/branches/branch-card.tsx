"use client";

import { Bike, CalendarClock, MapPin, MessageCircle, Navigation, Phone, Store } from "lucide-react";
import Link from "next/link";
import { OpeningStatusChip } from "@/components/branches/opening-status";
import { Badge } from "@/components/ui/badge";
import { track } from "@/lib/analytics";
import type { Branch } from "@/types/restaurant";

/** Enlaces de contacto directos y funcionales de una sucursal. */
export function BranchContactActions({ branch }: { branch: Branch }) {
  const actions = [
    {
      href: `tel:${branch.phone.replace(/\s/g, "")}`,
      label: "Llamar",
      icon: Phone,
      onClick: () => track("click_phone", { branch: branch.slug }),
    },
    {
      href: `https://wa.me/${branch.whatsapp.replace(/[^\d]/g, "")}`,
      label: "WhatsApp",
      icon: MessageCircle,
      external: true,
      onClick: () => track("click_whatsapp", { branch: branch.slug }),
    },
    {
      href: `https://www.google.com/maps/search/?api=1&query=${branch.latitude},${branch.longitude}`,
      label: "Cómo llegar",
      icon: Navigation,
      external: true,
      onClick: () => track("click_directions", { branch: branch.slug }),
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <a
            key={action.label}
            href={action.href}
            {...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            onClick={action.onClick}
            className="inline-flex h-11 items-center gap-1.5 rounded-chip border border-border-soft bg-white/6 px-4 text-sm font-semibold text-foreground transition-[background-color,transform] hover:bg-white/12 active:scale-[0.97] motion-reduce:active:scale-100"
          >
            <Icon aria-hidden className="size-4 text-lime" />
            {action.label}
          </a>
        );
      })}
    </div>
  );
}

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Horario semanal legible de una sucursal. */
export function BranchHours({ branch }: { branch: Branch }) {
  return (
    <dl className="flex flex-col gap-1.5">
      {branch.openingHours.map((entry) => (
        <div key={entry.dayOfWeek} className="flex items-center justify-between gap-3 text-sm">
          <dt className="text-muted">{DAY_LABELS[entry.dayOfWeek]}</dt>
          <dd className="font-semibold tabular-nums">
            {entry.isClosed ? "Cerrado" : `${entry.openingTime} – ${entry.closingTime}`}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Tarjeta resumen de sucursal para el listado. */
export function BranchCard({ branch }: { branch: Branch }) {
  return (
    <article className="relative flex flex-col gap-3 rounded-card border border-border-soft bg-surface p-4 shadow-card">
      <Link
        href={`/sucursales/${branch.slug}`}
        aria-label={`Ver detalles de ${branch.name}`}
        className="absolute inset-0 z-[1] rounded-card"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold">{branch.name}</h3>
          <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-lime" />
            {branch.address}, {branch.city}
          </p>
        </div>
      </div>
      <OpeningStatusChip branch={branch} />
      <div className="flex flex-wrap gap-2">
        {branch.pickupEnabled ? (
          <Badge variant="muted">
            <Store aria-hidden className="size-3.5" />
            Recogida
          </Badge>
        ) : null}
        {branch.deliveryEnabled ? (
          <Badge variant="muted">
            <Bike aria-hidden className="size-3.5" />
            Domicilio
          </Badge>
        ) : null}
        {branch.reservationsEnabled ? (
          <Badge variant="muted">
            <CalendarClock aria-hidden className="size-3.5" />
            Reservas
          </Badge>
        ) : null}
      </div>
    </article>
  );
}
