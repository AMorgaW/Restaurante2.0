import { describe, expect, it, vi } from "vitest";
import {
  buildNewOrderToast,
  canPollOperationalOrders,
  canReceivePendingOrderAlerts,
  countPendingAttention,
  fingerprintOrders,
  tickOperationalOrderMonitor,
  type OperationalOrderSnapshot,
} from "@/lib/orders/operational-order-monitor";
import type { AdminRole } from "@/lib/admin/authorization";

function snap(
  partial: Partial<OperationalOrderSnapshot> & Pick<OperationalOrderSnapshot, "id" | "orderNumber">,
): OperationalOrderSnapshot {
  return {
    status: "pending",
    fulfillmentType: "pickup",
    createdAt: "2026-08-08T12:00:00.000Z",
    ...partial,
  };
}

describe("canReceivePendingOrderAlerts / canPollOperationalOrders", () => {
  const cases: Array<{
    role: AdminRole | null;
    alerts: boolean;
    poll: boolean;
  }> = [
    { role: "owner", alerts: true, poll: true },
    { role: "admin", alerts: true, poll: true },
    { role: "manager", alerts: true, poll: true },
    { role: "cashier", alerts: true, poll: true },
    { role: "kitchen", alerts: false, poll: true },
    { role: "support", alerts: false, poll: false },
    { role: "editor", alerts: false, poll: false },
    { role: null, alerts: false, poll: false },
  ];

  for (const row of cases) {
    it(`${row.role ?? "null"}: alerts=${row.alerts} poll=${row.poll}`, () => {
      expect(canReceivePendingOrderAlerts(row.role)).toBe(row.alerts);
      expect(canPollOperationalOrders(row.role)).toBe(row.poll);
    });
  }
});

describe("tickOperationalOrderMonitor", () => {
  it("baseline establece observed sin toast ni sonido", () => {
    const existing = [snap({ id: "a", orderNumber: "CB-1" }), snap({ id: "b", orderNumber: "CB-2" })];
    const tick = tickOperationalOrderMonitor({
      orders: existing,
      observedIds: new Set(),
      baselineDone: false,
      emitPendingAlerts: true,
    });
    expect(tick.shouldToast).toBe(false);
    expect(tick.shouldPlaySound).toBe(false);
    expect(tick.newOrders).toEqual([]);
    expect(tick.pendingCount).toBe(2);
    expect(tick.baselineDone).toBe(true);
    expect(tick.observedIds.has("a")).toBe(true);
    expect(tick.observedIds.has("b")).toBe(true);
  });

  it("nuevo order_id dispara aviso; el mismo id no se repite", () => {
    const baseline = tickOperationalOrderMonitor({
      orders: [snap({ id: "a", orderNumber: "CB-1" })],
      observedIds: new Set(),
      baselineDone: false,
      emitPendingAlerts: true,
    });
    const next = tickOperationalOrderMonitor(
      {
        orders: [
          snap({ id: "a", orderNumber: "CB-1" }),
          snap({ id: "b", orderNumber: "CB-2", fulfillmentType: "delivery" }),
        ],
        observedIds: baseline.observedIds,
        baselineDone: true,
        emitPendingAlerts: true,
      },
      baseline.fingerprint,
    );
    expect(next.newOrders.map((o) => o.id)).toEqual(["b"]);
    expect(next.shouldToast).toBe(true);
    expect(next.shouldPlaySound).toBe(true);

    const replay = tickOperationalOrderMonitor(
      {
        orders: [
          snap({ id: "a", orderNumber: "CB-1" }),
          snap({ id: "b", orderNumber: "CB-2", fulfillmentType: "delivery" }),
        ],
        observedIds: next.observedIds,
        baselineDone: true,
        emitPendingAlerts: true,
      },
      next.fingerprint,
    );
    expect(replay.newOrders).toEqual([]);
    expect(replay.shouldToast).toBe(false);
  });

  it("replay del mismo order_id no duplica aviso", () => {
    const first = tickOperationalOrderMonitor({
      orders: [],
      observedIds: new Set(),
      baselineDone: false,
      emitPendingAlerts: true,
    });
    const created = tickOperationalOrderMonitor(
      {
        orders: [snap({ id: "same", orderNumber: "CB-9" })],
        observedIds: first.observedIds,
        baselineDone: true,
        emitPendingAlerts: true,
      },
      first.fingerprint,
    );
    expect(created.shouldToast).toBe(true);
    const replay = tickOperationalOrderMonitor(
      {
        orders: [snap({ id: "same", orderNumber: "CB-9" })],
        observedIds: created.observedIds,
        baselineDone: true,
        emitPendingAlerts: true,
      },
      created.fingerprint,
    );
    expect(replay.shouldToast).toBe(false);
    expect(replay.newOrders).toHaveLength(0);
  });

  it("varios nuevos agrupan en un solo toast lógico", () => {
    const baseline = tickOperationalOrderMonitor({
      orders: [],
      observedIds: new Set(),
      baselineDone: false,
      emitPendingAlerts: true,
    });
    const batch = tickOperationalOrderMonitor(
      {
        orders: [
          snap({ id: "1", orderNumber: "A" }),
          snap({ id: "2", orderNumber: "B" }),
          snap({ id: "3", orderNumber: "C" }),
        ],
        observedIds: baseline.observedIds,
        baselineDone: true,
        emitPendingAlerts: true,
      },
      baseline.fingerprint,
    );
    expect(batch.newOrders).toHaveLength(3);
    expect(batch.shouldToast).toBe(true);
    expect(buildNewOrderToast(batch.newOrders).title).toBe("3 pedidos nuevos");
  });

  it("pending count baja cuando el order deja pending", () => {
    const baseline = tickOperationalOrderMonitor({
      orders: [snap({ id: "a", orderNumber: "CB-1", status: "pending" })],
      observedIds: new Set(),
      baselineDone: false,
      emitPendingAlerts: true,
    });
    expect(baseline.pendingCount).toBe(1);
    const confirmed = tickOperationalOrderMonitor(
      {
        orders: [snap({ id: "a", orderNumber: "CB-1", status: "confirmed" })],
        observedIds: baseline.observedIds,
        baselineDone: true,
        emitPendingAlerts: true,
      },
      baseline.fingerprint,
    );
    expect(confirmed.pendingCount).toBe(0);
    expect(confirmed.queueChanged).toBe(true);
    expect(confirmed.shouldToast).toBe(false);
  });

  it("kitchen (emitPendingAlerts=false) refresca sin toast de pending", () => {
    const baseline = tickOperationalOrderMonitor({
      orders: [],
      observedIds: new Set(),
      baselineDone: false,
      emitPendingAlerts: false,
    });
    const next = tickOperationalOrderMonitor(
      {
        orders: [snap({ id: "n", orderNumber: "CB-7" })],
        observedIds: baseline.observedIds,
        baselineDone: true,
        emitPendingAlerts: false,
      },
      baseline.fingerprint,
    );
    expect(next.newOrders).toHaveLength(1);
    expect(next.shouldToast).toBe(false);
    expect(next.shouldPlaySound).toBe(false);
    expect(next.queueChanged).toBe(true);
  });

  it("error de red no se modela aquí: conservar snapshot previo en el hook", () => {
    // El tick no vacía observedIds si no se llama; fingerprint distinto fuerza queueChanged.
    const a = fingerprintOrders([snap({ id: "a", orderNumber: "1" })]);
    const b = fingerprintOrders([snap({ id: "a", orderNumber: "1", status: "confirmed" })]);
    expect(a).not.toBe(b);
    expect(countPendingAttention([snap({ id: "a", orderNumber: "1", status: "confirmed" })])).toBe(0);
  });
});

describe("buildNewOrderToast", () => {
  it("un pedido incluye número y canal", () => {
    const toast = buildNewOrderToast([snap({ id: "1", orderNumber: "CB-42", fulfillmentType: "local" })]);
    expect(toast.title).toContain("CB-42");
    expect(toast.description).toBe("Mesa");
  });
});

describe("order alert sound preference", () => {
  it("default seguro y toggle requiere escritura explícita", async () => {
    vi.resetModules();
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => {
          storage.set(k, v);
        },
      },
      AudioContext: undefined,
    });
    const sound = await import("@/lib/orders/order-alert-sound");
    expect(sound.readOrderAlertSoundPreference()).toBe(false);
    sound.writeOrderAlertSoundPreference(true);
    expect(sound.readOrderAlertSoundPreference()).toBe(true);
    sound.writeOrderAlertSoundPreference(false);
    expect(sound.readOrderAlertSoundPreference()).toBe(false);
    vi.unstubAllGlobals();
  });

  it("playOrderAlertSound no lanza sin AudioContext", async () => {
    vi.resetModules();
    vi.stubGlobal("window", { AudioContext: undefined, setTimeout: globalThis.setTimeout });
    const sound = await import("@/lib/orders/order-alert-sound");
    expect(() => sound.playOrderAlertSound()).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe("sonido en tick (control)", () => {
  it("baseline no pide sonido; lote nuevo pide un shouldPlaySound", () => {
    const baseline = tickOperationalOrderMonitor({
      orders: [snap({ id: "old", orderNumber: "O" })],
      observedIds: new Set(),
      baselineDone: false,
      emitPendingAlerts: true,
    });
    expect(baseline.shouldPlaySound).toBe(false);
    const batch = tickOperationalOrderMonitor(
      {
        orders: [
          snap({ id: "old", orderNumber: "O" }),
          snap({ id: "n1", orderNumber: "N1" }),
          snap({ id: "n2", orderNumber: "N2" }),
        ],
        observedIds: baseline.observedIds,
        baselineDone: true,
        emitPendingAlerts: true,
      },
      baseline.fingerprint,
    );
    expect(batch.shouldPlaySound).toBe(true);
    expect(batch.newOrders).toHaveLength(2);
  });

  it("disabled emit o sin nuevos → sin sonido", () => {
    const baseline = tickOperationalOrderMonitor({
      orders: [],
      observedIds: new Set(),
      baselineDone: false,
      emitPendingAlerts: true,
    });
    const quiet = tickOperationalOrderMonitor(
      {
        orders: [snap({ id: "x", orderNumber: "X" })],
        observedIds: baseline.observedIds,
        baselineDone: true,
        emitPendingAlerts: false,
      },
      baseline.fingerprint,
    );
    expect(quiet.shouldPlaySound).toBe(false);
  });
});
