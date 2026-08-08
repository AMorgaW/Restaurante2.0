import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/app/admin/order-actions", () => ({
  transitionOrderStatusAction: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/app/admin/dining-table-actions", () => ({
  confirmManualOrderPaymentAction: vi.fn(async () => ({ ok: true, data: {} })),
  confirmManualTableSessionPaymentAction: vi.fn(async () => ({ ok: true, data: {} })),
  voidManualPaymentConfirmationAction: vi.fn(async () => ({ ok: true, data: {} })),
  createDiningTableAction: vi.fn(async () => ({ ok: true, data: {} })),
  setDiningTableActiveAction: vi.fn(async () => ({ ok: true, data: undefined })),
  rotateDiningTableQrAction: vi.fn(async () => ({ ok: true, data: {} })),
}));

import { EmployeeWorkspace } from "@/components/employee/employee-workspace";
import { ToastProvider } from "@/components/ui/toast";
import { DEFAULT_SERVICE_SNAPSHOT } from "@/lib/menu/service-period";
import { useAdminStore } from "@/stores/admin";
import { useOrdersStore } from "@/stores/orders";

describe("experiencia local de empleado", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAdminStore.setState({ demoRole: "support" });
    useOrdersStore.setState({ orders: [] });
  });

  it("renderiza el perfil demo y mantiene support en solo lectura de pedidos", async () => {
    render(<ToastProvider><EmployeeWorkspace initialSnapshot={DEFAULT_SERVICE_SNAPSHOT} mode="local" /></ToastProvider>);
    await waitFor(() => expect(screen.getByRole("heading", { name: /Hola, Sofía/i })).toBeVisible());
    expect(screen.getByText("Empleado · demo local")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Cola de pedidos" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Incidencias" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Preparar|Confirmar|Entregar/ })).not.toBeInTheDocument();
  });

  it("mantiene support en consulta de incidencias sin mutaciones", async () => {
    render(<ToastProvider><EmployeeWorkspace initialSnapshot={DEFAULT_SERVICE_SNAPSHOT} mode="local" /></ToastProvider>);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Incidencias" })).toBeVisible());
    expect(screen.queryByLabelText("Descripción")).not.toBeInTheDocument();
    expect(screen.getByText(/puede consultar incidencias, pero no registrarlas/i)).toBeVisible();
    expect(window.localStorage.getItem("rb-employee")).toBeNull();
  });

  it("cierra la experiencia cuando no existe un cargo de empleado", async () => {
    useAdminStore.setState({ demoRole: null });
    render(<ToastProvider><EmployeeWorkspace initialSnapshot={DEFAULT_SERVICE_SNAPSHOT} mode="local" /></ToastProvider>);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Acceso de empleado no disponible" })).toBeVisible());
    expect(screen.getByRole("link", { name: "Ir a administración" })).toHaveAttribute("href", "/admin");
  });

  it("editor ve enlace a gestionar catálogo en /empleado", async () => {
    useAdminStore.setState({ demoRole: "editor" });
    render(<ToastProvider><EmployeeWorkspace initialSnapshot={DEFAULT_SERVICE_SNAPSHOT} mode="local" /></ToastProvider>);
    await waitFor(() => expect(screen.getByRole("link", { name: "Gestionar catálogo" })).toBeVisible());
    expect(screen.getByRole("link", { name: "Gestionar catálogo" })).toHaveAttribute("href", "/empleado/catalogo");
  });
});
