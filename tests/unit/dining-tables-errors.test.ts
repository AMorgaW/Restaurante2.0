import { describe, expect, it } from "vitest";
import {
  DiningTablesError,
  mapDiningTablesRpcError,
  toSafeDiningTablesMessage,
} from "@/server/dining-tables/errors";

const LEAKY =
  /token|hash|fingerprint|search_path|pg_temp|HINT|SELECT |INSERT |idempotency_key|qr_token|sk_live/i;

function assertSafe(error: DiningTablesError) {
  expect(error.message).not.toMatch(LEAKY);
  const safe = toSafeDiningTablesMessage(error);
  expect(safe.message).not.toMatch(LEAKY);
  expect(safe.message).toBe(error.message);
}

describe("mapDiningTablesRpcError / toSafeDiningTablesMessage", () => {
  it("mapea QR inválido sin filtrar token/hash", () => {
    const mapped = mapDiningTablesRpcError({
      message: "QR invalido",
      details: "token=deadbeef hash=abc fingerprint=xyz",
      hint: "SELECT * FROM dining_tables WHERE qr_token_hash = ...",
    });
    expect(mapped.code).toBe("qr-invalid");
    expect(mapped.message).toMatch(/ya no es válido/i);
    assertSafe(mapped);
  });

  it("mapea Use el cobro de sesion", () => {
    const mapped = mapDiningTablesRpcError({
      message: "Use el cobro de sesion de mesa para este pedido",
      details: "order_id=111 fingerprint=leak",
    });
    expect(mapped.code).toBe("table-order-individual");
    expect(mapped.message).toMatch(/cuenta completa/i);
    assertSafe(mapped);
  });

  it("mapea Conflicto de idempotencia", () => {
    const mapped = mapDiningTablesRpcError({
      message: "Conflicto de idempotencia",
      details: "idempotency_key=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      code: "23505",
    });
    expect(mapped.code).toBe("idempotency-conflict");
    expect(mapped.message).toMatch(/intento ya se usó/i);
    assertSafe(mapped);
  });

  it("mapea No autorizado a forbidden seguro", () => {
    const mapped = mapDiningTablesRpcError({
      message: "No autorizado para confirmar pagos",
      details: "permission denied for function confirm_manual_order_payment",
      code: "42501",
    });
    expect(mapped.code).toBe("forbidden");
    expect(mapped.message).toBe("No tienes permiso para esta operación.");
    assertSafe(mapped);
  });

  it("mapea cuenta cerrada", () => {
    const mapped = mapDiningTablesRpcError({
      message: "La cuenta de mesa esta cerrada",
      details: "session_id=cccccccc qr_token=secret",
    });
    expect(mapped.code).toBe("session-closed");
    expect(mapped.message).toMatch(/cuenta ya fue cerrada/i);
    assertSafe(mapped);
  });

  it("nunca filtra SQL/token/hash en errores genéricos", () => {
    const mapped = mapDiningTablesRpcError({
      message: "relation pg_temp._manual_pay does not exist",
      details: "HINT: check search_path fingerprint=deadbeef token=abc",
      hint: "internal sk_live",
    });
    expect(mapped.code).toBe("persistence-error");
    assertSafe(mapped);

    const safe = toSafeDiningTablesMessage(new Error("SELECT * FROM auth.users WHERE hash=x"));
    expect(safe.code).toBe("persistence-error");
    expect(safe.message).not.toMatch(LEAKY);
    expect(safe.message).not.toMatch(/SELECT|auth\.users/i);
  });

  it("toSafeDiningTablesMessage preserva DiningTablesError", () => {
    const err = new DiningTablesError("Mensaje seguro de prueba.", "validation");
    expect(toSafeDiningTablesMessage(err)).toEqual({
      message: "Mensaje seguro de prueba.",
      code: "validation",
    });
  });
});
