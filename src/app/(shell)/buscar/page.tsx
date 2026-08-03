import type { Metadata } from "next";
import { MenuExplorer } from "@/components/menu/menu-explorer";
import { getCategoriesInUse, menuItems } from "@/data/menu";
import { siteUrl } from "@/lib/env/client";
import { createServiceSnapshot } from "@/lib/menu/service-period";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buscar",
  description: "Busca platos por nombre, descripción o categoría.",
  alternates: { canonical: `${siteUrl}/buscar` },
};

export default function SearchPage() {
  const initialServiceSnapshot = createServiceSnapshot(new Date());
  return (
    <div className="flex flex-col gap-4 px-4 pt-5 md:px-0">
      <h1 className="text-screen-title font-extrabold tracking-tight">Buscar</h1>
      <p className="-mt-2 text-sm text-muted">
        Encuentra tu plato por nombre, ingrediente del título o categoría.
      </p>
      <MenuExplorer
        items={menuItems}
        categories={getCategoriesInUse()}
        initialServiceSnapshot={initialServiceSnapshot}
        showSort
      />
    </div>
  );
}
