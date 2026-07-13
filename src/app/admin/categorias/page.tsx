import { getCategoriesInUse, getItemsByCategory } from "@/data/menu";

export const metadata = { title: "Categorías" };

/**
 * Categorías derivadas automáticamente de los nombres de archivo.
 * La reasignación se hace en src/data/menu-overrides.ts (documentado) o
 * en la tabla `categories` de Supabase en producción.
 */
export default function AdminCategoriesPage() {
  const categories = getCategoriesInUse();

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Categorías</h1>
        <p className="mt-1 text-sm text-muted">
          Se infieren del nombre de cada imagen con reglas conservadoras. Para corregir la
          categoría de un plato, edita <code className="rounded bg-white/8 px-1.5 py-0.5 text-[12px]">src/data/menu-overrides.ts</code>{" "}
          (campo <code className="rounded bg-white/8 px-1.5 py-0.5 text-[12px]">categorySlug</code>) y en producción la tabla{" "}
          <code className="rounded bg-white/8 px-1.5 py-0.5 text-[12px]">categories</code> de Supabase.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {categories.map((category) => {
          const items = getItemsByCategory(category.slug);
          return (
            <li
              key={category.slug}
              className="flex items-center justify-between gap-3 rounded-card border border-border-soft bg-surface p-4"
            >
              <div className="min-w-0">
                <p className="font-bold">{category.name}</p>
                <p className="text-[13px] text-muted">{category.description}</p>
                <p className="mt-1 text-[12px] text-faint">Orden: {category.displayOrder}</p>
              </div>
              <span className="shrink-0 rounded-full bg-lime/12 px-3 py-1.5 text-sm font-extrabold tabular-nums text-lime">
                {items.length}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
