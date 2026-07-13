import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { InstallPwaPrompt } from "@/components/feedback/install-pwa-prompt";
import { renderWithProviders } from "./render";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function dispatchInstallEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as InstallPromptEvent;
  Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe("InstallPwaPrompt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("no se muestra sin evento de instalación válido", () => {
    renderWithProviders(<InstallPwaPrompt />);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.queryByRole("dialog", { name: "Instalar aplicación" })).not.toBeInTheDocument();
  });

  it("espera un tiempo prudente tras el evento antes de mostrarse", () => {
    renderWithProviders(<InstallPwaPrompt />);
    dispatchInstallEvent();

    // Inmediatamente después del evento NO aparece (no interrumpe).
    expect(screen.queryByRole("dialog", { name: "Instalar aplicación" })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(12_000);
    });
    expect(screen.getByRole("dialog", { name: "Instalar aplicación" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Instalar aplicación" })).toBeInTheDocument();
  });

  it("se puede cerrar y recuerda el rechazo", () => {
    const { unmount } = renderWithProviders(<InstallPwaPrompt />);
    dispatchInstallEvent();
    act(() => {
      vi.advanceTimersByTime(12_000);
    });

    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso de instalación" }));
    expect(window.localStorage.getItem("rb-pwa-dismissed")).toBeTruthy();

    // Nueva visita: con el rechazo reciente ya no vuelve a aparecer.
    unmount();
    renderWithProviders(<InstallPwaPrompt />);
    dispatchInstallEvent();
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.queryByRole("dialog", { name: "Instalar aplicación" })).not.toBeInTheDocument();
  });

  it("no aparece cuando la aplicación ya está instalada (standalone)", () => {
    const original = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("display-mode: standalone"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    renderWithProviders(<InstallPwaPrompt />);
    dispatchInstallEvent();
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.queryByRole("dialog", { name: "Instalar aplicación" })).not.toBeInTheDocument();

    Object.defineProperty(window, "matchMedia", { writable: true, value: original });
  });
});
