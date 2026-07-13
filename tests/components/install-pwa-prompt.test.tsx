import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { InstallPwaPrompt } from "@/components/feedback/install-pwa-prompt";
import { renderWithProviders } from "./render";

type InstallPromptEvent = Event & {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function dispatchInstallEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as InstallPromptEvent;
  Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => window.dispatchEvent(event));
  return event;
}

function showPrompt(outcome: "accepted" | "dismissed" = "accepted") {
  const event = dispatchInstallEvent(outcome);
  act(() => vi.advanceTimersByTime(12_000));
  return event;
}

describe("InstallPwaPrompt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T12:00:00Z"));
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("no aparece sin evidencia de instalación ni en standalone", () => {
    renderWithProviders(<InstallPwaPrompt />);
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.queryByRole("region", { name: /pide más rápido/i })).not.toBeInTheDocument();
  });

  it("captura beforeinstallprompt y aparece solo tras los 12 segundos", () => {
    renderWithProviders(<InstallPwaPrompt />);
    const event = dispatchInstallEvent();
    expect(event.defaultPrevented).toBe(true);
    expect(screen.queryByRole("region", { name: /pide más rápido/i })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(11_999));
    expect(screen.queryByRole("region", { name: /pide más rápido/i })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("region", { name: /pide más rápido/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Instalar" })).toBeInTheDocument();
  });

  it("invoca prompt una sola vez y oculta al aceptar", async () => {
    renderWithProviders(<InstallPwaPrompt />);
    const event = showPrompt("accepted");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Instalar" }));
      fireEvent.click(screen.getByRole("button", { name: "Instalar" }));
      await Promise.resolve();
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("region", { name: /pide más rápido/i })).not.toBeVisible();
  });

  it("recuerda el rechazo manual durante 30 días y vuelve a ser elegible después", () => {
    const { unmount } = renderWithProviders(<InstallPwaPrompt />);
    showPrompt();
    fireEvent.click(screen.getByRole("button", { name: "Ahora no" }));
    expect(window.localStorage.getItem("rb-pwa-dismissed")).toBeTruthy();

    unmount();
    const recentVisit = renderWithProviders(<InstallPwaPrompt />);
    showPrompt();
    expect(screen.queryByRole("region", { name: /pide más rápido/i })).not.toBeInTheDocument();

    vi.setSystemTime(new Date("2026-08-13T12:00:01Z"));
    recentVisit.unmount();
    renderWithProviders(<InstallPwaPrompt />);
    showPrompt();
    expect(screen.getByRole("region", { name: /pide más rápido/i })).toBeInTheDocument();
  });

  it("guarda el rechazo del diálogo nativo y se cierra con Escape o appinstalled", async () => {
    const initialVisit = renderWithProviders(<InstallPwaPrompt />);
    showPrompt("dismissed");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Instalar" }));
      await Promise.resolve();
    });
    expect(window.localStorage.getItem("rb-pwa-dismissed")).toBeTruthy();

    initialVisit.unmount();
    window.localStorage.clear();
    const escapeVisit = renderWithProviders(<InstallPwaPrompt />);
    showPrompt();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("region", { name: /pide más rápido/i })).not.toBeVisible();

    escapeVisit.unmount();
    renderWithProviders(<InstallPwaPrompt />);
    showPrompt();
    act(() => window.dispatchEvent(new Event("appinstalled")));
    expect(screen.queryByRole("region", { name: /pide más rápido/i })).not.toBeInTheDocument();
  });

  it("no aparece cuando la aplicación ya está instalada", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({ matches: query.includes("standalone") })),
    );
    renderWithProviders(<InstallPwaPrompt />);
    showPrompt();
    expect(screen.queryByRole("region", { name: /pide más rápido/i })).not.toBeInTheDocument();
  });

  it("expone solo en preview los estados controlados del visual lab", () => {
    const onPreviewStateChange = vi.fn();
    const { rerender } = renderWithProviders(
      <InstallPwaPrompt previewState="visible" onPreviewStateChange={onPreviewStateChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Instalar" }));
    expect(onPreviewStateChange).toHaveBeenCalledWith("accepted");
    rerender(<InstallPwaPrompt previewState="standalone" onPreviewStateChange={onPreviewStateChange} />);
    expect(screen.queryByRole("region", { name: /pide más rápido/i })).not.toBeInTheDocument();
  });
});
