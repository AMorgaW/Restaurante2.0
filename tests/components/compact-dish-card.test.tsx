import { beforeEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { CompactDishCard } from "@/components/menu/compact-dish-card";
import { useCartStore } from "@/stores/cart";
import { useFavoritesStore } from "@/stores/favorites";
import type { MenuItem } from "@/types/menu";
import { renderWithProviders } from "./render";

const LONG_NAME =
  "Carne asada ternera a la parrilla con cebollas, jalapeño, frijoles, arroz, pico de gallo, guacamole, crema y lima";

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: "carne-asada",
    slug: "carne-asada",
    fullName: "Carne asada",
    categorySlug: "carnes",
    shortDescription: "De la casa",
    price: 40000,
    available: true,
    featured: false,
    tags: [],
    displayOrder: 0,
    image: {
      originalFilename: "carne.jpg",
      publicPath: "/generated/menu/carne-asada.jpg",
      width: 1129,
      height: 752,
      aspectRatio: 1.5,
      hasAlpha: false,
      blurDataURL: "data:image/webp;base64,x",
      bytes: 1,
    },
    modifierGroups: [],
    ...overrides,
  };
}

const soupGroup = {
  id: "included-lunch-soup",
  kind: "includedLunchSoup" as const,
  name: "Sopa incluida",
  required: false,
  minSelections: 0,
  maxSelections: 1,
  options: [{ id: "sopa", name: "Sopa de maíz", additionalPrice: 0, available: true }],
};

function mainItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return makeItem({ modifierGroups: [soupGroup], ...overrides });
}

beforeEach(() => {
  useCartStore.setState({ items: [] });
  useFavoritesStore.setState({ slugs: [] });
  window.localStorage.clear();
});

describe("CompactDishCard", () => {
  it("usa shortName en el título y reserva fullName para el enlace", () => {
    const { container } = renderWithProviders(
      <CompactDishCard
        item={mainItem({
          fullName: LONG_NAME,
          shortName: "Parrillada de ternera completa",
          slug: "ternera",
        })}
        servicePeriod="lunch"
      />,
    );
    const heading = container.querySelector("h3");
    expect(heading).toHaveTextContent("Parrillada de ternera completa");
    expect(heading).not.toHaveTextContent(LONG_NAME);
    expect(container.querySelector(`a[aria-label='Ver ${LONG_NAME}']`)).not.toBeNull();
    expect(container).toHaveTextContent(/40\.000/);
    expect(container.querySelector("[data-compact-photo]")).toHaveStyle({
      viewTransitionName: "dish-ternera",
    });
  });

  it("si no hay shortName, el título visible es el nombre completo", () => {
    const { container } = renderWithProviders(
      <CompactDishCard item={makeItem({ fullName: LONG_NAME, slug: "largo" })} servicePeriod="dinner" />,
    );
    expect(container.querySelector("h3")).toHaveTextContent(LONG_NAME);
    expect(container.querySelector(`a[aria-label='Ver ${LONG_NAME}']`)).not.toBeNull();
  });

  it("deja favorito y acción fuera del enlace de la tarjeta", () => {
    const { container } = renderWithProviders(
      <CompactDishCard item={makeItem()} servicePeriod="dinner" />,
    );
    const cardLink = container.querySelector("a[aria-label='Ver Carne asada']");
    const favorite = container.querySelector("button[aria-label='Añadir Carne asada a favoritos']");
    const add = container.querySelector("button[aria-label='Añadir Carne asada al carrito']");
    expect(cardLink).not.toBeNull();
    expect(favorite).not.toBeNull();
    expect(add).not.toBeNull();
    expect(cardLink?.contains(favorite)).toBe(false);
    expect(cardLink?.contains(add)).toBe(false);
    expect(favorite).toHaveClass("size-11");
    expect(add).toHaveClass("size-11");
  });

  it("reutiliza almuerzo, cena, cerrado y agotado", async () => {
    const user = userEvent.setup();
    const lunch = renderWithProviders(<CompactDishCard item={mainItem()} servicePeriod="lunch" />);
    expect(lunch.container).toHaveTextContent("Puede llevar sopa");
    expect(lunch.container.querySelector("a[aria-label='Elegir sopa para Carne asada']")).toHaveAttribute(
      "href",
      "/plato/carne-asada#sopa-incluida",
    );
    lunch.unmount();

    const dinner = renderWithProviders(<CompactDishCard item={makeItem()} servicePeriod="dinner" />);
    expect(dinner.container).not.toHaveTextContent("Puede llevar sopa");
    await user.click(dinner.container.querySelector("button[aria-label='Añadir Carne asada al carrito']")!);
    expect(useCartStore.getState().items).toHaveLength(1);
    dinner.unmount();

    const closed = renderWithProviders(<CompactDishCard item={makeItem()} servicePeriod="closed" />);
    expect(
      closed.container.querySelector(
        "button[aria-label='No se puede añadir Carne asada: el restaurante está cerrado']",
      ),
    ).toBeDisabled();
    closed.unmount();

    const soldOut = renderWithProviders(
      <CompactDishCard item={mainItem({ available: false })} servicePeriod="lunch" />,
    );
    expect(soldOut.container).toHaveTextContent("Agotado");
    expect(soldOut.container).not.toHaveTextContent("Puede llevar sopa");
    expect(soldOut.container.querySelector("button[aria-label='Añadir Carne asada al carrito']")).toBeNull();
    expect(soldOut.container.querySelector("a[aria-label^='Elegir sopa']")).toBeNull();

    const soup = renderWithProviders(
      <CompactDishCard item={makeItem({ categorySlug: "sopas", fullName: "Sopa de maíz" })} servicePeriod="lunch" />,
    );
    expect(soup.container).not.toHaveTextContent("Puede llevar sopa");
    expect(soup.container.querySelector("a[aria-label^='Elegir sopa']")).toBeNull();
  });
});
