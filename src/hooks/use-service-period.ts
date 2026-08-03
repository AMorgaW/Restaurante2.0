"use client";

import { useEffect, useState } from "react";
import {
  createServiceSnapshot,
  millisecondsUntilNextServiceBoundary,
  type ServiceSnapshot,
} from "@/lib/menu/service-period";

/**
 * Conserva la instantánea SSR durante hidratación y después se sincroniza y
 * programa exactamente el siguiente límite de servicio.
 */
export function useServicePeriod(initialSnapshot: ServiceSnapshot): ServiceSnapshot {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      const now = new Date();
      setSnapshot(createServiceSnapshot(now));
      timer = setTimeout(schedule, millisecondsUntilNextServiceBoundary(now) + 25);
    };

    schedule();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  return snapshot;
}
