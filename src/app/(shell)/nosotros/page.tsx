import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { restaurantConfig } from "@/config/restaurant";
import { siteUrl } from "@/lib/env/client";
import { loadPublicCatalog } from "@/server/catalog/load-public-catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nosotros",
  description: `Conoce ${restaurantConfig.name}: ${restaurantConfig.tagline}.`,
  alternates: { canonical: `${siteUrl}/nosotros` },
};

export default async function AboutPage() {
  let hero: {
    fullName: string;
    image: { publicPath: string; blurDataURL: string; width: number; height: number };
  } | null = null;
  try {
    const catalog = await loadPublicCatalog();
    const featured = catalog.items.find((item) => item.featured) ?? catalog.items[0];
    if (featured) hero = featured;
  } catch {
    hero = null;
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-5 pb-6 md:px-0">
      <h1 className="text-screen-title font-extrabold tracking-tight">Nosotros</h1>

      {hero ? (
        <div className="relative aspect-[16/9] overflow-hidden rounded-card border border-border-soft shadow-card">
          <Image
            src={hero.image.publicPath}
            alt={`Fotografía de ${hero.fullName}`}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            placeholder={hero.image.blurDataURL ? "blur" : "empty"}
            {...(hero.image.blurDataURL ? { blurDataURL: hero.image.blurDataURL } : {})}
            className="object-cover"
            priority
          />
        </div>
      ) : null}

      <section className="flex flex-col gap-3 text-[15px] leading-relaxed text-muted">
        <p>
          <strong className="text-foreground">{restaurantConfig.name}</strong> nace del amor por la
          brasa: carnes seleccionadas, sopas de la casa y acompañamientos preparados al momento,
          servidos con la calidez de la cocina de siempre.
        </p>
        <p>
          Nuestro compromiso es simple: producto fresco, cocción honesta y un servicio que te haga
          sentir en casa. Cada plato del menú proviene de nuestra propia cocina y se fotografía tal
          como llega a tu mesa.
        </p>
        <p className="rounded-2xl border border-border-soft bg-white/4 px-4 py-3 text-[13px]">
          Este texto es contenido de demostración editable; el restaurante debe reemplazarlo por su
          historia real antes de publicar.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/menu"
          className="inline-flex h-12 items-center justify-center rounded-button bg-action px-6 text-[15px] font-bold text-action-foreground shadow-glow transition-[transform,filter] hover:brightness-95 active:scale-[0.98] motion-reduce:active:scale-100"
        >
          Explorar el menú
        </Link>
        <Link
          href="/sucursales"
          className="inline-flex h-12 items-center justify-center rounded-button border border-border-soft bg-surface-elevated px-6 text-[15px] font-semibold text-foreground transition-[border-color,transform] hover:border-border-strong active:scale-[0.98] motion-reduce:active:scale-100"
        >
          Nuestras sucursales
        </Link>
      </div>
    </div>
  );
}
