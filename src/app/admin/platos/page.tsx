import { DishesScreen } from "@/components/admin/dishes-screen";
import { getCategoriesInUse, menuItems } from "@/data/menu";

export const metadata = { title: "Platos" };

export default function AdminDishesPage() {
  return <DishesScreen items={menuItems} categories={getCategoriesInUse()} />;
}
