import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { BranchContactActions } from "@/components/branches/branch-card";
import { OpeningStatusChip } from "@/components/branches/opening-status";
import { branches, restaurantConfig } from "@/config/restaurant";
import { siteUrl } from "@/lib/env/client";

export const metadata: Metadata = {
  title: "Contacto",
  description: `Contacta a ${restaurantConfig.name}: teléfono, WhatsApp, correo y direcciones.`,
  alternates: { canonical: `${siteUrl}/contacto` },
};

export default function ContactPage() {
  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-6 md:px-0">
      <h1 className="text-screen-title font-extrabold tracking-tight">Contacto</h1>
      <p className="-mt-2 text-sm text-muted">
        Escríbenos o llámanos: respondemos en horario de atención. Los datos mostrados son de
        demostración.
      </p>

      <a
        href={`mailto:${restaurantConfig.contact.email}`}
        className="flex items-center gap-3 rounded-card border border-border-soft bg-surface p-4 transition-colors hover:bg-white/6"
      >
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-action/15 text-action">
          <Mail aria-hidden className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold">Correo general</span>
          <span className="block truncate text-sm text-muted">
            {restaurantConfig.contact.email}
          </span>
        </span>
      </a>

      {branches
        .filter((branch) => branch.status === "active")
        .map((branch) => (
          <section
            key={branch.id}
            aria-label={`Contacto de ${branch.name}`}
            className="rounded-card border border-border-soft bg-surface p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold">{branch.name}</h2>
              <OpeningStatusChip branch={branch} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {branch.address}, {branch.city}
            </p>
            <div className="mt-3">
              <BranchContactActions branch={branch} />
            </div>
          </section>
        ))}
    </div>
  );
}
