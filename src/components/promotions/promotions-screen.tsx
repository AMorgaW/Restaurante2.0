"use client";

import { Copy, Sparkles } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { promotions } from "@/config/restaurant";

/** Promociones activas configuradas centralmente. */
export function PromotionsScreen() {
  const router = useTransitionRouter();
  const { toast } = useToast();
  const active = promotions.filter((promotion) => promotion.active);

  const copyCoupon = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({
        title: "Cupón copiado",
        description: `Aplica ${code} en el carrito antes de pagar.`,
        variant: "success",
      });
    } catch {
      toast({
        title: `Cupón: ${code}`,
        description: "Escríbelo en el campo de cupón del carrito.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 md:px-0">
      <h1 className="text-screen-title font-extrabold tracking-tight">Promociones</h1>
      {active.length === 0 ? (
        <EmptyState
          title="No hay promociones activas"
          description="Vuelve pronto: renovamos nuestras ofertas con frecuencia."
          action={
            <Button size="md" onClick={() => router.push("/menu")}>
              Ver el menú
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {active.map((promotion) => (
            <li
              key={promotion.id}
              className="flex flex-col gap-3 rounded-card border border-border-soft bg-gradient-to-br from-surface to-surface-elevated p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <Sparkles aria-hidden className="size-6 text-action" />
                <Badge variant="action">{promotion.badge}</Badge>
              </div>
              <h2 className="text-xl font-extrabold text-balance">{promotion.title}</h2>
              <p className="text-sm leading-relaxed text-muted">{promotion.description}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                {promotion.couponCode ? (
                  <Button size="md" onClick={() => copyCoupon(promotion.couponCode ?? "")}>
                    <Copy aria-hidden className="size-4" />
                    Copiar {promotion.couponCode}
                  </Button>
                ) : null}
                <Button size="md" variant="secondary" onClick={() => router.push("/menu")}>
                  Ver el menú
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
