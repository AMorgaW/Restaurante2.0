import { describe, expect, it } from "vitest";
import { filterMenuItems } from "@/features/menu/filtering";
import type { MenuItem } from "@/types/menu";

function makeItem(overrides: Partial<MenuItem>): MenuItem {
  return {
    id: overrides.slug ?? "x",
    slug: "x",
    fullName: "Plato",
    categorySlug: "especialidades",
    shortDescription: "",
    price: 10000,
    available: true,
    featured: false,
    tags: [],
    displayOrder: 0,
    image: {
      originalFilename: "x.jpg",
      publicPath: "/generated/menu/x.jpg",
      width: 100,
      height: 100,
      aspectRatio: 1,
      hasAlpha: false,
      blurDataURL: "data:image/webp;base64,x",
      bytes: 1,
    },
    modifierGroups: [],
    ...overrides,
  };
}

const items: MenuItem[] = [
  makeItem({ slug: "sopa", fullName: "Sopa de maíz", categorySlug: "sopas", price: 18000 }),
  makeItem({ slug: "carne", fullName: "Carne asada", categorySlug: "carnes", price: 45000 }),
  makeItem({
    slug: "arroz",
    fullName: "Arroz amarillo",
    categorySlug: "carnes",
    price: 30000,
    shortDescription: "Con frijoles de la casa",
    available: false,
  }),
];

describe("filterMenuItems", () => {
  it("busca sin tildes ni mayúsculas", () => {
    expect(filterMenuItems(items, { query: "MAIZ" })).toHaveLength(1);
    expect(filterMenuItems(items, { query: "maíz" })[0]?.slug).toBe("sopa");
  });

  it("busca en la descripción", () => {
    expect(filterMenuItems(items, { query: "frijoles" })[0]?.slug).toBe("arroz");
  });

  it("busca por nombre de categoría", () => {
    expect(filterMenuItems(items, { query: "sopas" })).toHaveLength(1);
  });

  it("filtra por categoría", () => {
    expect(filterMenuItems(items, { categorySlug: "carnes" })).toHaveLength(2);
  });

  it("combina categoría y búsqueda", () => {
    const result = filterMenuItems(items, { categorySlug: "carnes", query: "arroz" });
    expect(result.map((item) => item.slug)).toEqual(["arroz"]);
  });

  it("devuelve vacío sin coincidencias", () => {
    expect(filterMenuItems(items, { query: "pizza" })).toEqual([]);
  });

  it("ordena por precio ascendente y descendente", () => {
    expect(filterMenuItems(items, { sort: "precio-asc" }).map((item) => item.price)).toEqual([
      18000, 30000, 45000,
    ]);
    expect(filterMenuItems(items, { sort: "precio-desc" })[0]?.price).toBe(45000);
  });

  it("ordena por nombre con locale español", () => {
    expect(filterMenuItems(items, { sort: "nombre" }).map((item) => item.slug)).toEqual([
      "arroz",
      "carne",
      "sopa",
    ]);
  });

  it("puede excluir no disponibles", () => {
    expect(filterMenuItems(items, { onlyAvailable: true })).toHaveLength(2);
  });
});
