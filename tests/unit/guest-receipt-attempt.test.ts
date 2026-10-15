import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canonicalizeCommercialPayload,
  clearGuestReceiptAttemptStorageForTests,
  decodeBase64Url,
  encodeBase64Url,
  generateReceiptKey,
  GUEST_RECEIPT_ATTEMPT_STORAGE_KEY,
  canUseGuestReceiptAttemptStorage,
  markGuestReceiptAttemptConfirmed,
  markGuestReceiptAttemptUncertain,
  prepareGuestReceiptAttempt,
} from "@/features/checkout/guest-receipt-attempt";

const commercialPayload = {
  branchId: "branch-centro",
  fulfillmentType: "pickup" as const,
  customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
  items: [{ slug: "carne-asada", quantity: 1, notes: "", modifiers: [] }],
  tipPercent: 0,
  notes: "",
};

beforeEach(() => {
  clearGuestReceiptAttemptStorageForTests();
});

describe("guest receipt attempt continuity", () => {
  it("genera exactamente 32 bytes en Base64URL canónico", () => {
    const key = generateReceiptKey();
    expect(key).toHaveLength(43);
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeBase64Url(decodeBase64Url(key))).toBe(key);
    expect(decodeBase64Url(key)).toHaveLength(32);
  });

  it("canonicaliza objetos con el mismo contenido en orden distinto", () => {
    expect(canonicalizeCommercialPayload({ b: 2, a: 1 })).toBe(
      canonicalizeCommercialPayload({ a: 1, b: 2 }),
    );
  });

  it("mantiene la huella HMAC cuando solo cambia el orden de propiedades", async () => {
    const first = await prepareGuestReceiptAttempt(commercialPayload);
    const second = await prepareGuestReceiptAttempt({
      notes: "",
      tipPercent: 0,
      items: [{ modifiers: [], notes: "", quantity: 1, slug: "carne-asada" }],
      customer: { email: "ana@example.com", phone: "3001234567", name: "Ana Pérez" },
      fulfillmentType: "pickup",
      branchId: "branch-centro",
    });
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.receiptKey).toBe(first.receiptKey);
    expect(second.commercialFingerprint).toBe(first.commercialFingerprint);
  });

  it("conserva el mismo par durante un reintento y marca incertidumbre", async () => {
    const first = await prepareGuestReceiptAttempt(commercialPayload);
    markGuestReceiptAttemptUncertain(first);
    const retry = await prepareGuestReceiptAttempt({ ...commercialPayload });
    expect(retry.idempotencyKey).toBe(first.idempotencyKey);
    expect(retry.receiptKey).toBe(first.receiptKey);
    expect(retry.state).toBe("uncertain");
  });

  it("bloquea reconstrucciones con datos comerciales diferentes tras una respuesta incierta", async () => {
    const first = await prepareGuestReceiptAttempt(commercialPayload);
    markGuestReceiptAttemptUncertain(first);
    await expect(
      prepareGuestReceiptAttempt({
        ...commercialPayload,
        customer: { ...commercialPayload.customer, name: "Otra persona" },
      }),
    ).rejects.toThrow("guest-receipt-attempt-mismatch");
  });

  it("guarda la confirmación separada del payload y exige orderId UUID", async () => {
    const first = await prepareGuestReceiptAttempt(commercialPayload);
    markGuestReceiptAttemptUncertain(first);
    markGuestReceiptAttemptConfirmed(first, "11111111-1111-4111-8111-111111111111");
    expect(sessionStorage.getItem("rb-orders")).toBeNull();
    expect(sessionStorage.getItem("rb-checkout-receipt-attempts")).toContain("confirmed");
  });

  it("no trata un registro corrupto como una confirmación ni crea otro intento", async () => {
    sessionStorage.setItem("rb-checkout-receipt-attempts", JSON.stringify({ version: 99 }));
    await expect(prepareGuestReceiptAttempt(commercialPayload)).rejects.toThrow(
      "guest-receipt-storage-corrupt",
    );
  });

  it("rechaza una transición si la reserva desaparece después de prepare", async () => {
    const attempt = await prepareGuestReceiptAttempt(commercialPayload);
    clearGuestReceiptAttemptStorageForTests();

    expect(() => markGuestReceiptAttemptUncertain(attempt)).toThrow(
      "guest-receipt-reservation-missing",
    );
  });

  it("rechaza una reserva estructuralmente válida de otro intento", async () => {
    const attempt = await prepareGuestReceiptAttempt(commercialPayload);
    const replacement = {
      ...attempt,
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
      receiptKey: generateReceiptKey(),
    };
    sessionStorage.setItem(
      GUEST_RECEIPT_ATTEMPT_STORAGE_KEY,
      JSON.stringify({ version: 1, pending: replacement, confirmed: [] }),
    );

    expect(() => markGuestReceiptAttemptUncertain(attempt)).toThrow(
      "guest-receipt-reservation-mismatch",
    );
  });

  it("rechaza pending confirmado como envelope inválido", async () => {
    const attempt = await prepareGuestReceiptAttempt(commercialPayload);
    sessionStorage.setItem(
      GUEST_RECEIPT_ATTEMPT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        pending: {
          ...attempt,
          state: "confirmed",
          orderId: "33333333-3333-4333-8333-333333333333",
        },
        confirmed: [],
      }),
    );

    await expect(prepareGuestReceiptAttempt(commercialPayload)).rejects.toThrow(
      "guest-receipt-storage-corrupt",
    );
  });

  it("bloquea el intento si sessionStorage no permite escribir", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(canUseGuestReceiptAttemptStorage()).toBe(false);
    await expect(prepareGuestReceiptAttempt(commercialPayload)).rejects.toThrow(
      "guest-receipt-storage-unavailable",
    );
    setItem.mockRestore();
  });

  it("rechaza superar el límite sin sobrescribir comprobantes confirmados", async () => {
    for (let index = 0; index < 8; index += 1) {
      const attempt = await prepareGuestReceiptAttempt({ ...commercialPayload, notes: `nota-${index}` });
      markGuestReceiptAttemptUncertain(attempt);
      markGuestReceiptAttemptConfirmed(attempt, `11111111-1111-4111-8111-11111111111${index}`);
    }
    await expect(
      prepareGuestReceiptAttempt({ ...commercialPayload, notes: "nota-8" }),
    ).rejects.toThrow("guest-receipt-capacity-exhausted");
    const stored = JSON.parse(sessionStorage.getItem("rb-checkout-receipt-attempts") ?? "{}");
    expect(stored.confirmed).toHaveLength(8);
    expect(stored.pending).toBeNull();
  });

  it("conserva una reserva incierta aunque ya ocupe la octava plaza", async () => {
    for (let index = 0; index < 7; index += 1) {
      const confirmed = await prepareGuestReceiptAttempt({
        ...commercialPayload,
        notes: `confirmado-${index}`,
      });
      markGuestReceiptAttemptUncertain(confirmed);
      markGuestReceiptAttemptConfirmed(confirmed, `22222222-2222-4222-8222-22222222222${index}`);
    }

    const uncertain = await prepareGuestReceiptAttempt({ ...commercialPayload, notes: "incierto" });
    markGuestReceiptAttemptUncertain(uncertain);
    const retry = await prepareGuestReceiptAttempt({ ...commercialPayload, notes: "incierto" });

    expect(retry.idempotencyKey).toBe(uncertain.idempotencyKey);
    expect(retry.receiptKey).toBe(uncertain.receiptKey);
    expect(retry.state).toBe("uncertain");

    markGuestReceiptAttemptConfirmed(retry, "33333333-3333-4333-8333-333333333333");
    const stored = JSON.parse(sessionStorage.getItem("rb-checkout-receipt-attempts") ?? "{}");
    expect(stored.pending).toBeNull();
    expect(stored.confirmed).toHaveLength(8);
  });

  it("no sobrescribe una confirmación al comenzar un segundo pedido", async () => {
    const first = await prepareGuestReceiptAttempt({ ...commercialPayload, notes: "primero" });
    markGuestReceiptAttemptUncertain(first);
    markGuestReceiptAttemptConfirmed(first, "44444444-4444-4444-8444-444444444444");

    const second = await prepareGuestReceiptAttempt({ ...commercialPayload, notes: "segundo" });
    expect(second.receiptKey).not.toBe(first.receiptKey);

    const stored = JSON.parse(sessionStorage.getItem("rb-checkout-receipt-attempts") ?? "{}");
    expect(stored.confirmed).toHaveLength(1);
    expect(stored.confirmed[0].receiptKey).toBe(first.receiptKey);
    expect(stored.pending.receiptKey).toBe(second.receiptKey);
  });
});
