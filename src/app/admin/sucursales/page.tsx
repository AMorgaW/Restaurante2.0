import { Badge } from "@/components/ui/badge";
import { BranchHours } from "@/components/branches/branch-card";
import { branches } from "@/config/restaurant";

export const metadata = { title: "Sucursales" };

/**
 * Sucursales configuradas en src/config/restaurant.ts. En producción se
 * administran en las tablas `branches`/`opening_hours` de Supabase.
 */
export default function AdminBranchesPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Sucursales</h1>
        <p className="mt-1 text-sm text-muted">
          Direcciones, horarios y servicios se editan en{" "}
          <code className="rounded bg-white/8 px-1.5 py-0.5 text-[12px]">src/config/restaurant.ts</code>{" "}
          (demo) o en Supabase (producción). Los horarios especiales usan la tabla{" "}
          <code className="rounded bg-white/8 px-1.5 py-0.5 text-[12px]">special_hours</code>.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {branches.map((branch) => (
          <li key={branch.id} className="rounded-card border border-border-soft bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">{branch.name}</p>
              <Badge variant={branch.status === "active" ? "success" : "error"}>
                {branch.status === "active" ? "Activa" : "Inactiva"}
              </Badge>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {branch.address}, {branch.city}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {branch.pickupEnabled ? <Badge variant="muted">Recogida</Badge> : null}
              {branch.deliveryEnabled ? <Badge variant="muted">Domicilio</Badge> : null}
              {branch.reservationsEnabled ? <Badge variant="muted">Reservas</Badge> : null}
            </div>
            <div className="mt-3 border-t border-border-soft pt-3">
              <BranchHours branch={branch} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
