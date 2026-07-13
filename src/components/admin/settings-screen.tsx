"use client";

import { Database, Eye, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { restaurantConfig } from "@/config/restaurant";
import { formatCurrency } from "@/lib/format/currency";
import { ROLE_PERMISSIONS, useAdminStore, type AdminRole } from "@/stores/admin";
import { useOnboardingStore } from "@/stores/onboarding";

const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  manager: "Gerente",
  kitchen: "Cocina",
  cashier: "Caja",
  editor: "Editor",
  support: "Atención",
};

const PERMISSION_LABELS: Record<string, string> = {
  view: "Ver panel",
  "edit-menu": "Editar menú",
  "edit-prices": "Editar precios",
  "edit-orders": "Gestionar pedidos",
  "edit-settings": "Configuración",
  "manage-users": "Usuarios",
};

interface HealthInfo {
  dataMode: string;
  paymentProvider: string;
  menuItems: number;
}

/** Configuración: estado del sistema, roles y acciones demo reales. */
export function SettingsScreen() {
  const { toast } = useToast();
  const overrides = useAdminStore((state) => state.overrides);
  const clearAllOverrides = useAdminStore((state) => state.clearAllOverrides);
  const resetOnboarding = useOnboardingStore((state) => state.reset);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthError, setHealthError] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((data: HealthInfo) => setHealth(data))
      .catch(() => setHealthError(true));
  }, []);

  const overridesCount = Object.keys(overrides).length;
  const permissions = Object.keys(PERMISSION_LABELS);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm text-muted">
          Estado del sistema, permisos por rol y utilidades del modo demostración.
        </p>
      </header>

      <section
        aria-labelledby="estado-sistema"
        className="rounded-card border border-border-soft bg-surface p-4"
      >
        <h2 id="estado-sistema" className="flex items-center gap-2 text-base font-bold">
          <Database aria-hidden className="size-5 text-lime" />
          Estado del sistema
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm xs:grid-cols-2">
          <div className="rounded-xl bg-white/4 px-3 py-2.5">
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-faint">
              Modo de datos
            </dt>
            <dd className="mt-0.5 font-bold">
              {healthError ? "No disponible" : (health?.dataMode ?? "…")}
              {health?.dataMode === "local" ? (
                <span className="ml-2 text-[12px] font-medium text-muted">(demo sin credenciales)</span>
              ) : null}
            </dd>
          </div>
          <div className="rounded-xl bg-white/4 px-3 py-2.5">
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-faint">
              Proveedor de pagos
            </dt>
            <dd className="mt-0.5 font-bold">
              {healthError ? "No disponible" : (health?.paymentProvider ?? "…")}
            </dd>
          </div>
          <div className="rounded-xl bg-white/4 px-3 py-2.5">
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-faint">Moneda</dt>
            <dd className="mt-0.5 font-bold">
              {restaurantConfig.currency.code} · ej. {formatCurrency(38500)}
            </dd>
          </div>
          <div className="rounded-xl bg-white/4 px-3 py-2.5">
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-faint">
              Impuesto configurado
            </dt>
            <dd className="mt-0.5 font-bold">
              {(restaurantConfig.checkout.taxRate * 100).toFixed(0)}%
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[12px] text-faint">
          Para conectar Supabase, pagos o correo: copia .env.example a .env.local y sigue el README
          (sección “Conectar Supabase”). La aplicación funciona completa sin credenciales.
        </p>
      </section>

      <section
        aria-labelledby="roles-titulo"
        className="rounded-card border border-border-soft bg-surface p-4"
      >
        <h2 id="roles-titulo" className="flex items-center gap-2 text-base font-bold">
          <ShieldCheck aria-hidden className="size-5 text-lime" />
          Permisos por rol
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <caption className="sr-only">Matriz de permisos por rol</caption>
            <thead>
              <tr className="border-b border-border-soft">
                <th scope="col" className="py-2 pr-3 font-bold">
                  Rol
                </th>
                {permissions.map((permission) => (
                  <th key={permission} scope="col" className="px-2 py-2 text-[12px] font-bold">
                    {PERMISSION_LABELS[permission]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(ROLE_PERMISSIONS) as AdminRole[]).map((role) => (
                <tr key={role} className="border-b border-border-soft/60">
                  <th scope="row" className="py-2 pr-3 font-semibold">
                    {ROLE_LABELS[role]}
                  </th>
                  {permissions.map((permission) => (
                    <td key={permission} className="px-2 py-2">
                      {ROLE_PERMISSIONS[role].has(permission) ? (
                        <span aria-label="Permitido" className="text-success">
                          ✓
                        </span>
                      ) : (
                        <span aria-label="No permitido" className="text-faint">
                          —
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-faint">
          En producción estos roles viven en la tabla `profiles` y las políticas RLS de Supabase
          (p. ej. cocina no puede modificar precios).
        </p>
      </section>

      <section
        aria-labelledby="utilidades-titulo"
        className="rounded-card border border-border-soft bg-surface p-4"
      >
        <h2 id="utilidades-titulo" className="text-base font-bold">
          Utilidades de demostración
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          <Button
            variant="secondary"
            size="md"
            disabled={overridesCount === 0}
            onClick={() => {
              clearAllOverrides();
              toast({ title: "Ajustes demo restablecidos", description: "El menú vuelve a sus valores originales." });
            }}
          >
            <RotateCcw aria-hidden className="size-4" />
            Restablecer ajustes del menú ({overridesCount})
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              resetOnboarding();
              toast({
                title: "Bienvenida reactivada",
                description: "Se mostrará al visitar el inicio.",
              });
            }}
          >
            <Eye aria-hidden className="size-4" />
            Volver a ver la pantalla de bienvenida
          </Button>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-button border border-border-soft bg-white/4 px-5 text-[15px] font-semibold text-foreground transition-colors hover:bg-white/8"
          >
            Ir a la tienda
          </Link>
        </div>
      </section>

      <section
        aria-labelledby="seo-admin-titulo"
        className="rounded-card border border-border-soft bg-surface p-4"
      >
        <h2 id="seo-admin-titulo" className="text-base font-bold">
          SEO y contenido de portada
        </h2>
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">Título del sitio</dt>
            <dd className="font-semibold">
              {restaurantConfig.name} — {restaurantConfig.tagline}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">Sitemap</dt>
            <dd>
              <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="font-semibold text-lime underline-offset-4 hover:underline">
                /sitemap.xml
              </a>
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">Robots</dt>
            <dd>
              <a href="/robots.txt" target="_blank" rel="noopener noreferrer" className="font-semibold text-lime underline-offset-4 hover:underline">
                /robots.txt
              </a>
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">Datos estructurados</dt>
            <dd className="font-semibold">
              <Badge variant="success">Restaurant · Menu · MenuItem · LocalBusiness</Badge>
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-[12px] text-faint">
          Los textos de marca y SEO se editan en `src/config/restaurant.ts`; los de cada plato, en
          sus overrides.
        </p>
      </section>
    </div>
  );
}
