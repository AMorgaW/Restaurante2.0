import { describe, expect, it } from "vitest";
import {
  createServiceSnapshot,
  millisecondsUntilNextServiceBoundary,
  resolveServicePeriod,
} from "@/lib/menu/service-period";

const bogotaInstant = (time: string) => new Date(`2026-07-21T${time}-05:00`);

describe("período de servicio en America/Bogota", () => {
  it.each([
    ["06:59:59", "closed"],
    ["07:00:00", "lunch"],
    ["16:59:59", "lunch"],
    ["17:00:00", "dinner"],
    ["21:59:59", "dinner"],
    ["22:00:00", "closed"],
  ] as const)("resuelve %s como %s", (time, expected) => {
    expect(resolveServicePeriod(bogotaInstant(time))).toBe(expected);
  });

  it("crea una instantánea SSR autoconsistente", () => {
    const snapshot = createServiceSnapshot(bogotaInstant("16:59:59"));
    expect(snapshot.period).toBe("lunch");
    expect(snapshot.observedAt).toBe("2026-07-21T21:59:59.000Z");
  });

  it("programa el cambio al próximo límite exacto", () => {
    expect(millisecondsUntilNextServiceBoundary(bogotaInstant("16:59:59"))).toBe(1_000);
    expect(millisecondsUntilNextServiceBoundary(bogotaInstant("21:59:59"))).toBe(1_000);
  });
});
