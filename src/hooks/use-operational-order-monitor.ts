"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { pollOperationalOrdersAction } from "@/app/admin/order-poll-actions";
import {
  OPERATIONAL_ORDER_POLL_INTERVAL_MS,
  buildNewOrderToast,
  canReceivePendingOrderAlerts,
  canPollOperationalOrders,
  tickOperationalOrderMonitor,
  type OperationalOrderSnapshot,
} from "@/lib/orders/operational-order-monitor";
import {
  playOrderAlertSound,
  readOrderAlertSoundPreference,
  writeOrderAlertSoundPreference,
} from "@/lib/orders/order-alert-sound";
import { useToast } from "@/components/ui/toast";
import type { AdminRole } from "@/lib/admin/authorization";

export type UseOperationalOrderMonitorOptions = {
  role: AdminRole | null | undefined;
  /** Solo DATA_MODE=supabase con sesión staff real. */
  enabled: boolean;
  pollIntervalMs?: number;
};

export type UseOperationalOrderMonitorResult = {
  pendingCount: number;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  lastError: string | null;
  active: boolean;
};

export function useOperationalOrderMonitor(
  options: UseOperationalOrderMonitorOptions,
): UseOperationalOrderMonitorResult {
  const { toast } = useToast();
  const router = useRouter();
  const pollIntervalMs = options.pollIntervalMs ?? OPERATIONAL_ORDER_POLL_INTERVAL_MS;
  const active =
    options.enabled && canPollOperationalOrders(options.role);
  const emitPendingAlerts = canReceivePendingOrderAlerts(options.role);

  const [pendingCount, setPendingCount] = useState(0);
  const [soundEnabled, setSoundEnabledState] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const observedIdsRef = useRef<Set<string>>(new Set());
  const baselineDoneRef = useRef(false);
  const fingerprintRef = useRef("");
  const inFlightRef = useRef(false);
  const soundEnabledRef = useRef(false);
  const mountedRef = useRef(true);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    soundEnabledRef.current = enabled;
    setSoundEnabledState(enabled);
    writeOrderAlertSoundPreference(enabled);
  }, []);

  useEffect(() => {
    setSoundEnabledState(readOrderAlertSoundPreference());
    soundEnabledRef.current = readOrderAlertSoundPreference();
  }, []);

  const applySnapshot = useCallback(
    (orders: OperationalOrderSnapshot[]) => {
      const tick = tickOperationalOrderMonitor(
        {
          orders,
          observedIds: observedIdsRef.current,
          baselineDone: baselineDoneRef.current,
          emitPendingAlerts,
        },
        fingerprintRef.current,
      );
      baselineDoneRef.current = tick.baselineDone;
      observedIdsRef.current = tick.observedIds;
      fingerprintRef.current = tick.fingerprint;
      setPendingCount(tick.pendingCount);

      if (tick.shouldToast) {
        const message = buildNewOrderToast(tick.newOrders);
        toast({ title: message.title, description: message.description, variant: "info" });
      }
      if (tick.shouldPlaySound && soundEnabledRef.current) {
        playOrderAlertSound();
      }
      if (tick.queueChanged) {
        router.refresh();
      }
    },
    [emitPendingAlerts, router, toast],
  );

  const poll = useCallback(async () => {
    if (!active || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const result = await pollOperationalOrdersAction();
      if (!mountedRef.current) return;
      if (!result.ok) {
        setLastError(result.message);
        return;
      }
      setLastError(null);
      applySnapshot(result.orders);
    } catch {
      if (mountedRef.current) {
        setLastError("No se pudo actualizar la cola de pedidos.");
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [active, applySnapshot]);

  useEffect(() => {
    mountedRef.current = true;
    if (!active) {
      baselineDoneRef.current = false;
      observedIdsRef.current = new Set();
      fingerprintRef.current = "";
      setPendingCount(0);
      setLastError(null);
      return;
    }

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, pollIntervalMs);

    const onFocus = () => {
      void poll();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll();
    };
    const onOnline = () => {
      void poll();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [active, poll, pollIntervalMs]);

  return {
    pendingCount,
    soundEnabled,
    setSoundEnabled,
    lastError,
    active,
  };
}
