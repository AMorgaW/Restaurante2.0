import { renderWithProviders } from "./render";
import { OrderConfirmationScreen } from "@/components/checkout/order-confirmation-screen";
import {
  clearGuestReceiptAttemptStorageForTests,
  markGuestReceiptAttemptConfirmed,
  markGuestReceiptAttemptUncertain,
  prepareGuestReceiptAttempt,
} from "@/features/checkout/guest-receipt-attempt";
import { useOrdersStore } from "@/stores/orders";
import type { Order } from "@/types/order";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-confirmation-test",
    orderNumber: "CB-TEST-1234",
    branchId: "branch-centro",
    status: "pending",
    paymentStatus: "pending",
    paymentMethod: "demo",
    fulfillmentType: "pickup",
    items: [
      {
        itemId: "dish-1",
        slug: "dish-1",
        nameSnapshot: "Arroz de coco con pescado",
        unitPrice: 42000,
        quantity: 2,
        modifiers: [
          {
            groupId: "included-lunch-soup",
            groupName: "Sopa incluida",
            optionId: "soup-1",
            optionName: "Sopa de pescado",
            priceSnapshot: 0,
          },
          {
            groupId: "side",
            groupName: "Acompañante",
            optionId: "patacon",
            optionName: "Patacón",
            priceSnapshot: 2500,
          },
        ],
        notes: "Sin cilantro",
        total: 84500,
      },
    ],
    totals: {
      subtotal: 84500,
      discount: 5000,
      tax: 6360,
      serviceFee: 0,
      deliveryFee: 0,
      tip: 0,
      total: 85860,
    },
    currency: "COP",
    customer: { name: "Ana Pérez", phone: "+57 300 123 4567", email: "ana@example.com" },
    notes: "Llamar al llegar",
    createdAt: "2026-10-14T12:00:00.000Z",
    ...overrides,
  };
}

describe("OrderConfirmationScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearGuestReceiptAttemptStorageForTests();
    useOrdersStore.setState({ orders: [] });
  });

  it("distingue un pedido pendiente y presenta todos los datos del recibo", async () => {
    useOrdersStore.getState().addOrder(createOrder());
    renderWithProviders(<OrderConfirmationScreen orderId="order-confirmation-test" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Pedido recibido" })).toBeVisible());
    expect(screen.getByText("Pendiente")).toBeVisible();
    expect(screen.getByText("Demostración · sin cobro real")).toBeVisible();
    expect(screen.getByText(/se conserva solo en este navegador/i)).toBeVisible();
    expect(screen.queryByText("Pagado (demostración)")).not.toBeInTheDocument();
    expect(screen.getByText("2 ×")).toBeVisible();
    expect(screen.getByText("Arroz de coco con pescado")).toBeVisible();
    expect(screen.getByText("Sopa incluida: Sopa de pescado · COP 0")).toBeVisible();
    expect(screen.getByText("Acompañante: Patacón")).toBeVisible();
    expect(screen.getByText("“Sin cilantro”")).toBeVisible();
    expect(screen.getByText("Nota del pedido:")).toBeVisible();
    expect(screen.getByText("Total", { exact: true })).toBeVisible();
  });

  it("muestra el significado real de confirmado y la opción Sin sopa", async () => {
    useOrdersStore.getState().addOrder(
      createOrder({
        status: "confirmed",
        items: [
          {
            ...createOrder().items[0]!,
            modifiers: [
              {
                groupId: "included-lunch-soup",
                groupName: "Sopa incluida",
                optionId: "no-soup",
                optionName: "Sin sopa",
                priceSnapshot: 0,
              },
            ],
          },
        ],
      }),
    );
    renderWithProviders(<OrderConfirmationScreen orderId="order-confirmation-test" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Pedido confirmado" })).toBeVisible());
    expect(screen.getByText("Confirmado")).toBeVisible();
    expect(screen.getByText("Sin sopa · COP 0")).toBeVisible();
  });

  it("revela y copia la clave solo después de una acción explícita", async () => {
    const orderId = "99999999-9999-4999-8999-999999999999";
    const attempt = await prepareGuestReceiptAttempt({
      branchId: "branch-centro",
      fulfillmentType: "pickup",
      customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
      items: [{ slug: "carne-asada", quantity: 1, notes: "", modifiers: [] }],
      tipPercent: 0,
      notes: "",
    });
    markGuestReceiptAttemptUncertain(attempt);
    markGuestReceiptAttemptConfirmed(attempt, orderId);
    useOrdersStore.getState().addOrder(createOrder({ id: orderId }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    renderWithProviders(
      <OrderConfirmationScreen orderId={orderId} guestReceiptRecoveryEnabled />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Mostrar clave" })).toBeVisible());
    expect(screen.queryByText(attempt.receiptKey)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar clave" }));
    expect(screen.getByText(attempt.receiptKey)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Copiar clave" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(attempt.receiptKey));
    await waitFor(() => expect(screen.getByText("Clave copiada. Guárdala fuera del navegador.")).toBeVisible());
  });

  it("gestiona varias credenciales con handles efímeros y cambia la clave seleccionada", async () => {
    const firstOrderId = "12121212-1212-4121-8121-121212121212";
    const secondOrderId = "23232323-2323-4232-8232-232323232323";
    const commercialPayload = {
      branchId: "branch-centro",
      fulfillmentType: "pickup" as const,
      customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
      items: [{ slug: "carne-asada", quantity: 1, notes: "", modifiers: [] }],
      tipPercent: 0,
      notes: "",
    };
    const first = await prepareGuestReceiptAttempt({ ...commercialPayload, notes: "primera" });
    markGuestReceiptAttemptUncertain(first);
    markGuestReceiptAttemptConfirmed(first, firstOrderId);
    const second = await prepareGuestReceiptAttempt({ ...commercialPayload, notes: "segunda" });
    markGuestReceiptAttemptUncertain(second);
    markGuestReceiptAttemptConfirmed(second, secondOrderId);
    useOrdersStore.getState().addOrder(createOrder({ id: firstOrderId, orderNumber: "CB-FIRST" }));
    useOrdersStore.getState().addOrder(createOrder({ id: secondOrderId, orderNumber: "CB-SECOND" }));

    renderWithProviders(
      <OrderConfirmationScreen orderId={firstOrderId} guestReceiptRecoveryEnabled />,
    );
    const selector = await waitFor(() => screen.getByRole("combobox", { name: "Comprobantes guardados en esta sesión" }));
    const select = selector as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((option) => option.value);
    expect(optionValues).toHaveLength(2);
    expect(optionValues.every((value) => /^receipt-\d+$/.test(value))).toBe(true);
    expect(select.outerHTML).not.toContain(firstOrderId);
    expect(select.outerHTML).not.toContain(secondOrderId);
    expect(select.outerHTML).not.toContain(first.receiptKey);
    expect(select.outerHTML).not.toContain(second.receiptKey);
    expect(select).toHaveTextContent("CB-FIRST");
    expect(select).toHaveTextContent("CB-SECOND");

    const secondHandle = Array.from(select.options).find((option) => option.textContent?.includes("CB-SECOND"))?.value;
    expect(secondHandle).toMatch(/^receipt-\d+$/);
    fireEvent.change(select, { target: { value: secondHandle } });
    expect(screen.queryByText(second.receiptKey)).not.toBeInTheDocument();
    expect(screen.queryByText(first.receiptKey)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar clave" }));
    await waitFor(() => expect(screen.getByText(second.receiptKey)).toBeVisible());
    expect(screen.queryByText(first.receiptKey)).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: "receipt-obsolete" } });
    expect(screen.queryByRole("button", { name: "Mostrar clave" })).not.toBeInTheDocument();
  });

  it("oculta la tarjeta cuando la capacidad no está habilitada", async () => {
    const orderId = "34343434-3434-4343-8343-343434343434";
    const attempt = await prepareGuestReceiptAttempt({
      branchId: "branch-centro",
      fulfillmentType: "pickup",
      customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
      items: [{ slug: "carne-asada", quantity: 1, notes: "", modifiers: [] }],
      tipPercent: 0,
      notes: "",
    });
    markGuestReceiptAttemptUncertain(attempt);
    markGuestReceiptAttemptConfirmed(attempt, orderId);
    useOrdersStore.getState().addOrder(createOrder({ id: orderId }));

    renderWithProviders(<OrderConfirmationScreen orderId={orderId} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Pedido recibido" })).toBeVisible());
    expect(screen.queryByRole("region", { name: "Clave de recuperación del comprobante" })).not.toBeInTheDocument();
  });

  it("reconoce y elimina solo la copia local después de confirmación explícita", async () => {
    const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const attempt = await prepareGuestReceiptAttempt({
      branchId: "branch-centro",
      fulfillmentType: "pickup",
      customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
      items: [{ slug: "carne-asada", quantity: 1, notes: "", modifiers: [] }],
      tipPercent: 0,
      notes: "",
    });
    markGuestReceiptAttemptUncertain(attempt);
    markGuestReceiptAttemptConfirmed(attempt, orderId);
    useOrdersStore.getState().addOrder(createOrder({ id: orderId }));

    renderWithProviders(
      <OrderConfirmationScreen orderId={orderId} guestReceiptRecoveryEnabled />,
    );
    await waitFor(() => fireEvent.click(screen.getByRole("button", { name: "Mostrar clave" })));
    fireEvent.click(screen.getByRole("button", { name: "Ya guardé mi clave" }));
    expect(sessionStorage.getItem("rb-checkout-receipt-attempts")).toContain("acknowledgedAt");
    fireEvent.click(screen.getByRole("button", { name: "Eliminar clave de este navegador" }));
    expect(screen.getByRole("button", { name: "Mantener copia" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar de este navegador" }));
    await waitFor(() => expect(sessionStorage.getItem("rb-checkout-receipt-attempts")).toContain('"confirmed":[]'));
  });

  it("informa un fallo de Clipboard API sin afirmar que copió la clave", async () => {
    const orderId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const attempt = await prepareGuestReceiptAttempt({
      branchId: "branch-centro",
      fulfillmentType: "pickup",
      customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
      items: [{ slug: "carne-asada", quantity: 1, notes: "", modifiers: [] }],
      tipPercent: 0,
      notes: "",
    });
    markGuestReceiptAttemptUncertain(attempt);
    markGuestReceiptAttemptConfirmed(attempt, orderId);
    useOrdersStore.getState().addOrder(createOrder({ id: orderId }));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("clipboard blocked")) },
    });

    renderWithProviders(
      <OrderConfirmationScreen orderId={orderId} guestReceiptRecoveryEnabled />,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Mostrar clave" })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Mostrar clave" }));
    fireEvent.click(screen.getByRole("button", { name: "Copiar clave" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("copia automática falló"),
    );
    expect(screen.queryByText("No pudimos copiarla automáticamente. Selecciónala y cópiala manualmente.")).not.toBeInTheDocument();
    expect(screen.queryByText("Clave copiada. Guárdala fuera del navegador.")).not.toBeInTheDocument();
  });

  it("presenta domicilio y mesa QR sin exponer el token", async () => {
    useOrdersStore.getState().addOrder(
      createOrder({
        fulfillmentType: "delivery",
        address: { street: "Calle 10 # 5-51", details: "Apto 3", neighborhood: "Centro" },
        tableQrToken: "no-mostrar-este-token",
      }),
    );
    renderWithProviders(<OrderConfirmationScreen orderId="order-confirmation-test" />);

    await waitFor(() => expect(screen.getAllByText("Domicilio", { exact: true })[0]).toBeVisible());
    expect(screen.getByText("Calle 10 # 5-51")).toBeVisible();
    expect(screen.queryByText("no-mostrar-este-token")).not.toBeInTheDocument();
  });

  it("etiqueta mesa mediante QR sin inventar un número de mesa", async () => {
    useOrdersStore.getState().addOrder(createOrder({ fulfillmentType: "local", tableSessionId: "session-1" }));
    renderWithProviders(<OrderConfirmationScreen orderId="order-confirmation-test" />);

    await waitFor(() => expect(screen.getByText("Mesa mediante QR", { exact: true })).toBeVisible());
    expect(screen.getByText("Pedido en mesa")).toBeVisible();
    expect(screen.queryByText(/Mesa\s+\d+/i)).not.toBeInTheDocument();
  });

  it("usa un estado neutral cuando no hay copia local y no consulta el servidor", async () => {
    renderWithProviders(<OrderConfirmationScreen orderId="missing-order" />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "No hay un comprobante guardado en este navegador para este enlace",
        }),
      ).toBeVisible(),
    );
    expect(screen.getByText(/no confirma ni descarta/i)).toBeVisible();
    expect(screen.queryByText("Pedido no encontrado")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver al menú" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Volver al inicio" })).toBeVisible();
  });

  it("elimina tokens QR heredados al guardar y al persistir el comprobante", () => {
    useOrdersStore.getState().addOrder({ ...createOrder(), tableQrToken: "no-persistir-este-token" });

    const stored = window.localStorage.getItem("rb-orders");
    expect(useOrdersStore.getState().orders[0]).not.toHaveProperty("tableQrToken");
    expect(stored).not.toContain("no-persistir-este-token");
    expect(stored).not.toContain("tableQrToken");
  });

  it("migra registros rb-orders v1 sin dejar el token QR en la copia local", async () => {
    window.localStorage.setItem(
      "rb-orders",
      JSON.stringify({
        state: { orders: [{ ...createOrder(), tableQrToken: "legacy-secret" }] },
        version: 1,
      }),
    );
    await useOrdersStore.persist.rehydrate();

    expect(useOrdersStore.getState().orders[0]).not.toHaveProperty("tableQrToken");
    expect(window.localStorage.getItem("rb-orders")).not.toContain("legacy-secret");
  });
});
