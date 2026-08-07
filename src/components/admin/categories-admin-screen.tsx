"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCategoryAction, updateCategoryAction } from "@/app/admin/catalog-actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { CategoryInfo } from "@/types/menu";

export function CategoriesAdminScreen({
  categories,
  itemCounts,
  mode,
}: {
  categories: Array<CategoryInfo & { isActive?: boolean }>;
  itemCounts: Record<string, number>;
  mode: "local" | "supabase";
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Categorías</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "local"
            ? "En modo local las categorías se infieren del menú demo. La reasignación permanente se hace en menu-overrides.ts."
            : "Activa, desactiva u ordena categorías en PostgreSQL. No se usa borrado físico (las referencias históricas dependen del slug)."}
        </p>
      </header>

      {mode === "supabase" ? (
        <form
          className="rounded-card border border-border-soft bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(() => {
              void (async () => {
                const result = await createCategoryAction({
                  name: name.trim(),
                  slug: slug.trim(),
                  description: "",
                  displayOrder: categories.length + 1,
                  isActive: true,
                });
                if (!result.ok) {
                  toast({ title: "No se pudo crear", description: result.message, variant: "error" });
                  return;
                }
                setName("");
                setSlug("");
                toast({ title: "Categoría creada", variant: "success" });
                router.refresh();
              })();
            });
          }}
        >
          <p className="text-sm font-bold">Nueva categoría</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="new-category-name" className="text-[13px] font-semibold text-muted">
                Nombre
              </label>
              <input
                id="new-category-name"
                required
                maxLength={80}
                value={name}
                disabled={pending}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-border-soft bg-white/6 px-3 text-sm outline-none focus:border-lime/60"
              />
            </div>
            <div>
              <label htmlFor="new-category-slug" className="text-[13px] font-semibold text-muted">
                Slug
              </label>
              <input
                id="new-category-slug"
                required
                maxLength={80}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                value={slug}
                disabled={pending}
                onChange={(event) => setSlug(event.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-border-soft bg-white/6 px-3 text-sm outline-none focus:border-lime/60"
              />
            </div>
          </div>
          <Button type="submit" size="sm" className="mt-3" disabled={pending}>
            Crear categoría
          </Button>
        </form>
      ) : null}

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {categories.map((category) => {
          const count = itemCounts[category.slug] ?? 0;
          const active = category.isActive !== false;
          return (
            <li
              key={category.slug}
              className={cn(
                "flex items-center justify-between gap-3 rounded-card border border-border-soft bg-surface p-4",
                !active && "opacity-70",
              )}
            >
              <div className="min-w-0">
                <p className="font-bold">{category.name}</p>
                <p className="text-[13px] text-muted">{category.description || "Sin descripción"}</p>
                <p className="mt-1 text-[12px] text-faint">
                  Orden: {category.displayOrder} · slug: {category.slug}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="rounded-full bg-lime/12 px-3 py-1.5 text-sm font-extrabold tabular-nums text-lime">
                  {count}
                </span>
                {mode === "supabase" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      startTransition(() => {
                        void (async () => {
                          const result = await updateCategoryAction({
                            slug: category.slug,
                            isActive: !active,
                          });
                          if (!result.ok) {
                            toast({
                              title: "No se pudo actualizar",
                              description: result.message,
                              variant: "error",
                            });
                            return;
                          }
                          toast({
                            title: active ? "Categoría desactivada" : "Categoría activada",
                            variant: "success",
                          });
                          router.refresh();
                        })();
                      });
                    }}
                  >
                    {active ? "Desactivar" : "Activar"}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
