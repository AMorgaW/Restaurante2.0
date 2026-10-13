import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DishImage } from "@/components/menu/dish-image";
import { FavoriteButton } from "@/components/menu/favorite-button";
import { FeaturedDishRow } from "@/components/menu/featured-dish-row";
import { FoodCardSkeleton } from "@/components/menu/food-card-skeleton";
import { HeroDishCard } from "@/components/menu/hero-dish-card";
import { MenuDishRow } from "@/components/menu/menu-dish-row";
import { PHOTO_REVEAL_PILOT_SLUG } from "@/lib/menu/photo-reveal-pilot";
import {
  GEOMETRIC_SLIDE_PILOT_SLUG,
  TIMED_SLIDE_PILOT_SLUG,
} from "@/lib/menu/slide-calibration-pilot";
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

beforeEach(() => {
  useCartStore.setState({ items: [] });
  useFavoritesStore.setState({ slugs: [] });
  window.localStorage.clear();
});

describe("MenuDishRow", () => {
  it("muestra nombre, categoría, precio y enlace con el nombre completo", () => {
    renderWithProviders(<MenuDishRow item={makeItem()} servicePeriod="dinner" />);
    expect(screen.getByRole("heading", { name: "Carne asada" })).toBeInTheDocument();
    expect(screen.getByText("Carnes")).toBeInTheDocument();
    expect(screen.getByText(/40\.000/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver Carne asada" })).toHaveAttribute(
      "href",
      "/plato/carne-asada",
    );
  });

  it("conserva el nombre COMPLETO de platos largos en datos y accesibilidad", () => {
    renderWithProviders(<MenuDishRow item={makeItem({ fullName: LONG_NAME, slug: "largo" })} />);
    const heading = screen.getByRole("heading", { name: LONG_NAME });
    expect(heading).toHaveClass("line-clamp-2");
    expect(screen.getByRole("link", { name: `Ver ${LONG_NAME}` })).toBeInTheDocument();
  });

  it("añade al carrito con la acción rápida (sin modificadores)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MenuDishRow item={makeItem()} servicePeriod="dinner" />);
    await user.click(screen.getByRole("button", { name: "Añadir Carne asada al carrito" }));
    expect(useCartStore.getState().items).toHaveLength(1);
    // Aparece el toast de confirmación
    expect(await screen.findByText("Añadido al carrito")).toBeInTheDocument();
  });

  it("no ofrece acción rápida cuando hay modificadores", () => {
    const item = makeItem({
      modifierGroups: [
        {
          id: "termino",
          name: "Término",
          required: true,
          minSelections: 1,
          maxSelections: 1,
          options: [{ id: "medio", name: "Medio", additionalPrice: 0, available: true }],
        },
      ],
    });
    renderWithProviders(<MenuDishRow item={item} />);
    expect(
      screen.queryByRole("button", { name: /añadir .* al carrito/i }),
    ).not.toBeInTheDocument();
  });

  it("en almuerzo aclara que la sopa se puede elegir", () => {
    renderWithProviders(<MenuDishRow item={makeItem()} servicePeriod="lunch" />);
    expect(screen.getByText("Puede llevar sopa")).toBeInTheDocument();
  });

  it("en cena no anuncia sopa en la tarjeta", () => {
    renderWithProviders(<MenuDishRow item={makeItem()} servicePeriod="dinner" />);
    expect(screen.queryByText("Puede llevar sopa")).not.toBeInTheDocument();
  });

  it("el piloto no monta el velo ni el reflejo hasta que la entrada está activa", () => {
    const { container } = renderWithProviders(
      <MenuDishRow item={makeItem({ slug: PHOTO_REVEAL_PILOT_SLUG, fullName: "Plato de carne asada" })} />,
    );
    const card = screen.getByTestId("menu-dish-row");
    const photo = container.querySelector(".menu-dish-photo");
    expect(card).toHaveAttribute("data-photo-reveal", "pilot");
    expect(screen.getByTestId("menu-card-rise")).not.toHaveAttribute("data-slide");
    expect(screen.getByTestId("menu-card-panel")).not.toHaveClass("menu-card-reflect-once");
    expect(screen.queryByTestId("menu-photo-veil")).not.toBeInTheDocument();
    expect(photo).toHaveStyle({ viewTransitionName: `dish-${PHOTO_REVEAL_PILOT_SLUG}` });
    expect(photo?.querySelector("[data-testid='menu-photo-veil']")).toBeNull();
  });

  it("separa la entrada geométrica de la de duración fija", () => {
    renderWithProviders(
      <MenuDishRow item={makeItem({ slug: GEOMETRIC_SLIDE_PILOT_SLUG, fullName: "Carne asada plato con cebolleta" })} />,
    );
    expect(screen.getByTestId("menu-card-rise")).toHaveAttribute("data-slide-calibration", "pilot");
    expect(screen.getByTestId("menu-card-rise")).not.toHaveAttribute("data-slide-timed");
    renderWithProviders(
      <MenuDishRow item={makeItem({ slug: TIMED_SLIDE_PILOT_SLUG, fullName: LONG_NAME })} />,
    );
    const timed = screen.getAllByTestId("menu-card-rise")[1];
    expect(timed).toHaveAttribute("data-slide-timed", "pilot");
    expect(timed).not.toHaveAttribute("data-slide-calibration");
    renderWithProviders(<MenuDishRow item={makeItem()} />);
    const normal = screen.getAllByTestId("menu-card-rise")[2];
    expect(normal).not.toHaveAttribute("data-slide-calibration");
    expect(normal).not.toHaveAttribute("data-slide-timed");
  });

  it("el velo del piloto queda fuera de la foto y no tapa el puntero", () => {
    const { container } = renderWithProviders(
      <MenuDishRow
        item={makeItem({ slug: PHOTO_REVEAL_PILOT_SLUG, fullName: "Plato de carne asada" })}
        photoReveal
      />,
    );
    const photo = container.querySelector(".menu-dish-photo");
    const veil = screen.getByTestId("menu-photo-veil");
    expect(photo?.contains(veil)).toBe(false);
    expect(photo?.parentElement?.contains(veil)).toBe(true);
    expect(veil).toHaveClass("pointer-events-none");
    expect(container.querySelectorAll("[data-testid='menu-photo-veil']")).toHaveLength(1);
  });

  it("una tarjeta normal no recibe el velo aunque la entrada esté activa", () => {
    renderWithProviders(
      <MenuDishRow item={makeItem({ slug: "bandeja-paisa", fullName: "Bandeja paisa" })} photoReveal />,
    );
    expect(screen.queryByTestId("menu-photo-veil")).not.toBeInTheDocument();
    expect(screen.getByTestId("menu-dish-row")).not.toHaveAttribute("data-photo-reveal");
    expect(screen.getByTestId("menu-card-rise")).not.toHaveAttribute("data-slide");
    expect(screen.getByTestId("menu-card-panel")).toHaveClass("menu-card-reflect-once");
  });

  it("muestra el estado agotado sin botón de añadir", () => {
    renderWithProviders(<MenuDishRow item={makeItem({ available: false })} />);
    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /añadir .* al carrito/i }),
    ).not.toBeInTheDocument();
  });
});

describe("HeroDishCard", () => {
  it("enlaza al detalle con el nombre completo y ofrece acción rápida", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HeroDishCard item={makeItem()} />);
    expect(screen.getByRole("link", { name: "Ver Carne asada" })).toHaveAttribute(
      "href",
      "/plato/carne-asada",
    );
    await user.click(screen.getByRole("button", { name: "Añadir Carne asada al carrito" }));
    expect(useCartStore.getState().items).toHaveLength(1);
  });
});

describe("FeaturedDishRow", () => {
  it("muestra nombre, precio, favorito y enlace accesible", () => {
    renderWithProviders(<FeaturedDishRow item={makeItem()} />);
    expect(screen.getByRole("heading", { name: "Carne asada" })).toBeInTheDocument();
    expect(screen.getByText(/40\.000/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver Carne asada" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Añadir Carne asada a favoritos" }),
    ).toBeInTheDocument();
  });
});

describe("FoodCardSkeleton", () => {
  it("se oculta de la accesibilidad (decorativo)", () => {
    const { container } = renderWithProviders(<FoodCardSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("FavoriteButton", () => {
  it("alterna el favorito con estado accesible", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FavoriteButton slug="carne-asada" name="Carne asada" />);
    const button = screen.getByRole("button", { name: "Añadir Carne asada a favoritos" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);
    expect(useFavoritesStore.getState().slugs).toContain("carne-asada");
    expect(
      await screen.findByRole("button", { name: "Quitar Carne asada de favoritos" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

describe("DishImage", () => {
  it("no esconde la fotografía descargada detrás de opacity 0", () => {
    const item = makeItem();
    renderWithProviders(
      <DishImage image={item.image} alt="Fotografía de Carne asada" sizes="100px" />,
    );
    const img = document.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.className ?? "").not.toContain("opacity-0");
  });

  it("muestra un fallback accesible si la imagen falla", () => {
    const item = makeItem();
    renderWithProviders(
      <DishImage image={item.image} alt="Fotografía de Carne asada" sizes="100px" />,
    );
    const img = document.querySelector("img");
    expect(img).not.toBeNull();
    if (img) fireEvent.error(img);
    expect(
      screen.getByRole("img", { name: "Imagen no disponible: Fotografía de Carne asada" }),
    ).toBeInTheDocument();
  });
});
