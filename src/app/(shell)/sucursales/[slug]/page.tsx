import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, ShoppingBag } from "lucide-react";
import {
  BranchContactActions,
  BranchHours,
} from "@/components/branches/branch-card";
import { OpeningStatusChip } from "@/components/branches/opening-status";
import { PageHeader } from "@/components/layout/page-header";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { branches } from "@/config/restaurant";
import { branchJsonLd } from "@/lib/seo/structured-data";
import { siteUrl } from "@/lib/env/client";

interface BranchPageProps {
  params: Promise<{ slug: string }>;
}

/** Sucursales conocidas en build: slugs desconocidos → 404 real. */
export const dynamicParams = false;

export function generateStaticParams() {
  return branches.map((branch) => ({ slug: branch.slug }));
}

export async function generateMetadata({ params }: BranchPageProps): Promise<Metadata> {
  const { slug } = await params;
  const branch = branches.find((candidate) => candidate.slug === slug);
  if (!branch) return { title: "Sucursal no encontrada" };
  return {
    title: branch.name,
    description: `${branch.name}: ${branch.address}, ${branch.city}. Horarios, contacto y servicios.`,
    alternates: { canonical: `${siteUrl}/sucursales/${branch.slug}` },
  };
}

export default async function BranchPage({ params }: BranchPageProps) {
  const { slug } = await params;
  const branch = branches.find((candidate) => candidate.slug === slug);
  if (!branch) notFound();

  return (
    <div className="flex flex-col gap-5 pb-6">
      <JsonLd data={branchJsonLd(branch)} />
      <PageHeader title={branch.name} backHref="/sucursales" />

      <div className="flex flex-col gap-5 px-4 md:px-0">
        <div className="flex flex-wrap items-center gap-2">
          <OpeningStatusChip branch={branch} />
          {branch.pickupEnabled ? <Badge variant="muted">Recogida</Badge> : null}
          {branch.deliveryEnabled ? <Badge variant="muted">Domicilio</Badge> : null}
          {branch.reservationsEnabled ? <Badge variant="muted">Reservas</Badge> : null}
        </div>

        <section
          aria-label="Dirección y contacto"
          className="rounded-card border border-border-soft bg-surface p-4"
        >
          <h2 className="text-base font-bold">Dirección</h2>
          <p className="mt-1 text-sm text-muted">
            {branch.address}, {branch.city}
          </p>
          <div className="mt-3">
            <BranchContactActions branch={branch} />
          </div>
        </section>

        <section
          aria-label="Horario"
          className="rounded-card border border-border-soft bg-surface p-4"
        >
          <h2 className="mb-3 text-base font-bold">Horario</h2>
          <BranchHours branch={branch} />
        </section>

        {branch.deliveryEnabled ? (
          <section
            aria-label="Zona de entrega"
            className="rounded-card border border-border-soft bg-surface p-4"
          >
            <h2 className="text-base font-bold">Domicilios</h2>
            <p className="mt-1 text-sm text-muted">{branch.deliveryAreaNote}</p>
          </section>
        ) : null}

        <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
          <Link
            href="/menu"
            className="inline-flex h-14 items-center justify-center gap-2 rounded-button bg-action px-6 text-base font-bold text-action-foreground shadow-glow transition-[transform,filter] hover:brightness-95 active:scale-[0.98] motion-reduce:active:scale-100"
          >
            <ShoppingBag aria-hidden className="size-5" />
            Pedir ahora
          </Link>
          {branch.reservationsEnabled ? (
            <Link
              href="/reservar"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-button border border-border-soft bg-surface-elevated px-6 text-base font-semibold text-foreground transition-[border-color,transform] hover:border-border-strong active:scale-[0.98] motion-reduce:active:scale-100"
            >
              <CalendarClock aria-hidden className="size-5" />
              Reservar mesa
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
