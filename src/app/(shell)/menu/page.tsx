import type { Metadata } from "next";
import { MenuExplorer } from "@/components/menu/menu-explorer";
import { JsonLd } from "@/components/seo/json-ld";
import { getCategoriesInUse, menuItems } from "@/data/menu";
import { menuJsonLd } from "@/lib/seo/structured-data";
import { siteUrl } from "@/lib/env/client";

export const metadata: Metadata = {
  title: "Menú",
  description:
    "Explora el menú completo: carnes a la brasa, sopas tradicionales y especialidades de la casa.",
  alternates: { canonical: `${siteUrl}/menu` },
};

export default function MenuPage() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-5 md:px-0">
      <JsonLd data={menuJsonLd(menuItems)} />
      <h1 className="text-screen-title font-extrabold tracking-tight">Menú</h1>
      <MenuExplorer items={menuItems} categories={getCategoriesInUse()} showSort />
    </div>
  );
}
