"use client";

import {
  Armchair,
  LayoutDashboard,
  LogOut,
  MapPin,
  PackageSearch,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  UtensilsCrossed,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import { AdminRoleProvider } from "@/components/admin/admin-role-context";
import { OperationalOrderAlerts } from "@/components/orders/operational-order-alerts";
import { Badge } from "@/components/ui/badge";
import { SkipLink } from "@/components/ui/skip-link";
import { useMounted } from "@/hooks/use-mounted";
import { canAccessAdminPath, isAdminRole } from "@/lib/admin/authorization";
import { canPollOperationalOrders } from "@/lib/orders/operational-order-monitor";
import { cn } from "@/lib/utils";
import { useAdminStore, type AdminRole } from "@/stores/admin";
import { resetStaffDemo } from "@/stores/staff";
import { resetPensionDemo } from "@/stores/pension";

const NAV = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard, exact: true },
  { href: "/admin/platos", label: "Platos", icon: UtensilsCrossed, exact: false },
  { href: "/admin/categorias", label: "Categorías", icon: Tags, exact: false },
  { href: "/admin/inventario", label: "Inventario", icon: PackageSearch, exact: false },
  { href: "/admin/empleados", label: "Empleados", icon: UsersRound, exact: false },
  { href: "/admin/pensionados", label: "Pensionados", icon: UserRoundCog, exact: false },
  { href: "/admin/pedidos", label: "Pedidos", icon: ReceiptText, exact: false },
  { href: "/admin/mesas", label: "Mesas", icon: Armchair, exact: false },
  { href: "/admin/sucursales", label: "Sucursales", icon: MapPin, exact: false },
  { href: "/admin/promociones", label: "Promociones", icon: Sparkles, exact: false },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings, exact: false },
] as const;

const ROLE_OPTIONS: Array<{ role: AdminRole; label: string; description: string }> = [
  { role: "admin", label: "Administrador", description: "Acceso completo delegado y gestion de usuarios." },
  { role: "cashier", label: "Caja", description: "Pedidos y transiciones comerciales limitadas." },
  { role: "support", label: "Atencion", description: "Consulta de pedidos sin permisos de modificacion." },
  { role: "owner", label: "Propietario", description: "Acceso completo: menú, precios, pedidos y configuración." },
  { role: "manager", label: "Gerente", description: "Menú, precios y gestión de pedidos." },
  { role: "kitchen", label: "Cocina", description: "Solo estados de pedidos; sin edición de precios." },
  { role: "editor", label: "Editor", description: "Catálogo, precios y disponibilidad; sin pedidos ni marketing." },
];

const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  manager: "Gerente",
  kitchen: "Cocina",
  cashier: "Caja",
  editor: "Editor",
  support: "Atención al cliente",
};

export function AdminShell({
  children,
  mode = "local",
  dataMode = "local",
  role,
}: {
  children: ReactNode;
  mode?: "local" | "supabase";
  dataMode?: "local" | "supabase";
  role?: string;
}) {
  const pathname = usePathname();
  const mounted = useMounted();
  const demoRole = useAdminStore((state) => state.demoRole);
  const loginDemo = useAdminStore((state) => state.loginDemo);
  const logout = useAdminStore((state) => state.logout);
  const activeRole = mode === "supabase" ? (isAdminRole(role) ? role : null) : demoRole;
  function clearDemoSession() {
    logout();
    resetStaffDemo();
    resetPensionDemo();
  }
  const canAccessCurrentPath = canAccessAdminPath(activeRole, pathname);

  if (!mounted) {
    return (
      <div aria-busy="true" className="flex min-h-dvh items-center justify-center">
        <div className="skeleton h-40 w-full max-w-sm rounded-card" />
      </div>
    );
  }

  if (mode === "supabase" && !activeRole) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5 py-10">
        <div className="w-full max-w-md rounded-card border border-border-soft bg-surface p-5">
          <h1 className="text-xl font-extrabold">Perfil sin permisos</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Tu sesión es válida, pero no existe un perfil administrativo habilitado.
          </p>
          <Link href="/cuenta" className="mt-4 block text-sm font-semibold text-lime underline-offset-4 hover:underline">
            Volver a mi cuenta
          </Link>
        </div>
      </div>
    );
  }

  if (mode === "local" && !activeRole) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5 py-10">
        <BrandMark size="md" />
        <div className="w-full max-w-md rounded-card border border-border-soft bg-surface p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck aria-hidden className="size-6 text-lime" />
            <h1 className="text-xl font-extrabold">Panel de administración</h1>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Estás en <strong className="text-foreground">modo demostración local</strong>: elige un rol
            para explorar el panel. En Supabase, el acceso usa Auth y permisos verificados en el servidor.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.role}
                type="button"
                onClick={() => loginDemo(option.role)}
                className="rounded-2xl border border-border-soft bg-white/4 px-4 py-3 text-left transition-colors hover:border-lime/50 hover:bg-lime/8"
              >
                <span className="block font-bold">{option.label}</span>
                <span className="mt-0.5 block text-[13px] text-muted">{option.description}</span>
              </button>
            ))}
          </div>
          <Link href="/" className="mt-4 block text-center text-sm font-semibold text-lime underline-offset-4 hover:underline">
            Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }

  if (activeRole && !canAccessCurrentPath) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5 py-10">
        <main id="contenido" className="w-full max-w-md rounded-card border border-border-soft bg-surface p-5" tabIndex={-1}>
          <h1 className="text-xl font-extrabold">Acceso denegado</h1>
          <p role="alert" className="mt-2 text-sm leading-relaxed text-muted">
            Tu rol no tiene permiso para esta seccion administrativa.
          </p>
          <Link href="/admin" className="mt-4 inline-flex rounded-full bg-action px-4 py-2 text-sm font-bold text-action-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime">
            Volver al resumen
          </Link>
        </main>
      </div>
    );
  }

  return (
    <AdminRoleProvider mode={mode} role={mode === "supabase" ? activeRole : null}>
      <div className="flex min-h-dvh flex-col md:flex-row">
      <SkipLink />
      <aside className="border-b border-border-soft bg-background-secondary/70 md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3 md:flex-col md:items-start md:gap-4 md:py-5">
          <Link href="/admin" aria-label="Resumen del panel">
            <BrandMark size="sm" />
          </Link>
          <div className="flex items-center gap-2 md:w-full md:justify-between">
            <Badge variant="lime">
              {mode === "local" ? "Demo · " : "Supabase · "}
              {ROLE_LABELS[activeRole as AdminRole]}
            </Badge>
            {mode === "local" ? (
              <button
                type="button"
                onClick={clearDemoSession}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-2 text-[13px] font-semibold text-muted transition-colors hover:text-foreground"
              >
                <LogOut aria-hidden className="size-4" />
                Salir
              </button>
            ) : (
              <form action="/auth/signout" method="post">
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-2 text-[13px] font-semibold text-muted transition-colors hover:text-foreground">
                  <LogOut aria-hidden className="size-4" />
                  Salir
                </button>
              </form>
            )}
          </div>
        </div>
        <nav aria-label="Secciones de administración" className="px-2 pb-2 md:px-3">
          <ul className="no-scrollbar flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {NAV.filter((item) => canAccessAdminPath(activeRole, item.href)).map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href} className="shrink-0 md:shrink">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
                      active ? "bg-action text-action-foreground" : "text-muted hover:bg-white/6 hover:text-foreground",
                    )}
                  >
                    <Icon aria-hidden className="size-4.5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8">
        {mode === "supabase" ? (
          <p role="status" className="mb-4 rounded-xl border border-border-soft bg-white/4 px-3 py-2 text-xs font-semibold text-muted">
            {dataMode === "local"
              ? "Auth verificada con Supabase; los datos operativos de este panel siguen siendo demo locales."
              : "Auth verificada con Supabase; las mutaciones remotas no habilitadas fallan de forma cerrada."}
          </p>
        ) : null}
        {mode === "supabase" && dataMode === "supabase" && canPollOperationalOrders(activeRole) ? (
          <OperationalOrderAlerts
            role={activeRole}
            enabled
            ordersHref="/admin/pedidos"
          />
        ) : null}
        {children}
      </main>
      </div>
    </AdminRoleProvider>
  );
}
