import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { useReservationsStore } from "@/stores/reservations";
import { todayIso } from "@/lib/utils";
import { restaurantConfig } from "@/config/restaurant";
import { renderWithProviders } from "./render";

beforeEach(() => {
  useReservationsStore.setState({ reservations: [] });
  window.localStorage.clear();
  vi.restoreAllMocks();
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
