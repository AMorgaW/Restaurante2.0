import { describe, expect, it } from "vitest";
import { createIdempotencyAttempt } from "@/lib/dining-tables/idempotency";

describe("createIdempotencyAttempt", () => {
  it("conserva la misma clave tras fallo ambiguo y rota tras éxito", () => {
    const attempt = createIdempotencyAttempt();
    const first = attempt.getKey();
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    // Fallo ambiguo (timeout/red): no llamar succeed → mismo key en reintento.
    expect(attempt.getKey()).toBe(first);

    attempt.succeed();
    const second = attempt.getKey();
    expect(second).not.toBe(first);
    expect(attempt.getKey()).toBe(second);
  });
});
