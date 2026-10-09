import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { LunchSoupBanner } from "@/components/menu/lunch-soup-banner";
import { ServiceStatus } from "@/components/menu/service-status";
import { ProductDetailScreen } from "@/components/product/product-detail-screen";
import { createIncludedLunchSoupGroup } from "@/lib/menu/included-soups";
import { createServiceSnapshot } from "@/lib/menu/service-period";
import { useCartStore } from "@/stores/cart";
import type { MenuItem } from "@/types/menu";
import { renderWithProviders } from "./render";

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: "carne-asada",
    slug: "carne-asada",
    fullName: "Carne asada",
    categorySlug: "carnes",
    shortDescription: "Arroz, patacón, fríjol y verduras",
    price: 43_000,
    available: true,
    featured: false,
    tags: [],
    displayOrder: 10,
    image: {
      originalFilename: "carne.jpg",
      publicPath: "/generated/menu/carne.jpg",
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

const soup = makeItem({
  id: "sopa-real",
  slug: "sopa-real",
  fullName: "Sopa real del día",
  categorySlug: "sopas",
  price: 12_000,
});

function renderDetail(period: "lunch" | "dinner" | "closed", soups = [soup]) {
  const localHour = period === "lunch" ? "12:00:00" : period === "dinner" ? "18:00:00" : "23:00:00";
  const instant = new Date(`2026-07-21T${localHour}-05:00`);
  vi.setSystemTime(instant);
  const item = makeItem({ modifierGroups: [createIncludedLunchSoupGroup(soups)] });
  renderWithProviders(
    <ProductDetailScreen
      item={item}
      includedSoups={soups}
      initialServiceSnapshot={createServiceSnapshot(instant)}
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  useCartStore.setState({ items: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("estado visual del servicio", () => {
  it.each(["lunch", "dinner", "closed"] as const)("comunica %s sin controles falsos", (period) => {
    renderWithProviders(<ServiceStatus period={period} />);
    expect(screen.getByTestId("service-status")).toHaveAttribute("data-service-period", period);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("admite una lista vacía de sopas y distingue las porciones sueltas", () => {
    renderWithProviders(<LunchSoupBanner soups={[]} />);
    expect(screen.getByText("Hoy no hay sopa incluida. Puedes pedir el seco sin sopa.")).toBeInTheDocument();
    expect(screen.getByTestId("separate-portions-note")).toHaveAttribute("data-flexible-orders", "pending");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("detalle dependiente del servicio", () => {
  it("en almuerzo selecciona por defecto la primera sopa y permite Sin sopa", () => {
    renderDetail("lunch");
    expect(screen.getByRole("radio", { name: "Sopa real del día" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Sin sopa" }));
    expect(screen.getByRole("radio", { name: "Sin sopa" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("detail-order-summary")).toHaveTextContent("Sin sopa");
  });

  it("si no hay sopa disponible selecciona Sin sopa", () => {
    renderDetail("lunch", []);
    expect(screen.getByRole("radio", { name: "Sin sopa" })).toHaveAttribute("aria-checked", "true");
  });

  it("en cena no muestra sopa y añade sin modificadores", () => {
    renderDetail("dinner");
    expect(screen.queryByTestId("included-soup-selector")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Añadir al carrito" }));
    expect(useCartStore.getState().items[0]?.modifiers).toEqual([]);
  });

  it("cerrado bloquea nuevas adiciones", () => {
    renderDetail("closed");
    expect(screen.getByRole("button", { name: "Cerrado" })).toBeDisabled();
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("no presenta término, notas ni relacionados", () => {
    renderDetail("lunch");
    expect(screen.queryByText(/término de la carne/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/notas para la cocina/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/también te puede gustar/i)).not.toBeInTheDocument();
  });
});
