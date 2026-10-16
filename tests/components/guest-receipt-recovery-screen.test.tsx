import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuestReceiptRecoveryScreen } from "@/components/checkout/guest-receipt-recovery-screen";

const receipt = {
  orderNumber: "BS-1001",
  status: "confirmed",
  paymentStatus: "pending",
  paymentMethod: "demo",
  fulfillmentType: "pickup",
  branchName: "Sucursal Centro",
  currency: "COP",
  items: [{ name: "Plato snapshot", quantity: 1, modifiers: [{ groupName: "Sopa", optionName: "Snapshot", price: 0 }], total: 24000 }],
  subtotal: 24000,
  discount: 0,
  tax: 0,
  serviceFee: 0,
  deliveryFee: 0,
  tip: 0,
  total: 24000,
};

const validKey = "A".repeat(43);

describe("GuestReceiptRecoveryScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("no muestra la clave en el HTML inicial y limpia el campo tras una recuperación válida", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ receipt }), { status: 200 }));
    render(<GuestReceiptRecoveryScreen enabled />);
    expect(screen.queryByText(validKey)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Clave de recuperación"), { target: { value: validKey } });
    fireEvent.submit(screen.getByRole("button", { name: "Consultar comprobante" }).closest("form")!);
    await waitFor(() => expect(screen.getByText("Comprobante recuperado")).toBeInTheDocument());
    expect(screen.queryByLabelText("Clave de recuperación")).not.toBeInTheDocument();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/order-receipt", expect.objectContaining({ credentials: "omit" }));
    expect(screen.getByText("Demostración · sin cobro real")).toBeInTheDocument();
  });

  it("mantiene el error 404 neutral y limpia el secreto", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: "neutral" }), { status: 404 }));
    render(<GuestReceiptRecoveryScreen enabled />);
    fireEvent.change(screen.getByLabelText("Clave de recuperación"), { target: { value: validKey } });
    fireEvent.submit(screen.getByRole("button", { name: "Consultar comprobante" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No hay un comprobante disponible"));
    expect(screen.getByLabelText("Clave de recuperación")).toHaveValue("");
  });

  it("no ofrece el formulario cuando la capacidad está deshabilitada", () => {
    render(<GuestReceiptRecoveryScreen enabled={false} />);
    expect(screen.getByRole("heading", { name: "Recuperación temporalmente deshabilitada" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Clave de recuperación")).not.toBeInTheDocument();
  });

  it("no persiste resultado o clave en almacenamiento del navegador", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ receipt }), { status: 200 }));
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    render(<GuestReceiptRecoveryScreen enabled />);
    fireEvent.change(screen.getByLabelText("Clave de recuperación"), { target: { value: validKey } });
    fireEvent.submit(screen.getByRole("button", { name: "Consultar comprobante" }).closest("form")!);
    await waitFor(() => expect(screen.getByText("Comprobante recuperado")).toBeInTheDocument());
    expect(storageSpy).not.toHaveBeenCalled();
  });
});
