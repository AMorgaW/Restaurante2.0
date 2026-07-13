import { describe, expect, it } from "vitest";
import {
  getAvailableTimeSlots,
  getLocalDateParts,
  getOpeningStatus,
  isDateWithinBookingWindow,
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
  reservationsEnabled: true,
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

describe("getAvailableTimeSlots", () => {
  const options = { intervalMinutes: 30, minLeadMinutes: 60, now: wednesdayEarly };

  it("genera franjas dentro del horario con margen antes del cierre", () => {
    const slots = getAvailableTimeSlots(baseBranch, "2026-07-10", options); // viernes
    expect(slots[0]).toBe("11:30");
    expect(slots[slots.length - 1]).toBe("22:00"); // cierra 23:00, margen 60min
    expect(slots).toContain("19:00");
  });

  it("devuelve vacío para días cerrados", () => {
    expect(getAvailableTimeSlots(baseBranch, "2026-07-11", options)).toEqual([]); // sábado cerrado
  });

  it("filtra franjas pasadas cuando la fecha es hoy", () => {
    // Hoy miércoles a las 15:00 → con 60 min de antelación, nada antes de las 16:00.
    const slots = getAvailableTimeSlots(baseBranch, "2026-07-08", {
      ...options,
      now: wednesdayAfternoon,
    });
    expect(slots[0]).toBe("16:00");
    expect(slots).not.toContain("15:30");
  });

  it("respeta horarios especiales reducidos", () => {
    const branch: Branch = {
      ...baseBranch,
      specialHours: [
        { date: "2026-07-10", openingTime: "18:00", closingTime: "21:00", isClosed: false, reason: "Evento" },
      ],
    };
    const slots = getAvailableTimeSlots(branch, "2026-07-10", options);
    expect(slots[0]).toBe("18:00");
    expect(slots[slots.length - 1]).toBe("20:00");
  });
});

describe("isDateWithinBookingWindow", () => {
  const now = wednesdayAfternoon;

  it("acepta hoy y fechas dentro de la ventana", () => {
    expect(isDateWithinBookingWindow("2026-07-08", 30, "America/Bogota", now)).toBe(true);
    expect(isDateWithinBookingWindow("2026-08-01", 30, "America/Bogota", now)).toBe(true);
  });

  it("rechaza fechas pasadas", () => {
    expect(isDateWithinBookingWindow("2026-07-07", 30, "America/Bogota", now)).toBe(false);
  });

  it("rechaza fechas más allá de la ventana", () => {
    expect(isDateWithinBookingWindow("2026-09-01", 30, "America/Bogota", now)).toBe(false);
  });

  it("rechaza formatos inválidos", () => {
    expect(isDateWithinBookingWindow("08/07/2026", 30, "America/Bogota", now)).toBe(false);
  });
});
