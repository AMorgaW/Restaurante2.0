import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { InventoryScreen } from "@/components/admin/inventory-screen";
import { ToastProvider } from "@/components/ui/toast";
import { resetInventoryDemo, useInventoryStore } from "@/stores/inventory";

vi.mock("@/app/admin/inventory-actions", () => ({
  applyInventoryMovementAction: vi.fn(),
}));

describe("pantalla local de inventario", () => {
  beforeEach(() => {
    resetInventoryDemo();
    window.localStorage.clear();
  });

  it("renderiza resumen, filtros colapsados, alertas y acciones accesibles", () => {
    render(<ToastProvider><InventoryScreen /></ToastProvider>);
    expect(screen.getByRole("heading", { name: "Inventario" })).toBeVisible();
    expect(screen.getByText("Control de insumos y existencias. Las operaciones de esta etapa son locales y demostrativas.")).toBeVisible();
    expect(screen.getByRole("button", { name: /Filtros/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Buscar por nombre")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar insumo" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Desactivar Carne de res/i })).toBeVisible();
    expect(screen.getByText("Crítico")).toBeVisible();
  });

  it("abre el panel de filtros y permite buscar", () => {
    render(<ToastProvider><InventoryScreen /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Filtros/i }));
    expect(screen.getByRole("button", { name: /Filtros/i })).toHaveAttribute("aria-expanded", "true");
    fireEvent.change(screen.getByLabelText("Buscar por nombre"), { target: { value: "costilla" } });
    expect(screen.getByRole("heading", { name: "Costilla" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Carne de res" })).not.toBeInTheDocument();
    expect(useInventoryStore.getState().items).toHaveLength(11);
  });

  it("abre el formulario de agregar y conserva unidades explícitas", () => {
    render(<ToastProvider><InventoryScreen /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Agregar insumo" }));
    expect(screen.getByRole("dialog", { name: "Agregar insumo" })).toBeVisible();
    expect(screen.getByLabelText("Unidad")).toHaveValue("kg");
    expect(screen.getByRole("option", { name: "ml" })).toBeInTheDocument();
  });
});
