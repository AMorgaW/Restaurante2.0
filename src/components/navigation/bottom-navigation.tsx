"use client";

import { CalendarClock, Home, Search, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cartItemCount } from "@/features/cart/calculations";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: Home, exact: true },
  { href: "/menu", label: "Menú", icon: UtensilsCrossed, exact: false },
  { href: "/buscar", label: "Buscar", icon: Search, exact: false },
  { href: "/reservar", label: "Reservar", icon: CalendarClock, exact: false },
  { href: "/carrito", label: "Carrito", icon: ShoppingBag, exact: false },
] as const;

interface BottomNavigationProps {
  /** Solo para la vista previa aislada de /visual-lab. */
  activePathname?: string;
  /** Solo para la vista previa aislada de /visual-lab. */
  previewCartCount?: number;
  ariaLabel?: string;
}

/**
 * Navegación inferior móvil (se oculta en escritorio). Área táctil
 * amplia, etiquetas visibles, estado activo y badge del carrito.
 */
export function BottomNavigation({
  activePathname,
  previewCartCount,
  ariaLabel = "Navegación principal",
}: BottomNavigationProps) {
  const routerPathname = usePathname();
  const mounted = useMounted();
  const storeCount = useCartStore((state) => cartItemCount(state.items));
  const pathname = activePathname ?? routerPathname;
  const count = previewCartCount ?? storeCount;
  const reduced = useReducedMotion();

  return (
    <nav
      aria-label={ariaLabel}
      className="fixed inset-x-3 bottom-[calc(0.625rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg rounded-full border border-border-soft bg-panel/92 shadow-sheet backdrop-blur-sm md:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const showBadge = item.href === "/carrito" && (previewCartCount !== undefined || mounted) && count > 0;
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                data-testid={`bottom-nav-${item.href === "/" ? "home" : item.href.slice(1)}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1",
                  "transition-[color,transform] duration-150 active:scale-[0.96] motion-reduce:transition-colors motion-reduce:active:scale-100",
                  active ? "text-action-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {active ? (
                  <m.span
                    layoutId="bottom-nav-active-pill"
                    data-testid="bottom-nav-active-pill"
                    aria-hidden
                    transition={
                      reduced
                        ? { duration: 0.15 }
                        : { type: "spring", stiffness: 420, damping: 32, mass: 0.7 }
                    }
                    className="absolute inset-x-1 inset-y-1 rounded-full border border-action/70 bg-action shadow-[0_8px_18px_-12px_rgba(253,245,1,0.9)]"
                  />
                ) : null}
                <span className="relative flex size-6 items-center justify-center">
                  <Icon aria-hidden className="size-6" strokeWidth={active ? 2.35 : 2} />
                  {showBadge ? (
                    <span
                      aria-label={
                        count === 1 ? "1 producto en el carrito" : `${count} productos en el carrito`
                      }
                      className="absolute -right-2.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full border border-panel bg-foreground px-1 text-[11px] font-extrabold leading-5 text-background"
                    >
                      {count > 9 ? "9+" : count}
                    </span>
                  ) : null}
                </span>
                <span className="relative max-w-full truncate text-[10px] font-bold leading-3">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
