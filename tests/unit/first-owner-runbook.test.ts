import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const runbook = readFileSync(
  resolve(process.cwd(), "references/runbooks/FIRST_OWNER_BOOTSTRAP.md"),
  "utf8",
);

describe("runbook FIRST_OWNER_BOOTSTRAP", () => {
  it("no usa placeholders psql ni sustitución global insegura", () => {
    expect(runbook).not.toMatch(/:owner_email/);
    expect(runbook).not.toMatch(/LIKE\s+'%:owner_email%'/i);
    expect(runbook).not.toMatch(/reemplazar todas las coincidencias/i);
    expect(runbook).not.toMatch(/sustituci[oó]n global/i);
  });

  it("la promoción usa un solo email editable en el SQL y audit_log", () => {
    const promo = runbook.slice(
      runbook.indexOf("## B. Promoción transaccional"),
      runbook.indexOf("## C. Verificación posterior"),
    );
    const sql = promo.slice(promo.indexOf("```sql"), promo.indexOf("```", promo.indexOf("```sql") + 1));
    const emailHits = sql.match(/OWNER_EMAIL_HERE/g) ?? [];
    expect(emailHits).toHaveLength(1);
    expect(sql).toMatch(/first_owner_bootstrap/);
    expect(sql).toMatch(/idempotency_key/);
    expect(sql).toMatch(/get diagnostics v_updated = row_count/i);
  });

  it("la reversión exige UUID y evidencia de auditoría", () => {
    const revert = runbook.slice(runbook.indexOf("## D. Reversión extraordinaria"));
    expect(revert).toMatch(/OWNER_USER_ID_HERE/);
    expect(revert).toMatch(/BOOTSTRAP_AUDIT_KEY_HERE/);
    expect(revert).toMatch(/first_owner_bootstrap/);
    expect(revert).toMatch(/Reversión automática no segura/);
    expect(revert).not.toMatch(/where lower\(u\.email\)/);
  });
});
