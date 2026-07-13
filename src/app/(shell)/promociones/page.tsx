import type { Metadata } from "next";
import { PromotionsScreen } from "@/components/promotions/promotions-screen";
import { siteUrl } from "@/lib/env/client";

export const metadata: Metadata = {
  title: "Promociones",
  description: "Cupones y promociones vigentes de la casa.",
  alternates: { canonical: `${siteUrl}/promociones` },
};

export default function PromotionsPage() {
  return <PromotionsScreen />;
}
