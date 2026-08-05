import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { InventoryScreen } from "@/components/admin/inventory-screen";
import { ToastProvider } from "@/components/ui/toast";
import { resetInventoryDemo, useInventoryStore } from "@/stores/inventory";

describe("pantalla local de inventario", () => {
  beforeEach(() => {
    resetInventoryDemo();
    window.localStorage.clear();
  });

  it("renderiza resumen, filtros, alertas y acciones accesibles", () => {
    render(<ToastProvider><InventoryScreen /></ToastProvider>);
    expect(screen.getByRole("heading", { name: "Inventario" })).toBeVisible();
    expect(screen.getByText("Control de insumos y existencias. Las operaciones de esta etapa son locales y demostrativas.")).toBeVisible();
    expect(screen.getByLabelText("Buscar por nombre")).toBeVisible();
    expect(screen.getByRole("button", { name: "Agregar insumo" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Desactivar Carne de res/i })).toBeVisible();
    expect(screen.getAllByText("Crítico").length).toBeGreaterThanOrEqual(2);
  });

  it("abre el formulario de agregar y conserva unidades explícitas", () => {
    render(<ToastProvider><InventoryScreen /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Agregar insumo" }));
    expect(screen.getByRole("dialog", { name: "Agregar insumo" })).toBeVisible();
    expect(screen.getByLabelText("Unidad")).toHaveValue("kg");
    expect(screen.getByRole("option", { name: "ml" })).toBeInTheDocument();
  });

  it("permite buscar sin tocar la fuente de fixtures", () => {
    render(<ToastProvider><InventoryScreen /></ToastProvider>);
    fireEvent.change(screen.getByLabelText("Buscar por nombre"), { target: { value: "costilla" } });
    expect(screen.getByRole("heading", { name: "Costilla" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Carne de res" })).not.toBeInTheDocument();
    expect(useInventoryStore.getState().items).toHaveLength(11);
  });
});
