import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoriesInUse, getFeaturedItems, menuItems } from "@/data/menu";
import { VisualLabClient } from "./lab-client";

/**
 * Laboratorio visual de desarrollo: reproduce cada escena animada de forma
 * determinista (sin depender de primera visita ni de borrar localStorage)
 * para compararla contra el video de referencia y generar capturas y
 * grabaciones repetibles.
 *
 * - No se indexa (robots noindex) ni aparece en sitemap.ts.
 * - No expone datos que no sean ya públicos (el menú demo).
 * - Puede deshabilitarse en un despliegue real con VISUAL_LAB_DISABLED=1.
 */
export const metadata: Metadata = {
  title: "Visual Lab (desarrollo)",
  robots: { index: false, follow: false, nocache: true },
};

export default function VisualLabPage() {
  if (process.env.VISUAL_LAB_DISABLED === "1") {
    notFound();
  }
  return (
    <VisualLabClient
      items={menuItems}
      categories={getCategoriesInUse()}
      featured={getFeaturedItems()}
    />
  );
}
