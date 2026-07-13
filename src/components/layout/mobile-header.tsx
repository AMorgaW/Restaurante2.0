"use client";

import { Heart, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/layout/brand-mark";
import { cartItemCount } from "@/features/cart/calculations";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";

const DESKTOP_LINKS = [
  { href: "/menu", label: "Menú" },
  { href: "/promociones", label: "Promociones" },
  { href: "/reservar", label: "Reservar" },
  { href: "/sucursales", label: "Sucursales" },
  { href: "/nosotros", label: "Nosotros" },
] as const;

/** Encabezado superior: marca, navegación de escritorio y accesos rápidos. */
export function MobileHeader() {
  const pathname = usePathname();
  const mounted = useMounted();
  const count = useCartStore((state) => cartItemCount(state.items));
  // En el home móvil el encabezado pertenece a la escena (HomeScreen pinta
  // monograma + favoritos + carrito integrados); aquí solo queda el header
  // de escritorio. El resto de rutas shell conservan el header pegajoso.
  const isHome = pathname === "/";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border-soft bg-background/90 backdrop-blur-sm safe-top",
        isHome && "hidden md:block",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
        <Link
          href="/"
          aria-label="Ir al inicio"
          className="rounded-xl transition-transform active:scale-[0.98] motion-reduce:active:scale-100"
        >
          <BrandMark size="sm" />
        </Link>

        <nav aria-label="Secciones" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {DESKTOP_LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                      active ? "bg-white/10 text-foreground" : "text-muted hover:text-foreground",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/favoritos"
            aria-label="Ver favoritos"
            className="inline-flex size-11 items-center justify-center rounded-full border border-border-soft bg-white/8 text-foreground transition-[background-color,transform] hover:bg-white/14 active:scale-[0.94] motion-reduce:active:scale-100"
          >
            <Heart aria-hidden className="size-5" />
          </Link>
          <Link
            href="/carrito"
            aria-label={
              mounted && count > 0 ? `Ver carrito (${count} productos)` : "Ver carrito"
            }
            className="relative hidden size-11 items-center justify-center rounded-full border border-border-soft bg-white/8 text-foreground transition-[background-color,transform] hover:bg-white/14 active:scale-[0.94] motion-reduce:active:scale-100 md:inline-flex"
          >
            <ShoppingBag aria-hidden className="size-5" />
            {mounted && count > 0 ? (
              <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-action px-1 text-[11px] font-extrabold leading-5 text-action-foreground">
                {count > 9 ? "9+" : count}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}
