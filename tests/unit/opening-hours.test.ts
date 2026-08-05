import { describe, expect, it } from "vitest";
import {
  getLocalDateParts,
  getOpeningStatus,
  minutesToTime,
  timeToMinutes,
} from "@/lib/menu/opening-hours";
import type { Branch } from "@/types/restaurant";

const baseBranch: Branch = {
  id: "b1",
  name: "Test",
  slug: "test",
  address: "",
  city: "",
  latitude: 0,
  longitude: 0,
  phone: "",
  whatsapp: "",
  email: "",
  timezone: "America/Bogota",
  pickupEnabled: true,
  deliveryEnabled: true,
  deliveryFee: 0,
  deliveryAreaNote: "",
  status: "active",
  openingHours: [
    { dayOfWeek: 0, openingTime: "12:00", closingTime: "17:00", isClosed: false },
    { dayOfWeek: 1, openingTime: "11:30", closingTime: "21:30", isClosed: false },
    { dayOfWeek: 2, openingTime: "11:30", closingTime: "21:30", isClosed: false },
    { dayOfWeek: 3, openingTime: "11:30", closingTime: "21:30", isClosed: false },
    { dayOfWeek: 4, openingTime: "11:30", closingTime: "22:00", isClosed: false },
    { dayOfWeek: 5, openingTime: "11:30", closingTime: "23:00", isClosed: false },
    { dayOfWeek: 6, openingTime: "12:00", closingTime: "23:00", isClosed: true },
  ],
  specialHours: [],
};

// 2026-07-08 fue miércoles. 15:00 en Bogotá = 20:00 UTC (UTC-5, sin DST).
const wednesdayAfternoon = new Date("2026-07-08T20:00:00Z");
const wednesdayEarly = new Date("2026-07-08T13:00:00Z"); // 08:00 Bogotá
const wednesdayLate = new Date("2026-07-09T03:30:00Z"); // 22:30 Bogotá

describe("timeToMinutes / minutesToTime", () => {
  it("convierte en ambas direcciones", () => {
    expect(timeToMinutes("11:30")).toBe(690);
    expect(minutesToTime(690)).toBe("11:30");
    expect(minutesToTime(0)).toBe("00:00");
  });
});

describe("getLocalDateParts", () => {
  it("resuelve día y hora en la zona horaria del restaurante", () => {
    const parts = getLocalDateParts(wednesdayAfternoon, "America/Bogota");
    expect(parts.dayOfWeek).toBe(3);
    expect(parts.minutes).toBe(15 * 60);
    expect(parts.isoDate).toBe("2026-07-08");
  });
});

describe("getOpeningStatus", () => {
  it("reporta abierto dentro del horario", () => {
    const status = getOpeningStatus(baseBranch, wednesdayAfternoon);
    expect(status).toEqual({ open: true, closesAt: "21:30" });
  });

  it("reporta cerrado antes de abrir, con hora de apertura", () => {
    const status = getOpeningStatus(baseBranch, wednesdayEarly);
    expect(status).toEqual({ open: false, reason: "before-opening", opensAt: "11:30" });
  });

  it("reporta cerrado después del cierre", () => {
    const status = getOpeningStatus(baseBranch, wednesdayLate);
    expect(status.open).toBe(false);
    if (!status.open) expect(status.reason).toBe("after-closing");
  });

  it("respeta días marcados como cerrados", () => {
    const saturday = new Date("2026-07-11T20:00:00Z"); // sábado 15:00 Bogotá
    const status = getOpeningStatus(baseBranch, saturday);
    expect(status.open).toBe(false);
    if (!status.open) expect(status.reason).toBe("closed-today");
  });

  it("prioriza horarios especiales (festivo cerrado)", () => {
    const branch: Branch = {
      ...baseBranch,
      specialHours: [{ date: "2026-07-08", isClosed: true, reason: "Festivo" }],
    };
    const status = getOpeningStatus(branch, wednesdayAfternoon);
    expect(status.open).toBe(false);
    if (!status.open) expect(status.reason).toBe("special");
  });
});
