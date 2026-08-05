import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { PensionWorkspace } from "@/components/pension/pension-workspace";
import { ToastProvider } from "@/components/ui/toast";
import { DEFAULT_SERVICE_SNAPSHOT } from "@/lib/menu/service-period";
import { useAdminStore } from "@/stores/admin";
import { resetPensionDemo, usePensionStore } from "@/stores/pension";

function renderWorkspace() {
  return render(<ToastProvider><PensionWorkspace initialSnapshot={DEFAULT_SERVICE_SNAPSHOT} mode="local" /></ToastProvider>);
}

describe("experiencia local de pensionado", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAdminStore.setState({ demoRole: null });
    resetPensionDemo();
  });

  it("muestra plan y menú para un customer activo", async () => {
    renderWorkspace();
    await waitFor(() => expect(screen.getByRole("heading", { name: /Juan/ })).toBeVisible());
    expect(screen.getAllByText(/pago y la activaci.n se realizan personalmente con el jefe/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("heading", { name: /Arma tu comida/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Confirmar consumo demo/i })).toBeDisabled();
  });

  it("no muestra beneficios ni consumo a un customer sin membresía", async () => {
    usePensionStore.setState({ selectedProfileId: "customer-no-membership" });
    renderWorkspace();
    await waitFor(() => expect(screen.getByRole("heading", { name: /Conoce el plan pensionado/i })).toBeVisible());
    expect(screen.getAllByText(/precio p.blico/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("button", { name: /Confirmar consumo/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/comidas disponibles/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/activar beneficios/i)).not.toBeInTheDocument();
  });

  it("mantiene pending sin activar ni consumir", async () => {
    usePensionStore.setState({ selectedProfileId: "customer-pending" });
    renderWorkspace();
    await waitFor(() => expect(screen.getAllByText(/Pendiente de activaci.n/i).length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText(/El jefe debe activar personalmente/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Confirmar consumo/i })).not.toBeInTheDocument();
  });

  it("rechaza cargos demo administrativos aunque intenten usar la ruta", async () => {
    useAdminStore.setState({ demoRole: "manager" });
    renderWorkspace();
    await waitFor(() => expect(screen.getByRole("heading", { name: /Acceso de cliente demo requerido/i })).toBeVisible());
    expect(screen.queryByRole("heading", { name: /Arma tu comida/i })).not.toBeInTheDocument();
  });
});
