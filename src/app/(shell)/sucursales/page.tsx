import type { Metadata } from "next";
import { BranchCard } from "@/components/branches/branch-card";
import { branches } from "@/config/restaurant";
import { siteUrl } from "@/lib/env/client";

export const metadata: Metadata = {
  title: "Sucursales",
  description: "Encuentra tu sucursal más cercana: direcciones, horarios y servicios.",
  alternates: { canonical: `${siteUrl}/sucursales` },
};

export default function BranchesPage() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-5 md:px-0">
      <h1 className="text-screen-title font-extrabold tracking-tight">Sucursales</h1>
      <p className="-mt-2 text-sm text-muted">
        Direcciones y horarios de demostración; confírmalos antes de visitar.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {branches
          .filter((branch) => branch.status === "active")
          .map((branch) => (
            <BranchCard key={branch.id} branch={branch} />
          ))}
      </div>
    </div>
  );
}
