import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PensionSupabaseWorkspace } from "@/components/pension/pension-supabase-workspace";
import { ToastProvider } from "@/components/ui/toast";
import type { PensionCustomerSnapshot } from "@/server/pension/types";
import { useTableContextStore } from "@/stores/table-context";

const placePensionOrderAction = vi.fn();

vi.mock("@/app/pensionado/pension-order-actions", () => ({
  placePensionOrderAction: (...args: unknown[]) => placePensionOrderAction(...args),
}));

const MENU_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";
const ITEM_ID = "33333333-3333-4333-8333-333333333333";
const COMMERCIAL_DATE = "2026-08-09";

function buildSnapshot(): PensionCustomerSnapshot {
  return {
    membership: {
      id: "44444444-4444-4444-8444-444444444444",
      profileId: "55555555-5555-4555-8555-555555555555",
      planId: "66666666-6666-4666-8666-666666666666",
      planName: "Plan calendario",
      branchId: "77777777-7777-4777-8777-777777777777",
      status: "active",
      modality: "calendar_period",
      publicPrice: 180000,
      agreedPrice: 150000,
      startsAt: "2026-08-01",
      endsAt: "2026-08-30",
    },
    plans: [],
    menusByDate: {
      [COMMERCIAL_DATE]: {
        lunch: {
          id: MENU_ID,
          branchId: "77777777-7777-4777-8777-777777777777",
          serviceDate: COMMERCIAL_DATE,
          period: "lunch",
          status: "published",
          categories: [
            {
              id: CATEGORY_ID,
              category: "principal",
              label: "Principal",
              isRequired: true,
              maxSelections: 1,
              displayOrder: 1,
              items: [
                {
                  id: ITEM_ID,
                  menuItemId: "88888888-8888-4888-8888-888888888888",
                  name: "Sancocho",
                  isIncluded: true,
                  surchargeAmount: 0,
                  isAvailable: true,
                  displayOrder: 1,
                },
              ],
            },
          ],
        },
        dinner: null,
        lunchConsumed: false,
        dinnerConsumed: false,
      },
    },
    deliveryFee: 5000,
    consumptions: [],
    branchId: "77777777-7777-4777-8777-777777777777",
    branchSlug: "centro",
    commercialDate: COMMERCIAL_DATE,
  };
}

function renderForm() {
  return render(
    <ToastProvider>
      <PensionSupabaseWorkspace snapshot={buildSnapshot()} loadError={null} />
    </ToastProvider>,
  );
}

describe("formulario semantico de pedido pensionado (H-01)", () => {
  beforeEach(() => {
    placePensionOrderAction.mockReset();
    useTableContextStore.getState().clear();
    useTableContextStore.setState({
      tableQrToken: "test-table-qr-token-abcdef",
      tableCode: "M1",
      tableName: "Mesa 1",
      branchConfigId: "77777777-7777-4777-8777-777777777777",
    });
  });

  it("usa form con submit semantico y no crea pedido si faltan campos", async () => {
    const user = userEvent.setup();
    renderForm();

    const form = screen.getByRole("form", { name: /Pedido pensionado/i });
    const submit = screen.getByRole("button", { name: /Confirmar pedido pensionado/i });
    expect(submit).toHaveAttribute("type", "submit");
    expect(form).toContainElement(submit);

    fireEvent.submit(form);

    expect(placePensionOrderAction).not.toHaveBeenCalled();
    expect(await screen.findByText(/Elige una opci.n en cada categor.a obligatoria/i)).toBeVisible();
    expect(document.activeElement).toHaveAttribute("name", `pension-cat-${CATEGORY_ID}`);

    await user.click(screen.getByLabelText(/Sancocho/i));
    fireEvent.submit(form);

    expect(placePensionOrderAction).not.toHaveBeenCalled();
    const nameInput = screen.getByRole("textbox", { name: /Nombre/i });
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(nameInput).toHaveAttribute("aria-describedby", "pension-customer-name-error");
    expect(screen.getByText(/El nombre es obligatorio/i)).toBeVisible();
    expect(document.activeElement).toBe(nameInput);
  });

  it("con datos validos ejecuta una sola vez la ruta de submit existente", async () => {
    const user = userEvent.setup();
    placePensionOrderAction.mockResolvedValue({
      ok: true,
      message: "Pedido pensionado creado.",
      code: "ok",
      data: {
        orderId: "99999999-9999-4999-8999-999999999999",
        orderNumber: "P-100",
        status: "pending",
        total: 0,
        createdAt: "2026-08-09T12:00:00.000Z",
        consumptionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        replay: false,
        paymentStatus: "pending",
      },
    });

    renderForm();
    await user.click(screen.getByLabelText(/Sancocho/i));
    await user.type(screen.getByRole("textbox", { name: /Nombre/i }), "Ana Perez");
    await user.type(screen.getByRole("textbox", { name: /Tel.fono/i }), "3001234567");
    await user.type(screen.getByRole("textbox", { name: /Correo/i }), "ana@example.com");

    fireEvent.submit(screen.getByRole("form", { name: /Pedido pensionado/i }));

    await waitFor(() => expect(placePensionOrderAction).toHaveBeenCalledTimes(1));
    expect(placePensionOrderAction.mock.calls[0]?.[0]).toMatchObject({
      menuId: MENU_ID,
      pensionMenuItemIds: [ITEM_ID],
      fulfillmentType: "local",
      customerName: "Ana Perez",
      customerPhone: "3001234567",
      customerEmail: "ana@example.com",
      tableQrToken: "test-table-qr-token-abcdef",
    });
    expect((await screen.findAllByText(/Pedido P-100/i)).length).toBeGreaterThanOrEqual(1);
  });
});
