/**
 * Clave de idempotencia por intento de cobro/anulación.
 * - Mismo key en reintento tras fallo ambiguo (timeout / red).
 * - Nuevo key solo tras éxito confirmado (o replay aceptado).
 */
export function createIdempotencyAttempt() {
  let key = crypto.randomUUID();
  return {
    getKey: () => key,
    succeed: () => {
      key = crypto.randomUUID();
    },
  };
}
