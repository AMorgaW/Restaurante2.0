import { Badge } from "@/components/ui/badge";
import { coupons, promotions } from "@/config/restaurant";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";

export const metadata = { title: "Promociones" };

/**
 * Promociones y cupones configurados centralmente. En producción se
 * administran en las tablas `promotions` y `coupons` de Supabase.
 */
export default async function AdminPromotionsPage() {
  await authorizeAdminSection("marketing");
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Promociones y cupones</h1>
        <p className="mt-1 text-sm text-muted">
          Se editan en <code className="rounded bg-white/8 px-1.5 py-0.5 text-[12px]">src/config/restaurant.ts</code>{" "}
          (demo) o en Supabase (producción). Los cupones se validan y aplican en el servidor al
          calcular el pedido.
        </p>
      </header>

      <section aria-labelledby="promos-admin" className="flex flex-col gap-3">
        <h2 id="promos-admin" className="text-lg font-bold">
          Promociones
        </h2>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {promotions.map((promotion) => (
            <li key={promotion.id} className="rounded-card border border-border-soft bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-balance">{promotion.title}</p>
                <Badge variant={promotion.active ? "success" : "muted"}>
                  {promotion.active ? "Activa" : "Inactiva"}
                </Badge>
              </div>
              <p className="mt-1 text-[13px] text-muted">{promotion.description}</p>
              {promotion.couponCode ? (
                <p className="mt-2 text-[13px] font-bold text-lime">
                  Cupón asociado: {promotion.couponCode}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cupones-admin" className="flex flex-col gap-3">
        <h2 id="cupones-admin" className="text-lg font-bold">
          Cupones
        </h2>
        <ul className="flex flex-col gap-2">
          {coupons.map((coupon) => (
            <li
              key={coupon.code}
              className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border-soft bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-mono font-bold">{coupon.code}</p>
                <p className="text-[13px] text-muted">{coupon.description}</p>
              </div>
              <Badge variant={coupon.active ? "success" : "muted"}>
                {coupon.type === "percent" ? `${coupon.value}%` : `−${coupon.value}`}
                {coupon.active ? " · Activo" : " · Inactivo"}
              </Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
