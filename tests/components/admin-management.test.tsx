import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AdminRoleProvider } from "@/components/admin/admin-role-context";
import { PensionAdminScreen } from "@/components/admin/pension-admin-screen";
import { StaffScreen } from "@/components/admin/staff-screen";
import { ToastProvider } from "@/components/ui/toast";
import { useAdminStore } from "@/stores/admin";
import { resetPensionAdminDemo } from "@/stores/pension-admin";
import { resetStaffDemo, useStaffStore } from "@/stores/staff";

function renderAdmin(node: React.ReactNode) {
  return render(<ToastProvider><AdminRoleProvider mode="local" role={null}>{node}</AdminRoleProvider></ToastProvider>);
}

describe("gestión administrativa local", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAdminStore.setState({ demoRole: "owner" });
    resetStaffDemo();
    resetPensionAdminDemo();
  });

  it("muestra capacidades derivadas y sincroniza un cambio de cargo", async () => {
    renderAdmin(<StaffScreen />);
    expect(screen.getByRole("heading", { name: "Empleados" })).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Cambiar cargo" })[0]!);
    fireEvent.change(screen.getByLabelText("Nuevo cargo"), { target: { value: "cashier" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cargo" }));
    await waitFor(() => expect(useStaffStore.getState().members.some((member) => member.role === "cashier" && member.id === "demo-manager")).toBe(true));
  });

  it("mantiene las acciones sensibles fuera de la consulta administrativa", () => {
    useAdminStore.setState({ demoRole: "admin" });
    renderAdmin(<PensionAdminScreen />);
    expect(screen.getByRole("heading", { name: "Pensionados" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Activar pensionado" })).not.toBeInTheDocument();
    expect(screen.getByText(/Consulta operativa/)).toBeVisible();
  });

  it("presenta el flujo de pago y activación solo al jefe", () => {
    renderAdmin(<PensionAdminScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));
    expect(screen.getByRole("heading", { name: "Registrar pago presencial" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Guardar pago presencial" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByRole("button", { name: "Activar pensionado" })).toBeVisible();
  });
});
