import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BottomNavigation } from "@/components/navigation/bottom-navigation";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { useCartStore } from "@/stores/cart";
import { useReservationsStore } from "@/stores/reservations";
import { todayIso } from "@/lib/utils";
import { restaurantConfig } from "@/config/restaurant";
import type { MenuItem } from "@/types/menu";
import { renderWithProviders } from "./render";

function makeItem(): MenuItem {
  return {
    id: "carne-asada",
    slug: "carne-asada",
    fullName: "Carne asada",
    categorySlug: "carnes",
    shortDescription: "",
    price: 40000,
    available: true,
    featured: false,
    tags: [],
    displayOrder: 0,
    image: {
      originalFilename: "carne.jpg",
      publicPath: "/generated/menu/carne-asada.jpg",
      width: 100,
      height: 100,
      aspectRatio: 1,
      hasAlpha: false,
      blurDataURL: "data:image/webp;base64,x",
      bytes: 1,
    },
    modifierGroups: [],
  };
}

beforeEach(() => {
  useCartStore.setState({ items: [] });
  useReservationsStore.setState({ reservations: [] });
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("BottomNavigation", () => {
  it("muestra los cinco destinos con el activo marcado", () => {
    renderWithProviders(<BottomNavigation />);
    const nav = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(nav).toBeInTheDocument();
    for (const label of ["Inicio", "Menú", "Buscar", "Reservar", "Carrito"]) {
      expect(screen.getByRole("link", { name: new RegExp(label, "i") })).toBeInTheDocument();
    }
    // usePathname está mockeado a "/" → Inicio activo
    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
  });

  it("muestra el badge con la cantidad del carrito tras montar", async () => {
    useCartStore.getState().addItem(makeItem(), { quantity: 3 });
    renderWithProviders(<BottomNavigation />);
    await waitFor(() => {
      expect(screen.getByLabelText("3 productos en el carrito")).toBeInTheDocument();
    });
  });

  it("permite previsualizar cada destino activo sin cambiar rutas", () => {
    renderWithProviders(<BottomNavigation activePathname="/reservar" previewCartCount={2} />);
    expect(screen.getByRole("link", { name: "Reservar" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current");
    expect(screen.getByLabelText("2 productos en el carrito")).toBeInTheDocument();
  });
});

describe("ReservationForm", () => {
  function tomorrowIso(): string {
    return todayIso(restaurantConfig.timezone, new Date(Date.now() + 24 * 60 * 60 * 1000));
  }

  it("muestra errores de validación accesibles al enviar vacío", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReservationForm />);

    await user.clear(screen.getByLabelText("Nombre completo"));
    await user.click(screen.getByRole("button", { name: /confirmar reserva/i }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
    expect(screen.getByText("Escribe tu nombre completo.")).toBeInTheDocument();
  });

  it("envía una reserva válida y la persiste en el store", async () => {
    const user = userEvent.setup();
    const reservation = {
      id: "res-1",
      branchId: "branch-centro",
      customerName: "Ana Pérez",
      phone: "+573001234567",
      email: "ana@example.com",
      date: tomorrowIso(),
      time: "12:30",
      partySize: 2,
      status: "confirmed",
      createdAt: new Date().toISOString(),
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reservation }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<ReservationForm />);

    await user.type(screen.getByLabelText("Nombre completo"), "Ana Pérez");
    await user.type(screen.getByLabelText("Teléfono"), "+57 300 123 4567");
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");

    const dateInput = screen.getByLabelText("Fecha");
    await user.clear(dateInput);
    await user.type(dateInput, tomorrowIso());
    await user.selectOptions(screen.getByLabelText("Hora"), "12:30");

    await user.click(screen.getByRole("button", { name: /confirmar reserva/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/reservations",
        expect.objectContaining({ method: "POST" }),
      );
    });
    await waitFor(() => {
      expect(useReservationsStore.getState().reservations).toHaveLength(1);
    });
  });

  it("muestra el error del servidor cuando la franja no está disponible", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "La hora seleccionada no está disponible; elige otra franja." }),
      }),
    );

    renderWithProviders(<ReservationForm />);
    await user.type(screen.getByLabelText("Nombre completo"), "Ana Pérez");
    await user.type(screen.getByLabelText("Teléfono"), "+57 300 123 4567");
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    const dateInput = screen.getByLabelText("Fecha");
    await user.clear(dateInput);
    await user.type(dateInput, tomorrowIso());
    await user.selectOptions(screen.getByLabelText("Hora"), "12:30");
    await user.click(screen.getByRole("button", { name: /confirmar reserva/i }));

    expect(
      await screen.findAllByText(/la hora seleccionada no está disponible/i),
    ).not.toHaveLength(0);
    expect(useReservationsStore.getState().reservations).toHaveLength(0);
  });
});
