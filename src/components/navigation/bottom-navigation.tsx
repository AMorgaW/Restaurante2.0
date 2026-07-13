"use client";

import { CalendarClock, Home, Search, ShoppingBag, UtensilsCrossed } from "lucide-react";
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

/**
 * Navegación inferior móvil (se oculta en escritorio). Área táctil
 * amplia, etiquetas visibles, estado activo y badge del carrito.
 */
export function BottomNavigation() {
  const pathname = usePathname();
  const mounted = useMounted();
  const count = useCartStore((state) => cartItemCount(state.items));

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-soft bg-panel/95 backdrop-blur-sm md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 safe-bottom">
        {NAV_ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          const showBadge = item.href === "/carrito" && mounted && count > 0;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1 px-1 pt-2 pb-1.5",
                  "transition-colors duration-150",
                  active ? "text-action" : "text-muted hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon aria-hidden className="size-6" strokeWidth={active ? 2.4 : 2} />
                  {showBadge ? (
                    <span
                      aria-label={
                        count === 1 ? "1 producto en el carrito" : `${count} productos en el carrito`
                      }
                      className="absolute -right-2.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full bg-action px-1 text-[11px] font-extrabold leading-5 text-action-foreground"
                    >
                      {count > 9 ? "9+" : count}
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] font-semibold leading-none">{item.label}</span>
                <span
                  aria-hidden
                  className={cn(
                    "h-1 w-1 rounded-full transition-opacity",
                    active ? "bg-action opacity-100" : "opacity-0",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
