import type { Metadata } from "next";
import { FavoritesScreen } from "@/components/menu/favorites-screen";
import { menuItems } from "@/data/menu";

export const metadata: Metadata = {
  title: "Favoritos",
  description: "Tus platos guardados.",
  robots: { index: false },
};

export default function FavoritesPage() {
  return <FavoritesScreen items={menuItems} />;
}
