import type { Metadata } from "next";
import { MenuExplorer } from "@/components/menu/menu-explorer";
import { JsonLd } from "@/components/seo/json-ld";
import { getCategoriesInUse, menuItems } from "@/data/menu";
import { menuJsonLd } from "@/lib/seo/structured-data";
import { siteUrl } from "@/lib/env/client";
import { createServiceSnapshot } from "@/lib/menu/service-period";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Menú",
  description:
    "Explora el menú completo: carnes a la brasa, sopas tradicionales y especialidades de la casa.",
  alternates: { canonical: `${siteUrl}/menu` },
};

export default function MenuPage() {
  const initialServiceSnapshot = createServiceSnapshot(new Date());
  return (
    <div className="flex flex-col gap-4 px-4 pb-8 pt-4 md:px-0 md:pt-7">
      <JsonLd data={menuJsonLd(menuItems)} />
      <MenuExplorer
        items={menuItems}
        categories={getCategoriesInUse()}
        initialServiceSnapshot={initialServiceSnapshot}
        showSort
        title="Menú"
      />
    </div>
  );
}
