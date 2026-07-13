import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, IconButton } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { AvailabilityBadge, DietaryTag } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { SearchField } from "@/components/menu/search-field";
import { TextField } from "@/components/ui/form-field";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Dialog } from "@/components/ui/dialog";
import { renderWithProviders } from "./render";

describe("Button", () => {
  it("ejecuta onClick y respeta disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProviders(
      <>
        <Button onClick={onClick}>Aceptar</Button>
        <Button disabled onClick={onClick}>
          Bloqueado
        </Button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Aceptar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Bloqueado" })).toBeDisabled();
  });

  it("en estado loading queda deshabilitado y anuncia aria-busy", () => {
    renderWithProviders(<Button loading>Enviando</Button>);
    const button = screen.getByRole("button", { name: /enviando/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});

describe("IconButton", () => {
  it("exige y expone su etiqueta accesible", () => {
    renderWithProviders(
      <IconButton aria-label="Cerrar panel">
        <span aria-hidden>×</span>
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Cerrar panel" })).toBeInTheDocument();
  });
});

describe("Chip", () => {
  it("expone el estado seleccionado con aria-pressed", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProviders(
      <Chip selected={false} onClick={onClick}>
        Carnes
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Carnes" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await user.click(chip);
    expect(onClick).toHaveBeenCalled();
  });
});

describe("Badges y precio", () => {
  it("AvailabilityBadge solo aparece cuando está agotado", () => {
    const { rerender } = renderWithProviders(<AvailabilityBadge available />);
    expect(screen.queryByText("Agotado")).not.toBeInTheDocument();
    rerender(<AvailabilityBadge available={false} />);
    expect(screen.getByText("Agotado")).toBeInTheDocument();
  });

  it("DietaryTag y Price muestran su contenido formateado", () => {
    renderWithProviders(
      <>
        <DietaryTag>Parrilla</DietaryTag>
        <Price amount={38500} />
      </>,
    );
    expect(screen.getByText("Parrilla")).toBeInTheDocument();
    expect(screen.getByText(/38\.500/)).toBeInTheDocument();
  });
});

describe("QuantitySelector", () => {
  it("respeta mínimo y máximo y anuncia el valor", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<QuantitySelector value={1} onChange={onChange} min={1} max={3} />);

    expect(screen.getByRole("button", { name: "Reducir cantidad" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Aumentar cantidad" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("deshabilita aumentar en el máximo", () => {
    renderWithProviders(<QuantitySelector value={3} onChange={vi.fn()} min={1} max={3} />);
    expect(screen.getByRole("button", { name: "Aumentar cantidad" })).toBeDisabled();
  });
});

function SearchHarness({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <SearchField
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("SearchField", () => {
  it("escribe, muestra botón de limpiar y limpia", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<SearchHarness onChange={onChange} />);
    expect(screen.queryByRole("button", { name: "Limpiar búsqueda" })).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox"), "sopa");
    expect(onChange).toHaveBeenLastCalledWith("sopa");

    await user.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });
});

describe("TextField", () => {
  it("asocia label, hint y error con el input", () => {
    const { rerender } = renderWithProviders(
      <TextField label="Nombre" hint="Como aparece en tu documento" />,
    );
    const input = screen.getByLabelText("Nombre");
    expect(input).toHaveAccessibleDescription("Como aparece en tu documento");

    rerender(<TextField label="Nombre" error="Escribe tu nombre completo." />);
    const withError = screen.getByLabelText("Nombre");
    expect(withError).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe tu nombre completo.");
  });
});

describe("Estados vacíos y de error", () => {
  it("EmptyState muestra título, descripción y acción", () => {
    renderWithProviders(
      <EmptyState title="Sin resultados" description="Prueba otra búsqueda" action={<Button size="sm">Limpiar</Button>} />,
    );
    expect(screen.getByRole("heading", { name: "Sin resultados" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpiar" })).toBeInTheDocument();
  });

  it("ErrorState ejecuta el reintento", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithProviders(<ErrorState onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("Dialog", () => {
  it("abre, atrapa el título y cierra con Escape", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <Dialog open onOpenChange={onOpenChange} title="¿Vaciar el carrito?" description="No puede deshacerse.">
        <p>Contenido</p>
      </Dialog>,
    );
    expect(screen.getByRole("dialog", { name: "¿Vaciar el carrito?" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
