/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";

const pollMock = vi.fn();
const refreshMock = vi.fn();
const playSoundMock = vi.fn();

vi.mock("@/app/admin/order-poll-actions", () => ({
  pollOperationalOrdersAction: () => pollMock(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/lib/orders/order-alert-sound", () => ({
  readOrderAlertSoundPreference: () => false,
  writeOrderAlertSoundPreference: vi.fn(),
  playOrderAlertSound: () => playSoundMock(),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe("useOperationalOrderMonitor", () => {
  beforeEach(() => {
    pollMock.mockReset();
    refreshMock.mockReset();
    playSoundMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("baseline sin refresh; nuevo id dispara refresh; unmount limpia interval", async () => {
    vi.useFakeTimers();
    const { useOperationalOrderMonitor } = await import("@/hooks/use-operational-order-monitor");
    let phase: "baseline" | "updated" = "baseline";
    pollMock.mockImplementation(async () => {
      if (phase === "baseline") {
        return {
          ok: true,
          orders: [{ id: "a", orderNumber: "1", status: "pending", fulfillmentType: "pickup", createdAt: "t" }],
        };
      }
      return {
        ok: true,
        orders: [
          { id: "a", orderNumber: "1", status: "pending", fulfillmentType: "pickup", createdAt: "t" },
          { id: "b", orderNumber: "2", status: "pending", fulfillmentType: "delivery", createdAt: "t2" },
        ],
      };
    });

    const { result, unmount } = renderHook(
      () => useOperationalOrderMonitor({ role: "cashier", enabled: true, pollIntervalMs: 15_000 }),
      { wrapper },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.pendingCount).toBe(1);
    expect(refreshMock).not.toHaveBeenCalled();

    phase = "updated";
    const pollsBefore = pollMock.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    expect(pollMock.mock.calls.length).toBeGreaterThan(pollsBefore);
    expect(result.current.pendingCount).toBe(2);
    expect(refreshMock).toHaveBeenCalled();

    const callsAfter = pollMock.mock.calls.length;
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(45_000);
      await Promise.resolve();
    });
    expect(pollMock.mock.calls.length).toBe(callsAfter);
  });

  it("error de poll no vacía el pendingCount conocido", async () => {
    vi.useFakeTimers();
    const { useOperationalOrderMonitor } = await import("@/hooks/use-operational-order-monitor");
    let phase: "ok" | "fail" = "ok";
    pollMock.mockImplementation(async () => {
      if (phase === "ok") {
        return {
          ok: true,
          orders: [{ id: "a", orderNumber: "1", status: "pending", fulfillmentType: "pickup", createdAt: "t" }],
        };
      }
      return { ok: false, message: "Red caída", code: "unavailable" };
    });

    const { result } = renderHook(
      () => useOperationalOrderMonitor({ role: "manager", enabled: true, pollIntervalMs: 15_000 }),
      { wrapper },
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.pendingCount).toBe(1);

    phase = "fail";
    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    expect(result.current.lastError).toBeTruthy();
    expect(result.current.pendingCount).toBe(1);
  });

  it("focus y online disparan refetch", async () => {
    vi.useFakeTimers();
    const { useOperationalOrderMonitor } = await import("@/hooks/use-operational-order-monitor");
    pollMock.mockResolvedValue({ ok: true, orders: [] });
    renderHook(() => useOperationalOrderMonitor({ role: "owner", enabled: true, pollIntervalMs: 60_000 }), {
      wrapper,
    });
    await act(async () => {
      await Promise.resolve();
    });
    const before = pollMock.mock.calls.length;
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });
    expect(pollMock.mock.calls.length).toBeGreaterThan(before);
  });

  it("editor no activa monitor", async () => {
    const { useOperationalOrderMonitor } = await import("@/hooks/use-operational-order-monitor");
    const { result } = renderHook(
      () => useOperationalOrderMonitor({ role: "editor", enabled: true }),
      { wrapper },
    );
    expect(result.current.active).toBe(false);
    expect(pollMock).not.toHaveBeenCalled();
  });
});
