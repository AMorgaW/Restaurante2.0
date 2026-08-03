"use client";

import { Heart, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import { UserEntryButton } from "@/components/navigation/user-entry-button";
import { cartItemCount } from "@/features/cart/calculations";
import { useMounted } from "@/hooks/use-mounted";
import { useCartStore } from "@/stores/cart";
import { cn } from "@/lib/utils";

let sessionMenuHeaderDone = false;

/** Encabezado contextual: sin destinos persistentes, con acciones comerciales. */
export function MobileHeader() {
  const mounted = useMounted();
  const pathname = usePathname();
  const reduced = useReducedMotion() ?? false;
  const [animateEntrance] = useState(() => pathname === "/menu" && !sessionMenuHeaderDone);
  const count = useCartStore((state) => cartItemCount(state.items));

  useEffect(() => {
    if (pathname === "/menu") sessionMenuHeaderDone = true;
  }, [pathname]);

  return (
    <header className={cn("sticky top-0 z-40 border-b border-border-soft bg-background/90 safe-top backdrop-blur-sm", animateEntrance && !reduced && "menu-header-enter")}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
        <Link href="/menu" aria-label="Ir al menú" className="rounded-xl transition-transform active:scale-[0.98] motion-reduce:active:scale-100">
          <BrandMark size="sm" />
        </Link>
        <div className="flex items-center gap-2">
          <UserEntryButton data-testid="menu-user-entry" />
          <Link href="/favoritos" aria-label="Ver favoritos" className="inline-flex size-11 items-center justify-center rounded-full border border-border-soft bg-white/8 text-foreground transition-[background-color,transform] hover:bg-white/14 active:scale-[0.94] motion-reduce:active:scale-100">
            <Heart aria-hidden className="size-5" />
          </Link>
          <Link href="/carrito" aria-label={mounted && count > 0 ? `Ver carrito (${count} productos)` : "Ver carrito"} className="relative inline-flex size-11 items-center justify-center rounded-full border border-border-soft bg-white/8 text-foreground transition-[background-color,transform] hover:bg-white/14 active:scale-[0.94] motion-reduce:active:scale-100">
            <ShoppingBag aria-hidden className="size-5" />
            {mounted && count > 0 ? <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-action px-1 text-[11px] font-extrabold leading-5 text-action-foreground">{count > 9 ? "9+" : count}</span> : null}
          </Link>
        </div>
      </div>
    </header>
  );
}
