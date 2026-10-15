import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutScreen } from "@/components/checkout/checkout-screen";
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

async function renderCheckout(item: CartItem = checkoutItem) {
  useCartStore.setState({
    items: [item],
    branchId: "branch-centro",
    fulfillmentType: "pickup",
    couponCode: null,
    tipPercent: 0,
  });
  useTableContextStore.getState().clear();
  await act(async () => {
    renderWithProviders(<CheckoutScreen />);
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
});

describe("CheckoutScreen", () => {
  it("resume la línea completa y distingue sopa incluida a COP 0", async () => {
    await renderCheckout();
    await advanceToReview();

    expect(screen.getByText("2 × Carne asada del Sinú")).toBeVisible();
    expect(screen.getByText("Sopa incluida: Sopa de mondongo · COP 0")).toBeVisible();
    expect(screen.getByText(/Patacón/)).toHaveTextContent(/\$\s*2\.000/);
    expect(screen.getByText("Nota: Sin cebolla, por favor")).toBeVisible();
    expect(screen.getByText("Pago de demostración")).toBeVisible();
    expect(screen.queryByText(/Stripe|Mercado Pago|Requiere configuración/)).not.toBeInTheDocument();
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
});
