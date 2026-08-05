import { DishesScreen } from "@/components/admin/dishes-screen";
import { getCategoriesInUse, menuItems } from "@/data/menu";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";

export const metadata = { title: "Platos" };

export default async function AdminDishesPage() {
  await authorizeAdminSection("catalog");
  return <DishesScreen items={menuItems} categories={getCategoriesInUse()} />;
}
