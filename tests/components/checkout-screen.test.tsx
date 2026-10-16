import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutScreen } from "@/components/checkout/checkout-screen";
import {
  clearGuestReceiptAttemptStorageForTests,
  GUEST_RECEIPT_ATTEMPT_STORAGE_KEY,
  generateReceiptKey,
} from "@/features/checkout/guest-receipt-attempt";
import { useCartStore } from "@/stores/cart";
import { useTableContextStore } from "@/stores/table-context";
import { renderWithProviders } from "./render";
import type { CartItem } from "@/types/order";

const harness = vi.hoisted(() => ({
  placeOrderRequest: vi.fn(),
}));

vi.mock("@/features/checkout/place-order", () => ({
  placeOrderRequest: harness.placeOrderRequest,
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));

const checkoutItem: CartItem = {
  lineId: "carne-asada-included-soup",
  itemId: "carne-asada",
  slug: "carne-asada",
  nameSnapshot: "Carne asada del Sinú",
  unitPriceSnapshot: 32_000,
  quantity: 2,
  notes: "Sin cebolla, por favor",
  modifiers: [
    {
      groupId: "included-lunch-soup",
      groupName: "Sopa incluida",
      optionId: "sopa-del-dia",
      optionName: "Sopa de mondongo",
      priceSnapshot: 0,
    },
    {
      groupId: "acompanante",
      groupName: "Acompañante",
      optionId: "patacon",
      optionName: "Patacón",
      priceSnapshot: 2_000,
    },
  ],
  imagePath: "/generated/menu/carne.jpg",
};

async function renderCheckout(
  item: CartItem = checkoutItem,
  guestReceiptRecoveryEnabled = false,
  publicOrderIntakeEnabled = true,
) {
  useCartStore.setState({
    items: [item],
    branchId: "branch-centro",
    fulfillmentType: "pickup",
    couponCode: null,
    tipPercent: 0,
  });
  useTableContextStore.getState().clear();
  await act(async () => {
    renderWithProviders(
      <CheckoutScreen
        guestReceiptRecoveryEnabled={guestReceiptRecoveryEnabled}
        publicOrderIntakeEnabled={publicOrderIntakeEnabled}
      />,
    );
  });
}

async function advanceToReview() {
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "¿Cómo quieres recibir tu pedido?" })).toBeVisible(),
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  });
  await waitFor(() => expect(screen.getByRole("heading", { name: "Tus datos" })).toBeVisible());
  fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Ana Pérez" } });
  fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "+57 300 123 4567" } });
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: "ana@example.com" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  });
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Revisa tu pedido" })).toBeVisible(),
  );
}

beforeEach(() => {
  harness.placeOrderRequest.mockReset();
});

afterEach(() => {
  useCartStore.setState({ items: [] });
  useTableContextStore.getState().clear();
  clearGuestReceiptAttemptStorageForTests();
});

describe("CheckoutScreen", () => {
  it("bloquea la recepción Supabase antes de enviar y lo anuncia de forma accesible", async () => {
    await renderCheckout(checkoutItem, false, false);

    await advanceToReview();

    expect(screen.getByRole("alert")).toHaveTextContent(
      /recepción de pedidos no está disponible temporalmente/i,
    );
    expect(screen.getByRole("button", { name: /confirmar pedido/i })).toBeDisabled();
    expect(harness.placeOrderRequest).not.toHaveBeenCalled();
  });

  it("resume la línea completa y distingue sopa incluida a COP 0", async () => {
    await renderCheckout();
    await advanceToReview();

    expect(screen.getByText("2 × Carne asada del Sinú")).toBeVisible();
    expect(screen.getByText("Sopa incluida: Sopa de mondongo · COP 0")).toBeVisible();
    expect(screen.getByText(/Patacón/)).toHaveTextContent(/\$\s*2\.000/);
    expect(screen.getByText("Nota: Sin cebolla, por favor")).toBeVisible();
    expect(screen.getByText("Pago de demostración")).toBeVisible();
    expect(
      screen.queryByText(/Stripe|Mercado Pago|Requiere configuración/),
    ).not.toBeInTheDocument();
  });

  it("muestra Sin sopa a COP 0 sin cambiar el modificador", async () => {
    await renderCheckout({
      ...checkoutItem,
      lineId: "carne-asada-no-soup",
      modifiers: [
        {
          groupId: "included-lunch-soup",
          groupName: "Sopa incluida",
          optionId: "no-soup",
          optionName: "Sin sopa",
          priceSnapshot: 0,
        },
      ],
    });
    await advanceToReview();

    expect(screen.getByText("Sin sopa · COP 0")).toBeVisible();
    expect(useCartStore.getState().items[0]?.modifiers[0]?.optionId).toBe("no-soup");
  });

  it("ofrece reintento de red con la misma clave y conserva el carrito", async () => {
    harness.placeOrderRequest.mockResolvedValue({
      ok: false,
      error: "Sin conexión con el servidor. Revisa tu red e intenta de nuevo.",
      code: "network",
    });
    await renderCheckout();
    await advanceToReview();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirmar pedido/i }));
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible());
    expect(screen.getAllByRole("button", { name: "Reintentar" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /confirmar pedido/i })).not.toBeInTheDocument();
    const firstKey = harness.placeOrderRequest.mock.calls[0]?.[0]?.idempotencyKey;
    expect(harness.placeOrderRequest.mock.calls[0]?.[0]).not.toHaveProperty("receiptKey");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    });
    await waitFor(() => expect(harness.placeOrderRequest).toHaveBeenCalledTimes(2));

    expect(harness.placeOrderRequest.mock.calls[1]?.[0]?.idempotencyKey).toBe(firstKey);
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("ofrece revisar el carrito ante un conflicto comercial identificado", async () => {
    harness.placeOrderRequest.mockResolvedValue({
      ok: false,
      error: "El plato ya no está disponible.",
      code: "item-unavailable",
    });
    await renderCheckout();
    await advanceToReview();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirmar pedido/i }));
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Revisar carrito" })).toBeVisible(),
    );
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("ignora un segundo toque mientras la solicitud sigue en vuelo", async () => {
    let resolveRequest: ((value: { ok: false; error: string; code: string }) => void) | undefined;
    harness.placeOrderRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    await renderCheckout();
    await advanceToReview();

    const confirm = screen.getByRole("button", { name: /confirmar pedido/i });
    await act(async () => {
      fireEvent.click(confirm);
    });
    await waitFor(() => expect(confirm).toBeDisabled());
    fireEvent.click(confirm);
    expect(harness.placeOrderRequest).toHaveBeenCalledTimes(1);

    resolveRequest?.({
      ok: false,
      error: "Sin conexión con el servidor. Revisa tu red e intenta de nuevo.",
      code: "network",
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible());
    expect(screen.queryByRole("button", { name: /confirmar pedido/i })).not.toBeInTheDocument();
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("en Supabase con recuperación envía una sola credencial fuera del Order", async () => {
    harness.placeOrderRequest.mockResolvedValue({
      ok: true,
      order: {
        id: "11111111-1111-4111-8111-111111111111",
        orderNumber: "CB-0000001",
        status: "pending",
        paymentStatus: "pending",
        paymentMethod: "demo",
        fulfillmentType: "pickup",
        items: [],
        totals: {
          subtotal: 0,
          discount: 0,
          tax: 0,
          serviceFee: 0,
          deliveryFee: 0,
          tip: 0,
          total: 0,
        },
        currency: "COP",
        customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
        notes: "",
        createdAt: "2026-08-07T12:00:00.000Z",
      },
    });
    useCartStore.setState({
      items: [checkoutItem],
      branchId: "branch-centro",
      fulfillmentType: "pickup",
      couponCode: null,
      tipPercent: 0,
    });
    await act(async () => {
      renderWithProviders(<CheckoutScreen guestReceiptRecoveryEnabled />);
    });
    await advanceToReview();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirmar pedido/i }));
    });
    await waitFor(() => expect(harness.placeOrderRequest).toHaveBeenCalledTimes(1));
    const request = harness.placeOrderRequest.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(request.receiptKey).toEqual(expect.stringMatching(/^[A-Za-z0-9_-]{43}$/));
    expect(request.idempotencyKey).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/i));
    expect(request).not.toHaveProperty("order");
    expect(sessionStorage.getItem("rb-checkout-receipt-attempts")).toContain('"state":"confirmed"');
  });

  it("no reenvía ni finge un rechazo si falla guardar después del 201", async () => {
    harness.placeOrderRequest.mockResolvedValue({
      ok: true,
      order: {
        id: "55555555-5555-4555-8555-555555555555",
        orderNumber: "CB-0000002",
        status: "pending",
        paymentStatus: "pending",
        paymentMethod: "demo",
        fulfillmentType: "pickup",
        items: [],
        totals: {
          subtotal: 0,
          discount: 0,
          tax: 0,
          serviceFee: 0,
          deliveryFee: 0,
          tip: 0,
          total: 0,
        },
        currency: "COP",
        customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
        notes: "",
        createdAt: "2026-08-07T12:00:00.000Z",
      },
    });
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
      if (key === "rb-checkout-receipt-attempts" && value.includes('"pending":null')) {
        throw new Error("quota-after-response");
      }
      return originalSetItem.call(this, key, value);
      });

    try {
      useCartStore.setState({
        items: [checkoutItem],
        branchId: "branch-centro",
        fulfillmentType: "pickup",
        couponCode: null,
        tipPercent: 0,
      });
      await act(async () => {
        renderWithProviders(<CheckoutScreen guestReceiptRecoveryEnabled />);
      });
      await advanceToReview();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /confirmar pedido/i }));
      });

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent("respondió exitosamente"),
      );
      expect(screen.getByRole("button", { name: "Atrás" })).toBeVisible();
      expect(screen.queryByRole("button", { name: /confirmar pedido/i })).not.toBeInTheDocument();
      expect(harness.placeOrderRequest).toHaveBeenCalledTimes(1);
      expect(useCartStore.getState().items).toHaveLength(1);
      expect(sessionStorage.getItem("rb-checkout-receipt-attempts")).toContain('"state":"uncertain"');
      expect(screen.queryByText(/^[A-Za-z0-9_-]{43}$/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Mostrar clave" }));
      expect(screen.getByText(/^[A-Za-z0-9_-]{43}$/)).toBeVisible();
    } finally {
      setItem.mockRestore();
    }
  });

  it("bloquea antes del POST si sessionStorage no puede reservar la credencial", async () => {
    useCartStore.setState({
      items: [checkoutItem],
      branchId: "branch-centro",
      fulfillmentType: "pickup",
      couponCode: null,
      tipPercent: 0,
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota-before-request");
    });

    try {
      await act(async () => {
        renderWithProviders(<CheckoutScreen guestReceiptRecoveryEnabled />);
      });
      await advanceToReview();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /confirmar pedido/i }));
      });

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent("No se envió ningún pedido"),
      );
      expect(harness.placeOrderRequest).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });

  it("bloquea antes del POST si desaparece la reserva antes de marcar incertidumbre", async () => {
    const originalRemoveItem = Storage.prototype.removeItem;
    let removeReservationAfterPrepare = false;
    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(function (this: Storage, key) {
        originalRemoveItem.call(this, key);
        if (removeReservationAfterPrepare && key === `${GUEST_RECEIPT_ATTEMPT_STORAGE_KEY}:probe`) {
          originalRemoveItem.call(this, GUEST_RECEIPT_ATTEMPT_STORAGE_KEY);
        }
      });

    try {
      useCartStore.setState({
        items: [checkoutItem],
        branchId: "branch-centro",
        fulfillmentType: "pickup",
        couponCode: null,
        tipPercent: 0,
      });
      await act(async () => {
        renderWithProviders(<CheckoutScreen guestReceiptRecoveryEnabled />);
      });
      await advanceToReview();
      const confirm = screen.getByRole("button", { name: /confirmar pedido/i });
      removeReservationAfterPrepare = true;
      await act(async () => {
        fireEvent.click(confirm);
      });

      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No se envió ningún pedido"));
      expect(harness.placeOrderRequest).not.toHaveBeenCalled();
    } finally {
      removeItem.mockRestore();
    }
  });

  it("bloquea antes del POST si la reserva es sustituida antes de marcar incertidumbre", async () => {
    const originalSetItem = Storage.prototype.setItem;
    let replacementDone = false;
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        originalSetItem.call(this, key, value);
        if (
          !replacementDone &&
          key === `${GUEST_RECEIPT_ATTEMPT_STORAGE_KEY}:probe` &&
          this.getItem(GUEST_RECEIPT_ATTEMPT_STORAGE_KEY)
        ) {
          replacementDone = true;
          const current = JSON.parse(
            this.getItem(GUEST_RECEIPT_ATTEMPT_STORAGE_KEY) ?? "{}",
          ) as { version: number; pending: Record<string, unknown>; confirmed: unknown[] };
          this.setItem(
            GUEST_RECEIPT_ATTEMPT_STORAGE_KEY,
            JSON.stringify({
              ...current,
              pending: {
                ...current.pending,
                idempotencyKey: "99999999-9999-4999-8999-999999999999",
                receiptKey: generateReceiptKey(),
              },
            }),
          );
        }
      });

    try {
      await renderCheckout(checkoutItem, true);
      await advanceToReview();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /confirmar pedido/i }));
      });

      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No se envió ningún pedido"));
      expect(harness.placeOrderRequest).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });

  it("no navega ni reenvía si la reserva desaparece mientras espera un 201", async () => {
    harness.placeOrderRequest.mockImplementation(async () => {
      sessionStorage.removeItem(GUEST_RECEIPT_ATTEMPT_STORAGE_KEY);
      return {
        ok: true,
        order: {
          id: "66666666-6666-4666-8666-666666666666",
          orderNumber: "CB-0000003",
          status: "pending",
          paymentStatus: "pending",
          paymentMethod: "demo",
          fulfillmentType: "pickup",
          items: [],
          totals: {
            subtotal: 0,
            discount: 0,
            tax: 0,
            serviceFee: 0,
            deliveryFee: 0,
            tip: 0,
            total: 0,
          },
          currency: "COP",
          customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
          notes: "",
          createdAt: "2026-08-07T12:00:00.000Z",
        },
      };
    });
    await renderCheckout(checkoutItem, true);
    await advanceToReview();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirmar pedido/i }));
    });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("respondió exitosamente"),
    );
    expect(harness.placeOrderRequest).toHaveBeenCalledTimes(1);
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /confirmar pedido/i })).not.toBeInTheDocument();
  });

  it("rechaza una reserva sustituida mientras espera un 201", async () => {
    harness.placeOrderRequest.mockImplementation(async () => {
      const current = JSON.parse(
        sessionStorage.getItem(GUEST_RECEIPT_ATTEMPT_STORAGE_KEY) ?? "{}",
      ) as Record<string, unknown>;
      const pending = current.pending as Record<string, unknown>;
      sessionStorage.setItem(
        GUEST_RECEIPT_ATTEMPT_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          pending: {
            ...pending,
            idempotencyKey: "77777777-7777-4777-8777-777777777777",
            receiptKey: generateReceiptKey(),
          },
          confirmed: [],
        }),
      );
      return {
        ok: true,
        order: {
          id: "88888888-8888-4888-8888-888888888888",
          orderNumber: "CB-0000004",
          status: "pending",
          paymentStatus: "pending",
          paymentMethod: "demo",
          fulfillmentType: "pickup",
          items: [],
          totals: {
            subtotal: 0,
            discount: 0,
            tax: 0,
            serviceFee: 0,
            deliveryFee: 0,
            tip: 0,
            total: 0,
          },
          currency: "COP",
          customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
          notes: "",
          createdAt: "2026-08-07T12:00:00.000Z",
        },
      };
    });
    await renderCheckout(checkoutItem, true);
    await advanceToReview();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirmar pedido/i }));
    });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("respondió exitosamente"),
    );
    expect(harness.placeOrderRequest).toHaveBeenCalledTimes(1);
    expect(useCartStore.getState().items).toHaveLength(1);
  });
});
