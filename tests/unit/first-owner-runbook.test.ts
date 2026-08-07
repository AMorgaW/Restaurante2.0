import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const runbook = readFileSync(
  resolve(process.cwd(), "references/runbooks/FIRST_OWNER_BOOTSTRAP.md"),
  "utf8",
);

function sectionBetween(startHeading: string, endHeading: string | null): string {
  const start = runbook.indexOf(startHeading);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = endHeading ? runbook.indexOf(endHeading, start + 1) : runbook.length;
  expect(end).toBeGreaterThan(start);
  return runbook.slice(start, end);
}

function firstSqlBlock(section: string): string {
  const open = section.indexOf("```sql");
  expect(open).toBeGreaterThanOrEqual(0);
  const close = section.indexOf("```", open + 6);
  expect(close).toBeGreaterThan(open);
  return section.slice(open, close);
}

const REAL_EMAIL = /[a-z0-9._%+-]+@(?:gmail|yahoo|hotmail|outlook|icloud)\.[a-z]{2,}/i;

describe("runbook FIRST_OWNER_BOOTSTRAP", () => {
  it("no usa placeholders psql ni sustitución global insegura", () => {
    expect(runbook).not.toMatch(/:owner_email/);
    expect(runbook).not.toMatch(/LIKE\s+'%:owner_email%'/i);
    expect(runbook).not.toMatch(/reemplazar todas las coincidencias/i);
    expect(runbook).not.toMatch(/sustituci[oó]n global/i);
  });

  it("no contiene correos reales", () => {
    expect(runbook).not.toMatch(REAL_EMAIL);
  });

  describe("promoción serializada", () => {
    const promo = sectionBetween("## B. Promoción transaccional", "## C. Verificación posterior");
    const sql = firstSqlBlock(promo);

    it("incluye LOCK TABLE SHARE ROW EXCLUSIVE antes del conteo definitivo", () => {
      expect(sql).toMatch(/LOCK\s+TABLE\s+public\.profiles\s+IN\s+SHARE\s+ROW\s+EXCLUSIVE\s+MODE/i);
      const lockAt = sql.search(/LOCK\s+TABLE\s+public\.profiles\s+IN\s+SHARE\s+ROW\s+EXCLUSIVE\s+MODE/i);
      const ownerCountAt = sql.search(
        /select\s+count\(\*\)\s+into\s+v_owners\s+from\s+public\.profiles\s+where\s+role\s*=\s*'owner'/i,
      );
      expect(lockAt).toBeGreaterThanOrEqual(0);
      expect(ownerCountAt).toBeGreaterThan(lockAt);
    });

    it("exige cero owners y ROW_COUNT = 1", () => {
      expect(sql).toMatch(/if\s+v_owners\s*<>\s*0/i);
      expect(sql).toMatch(/get\s+diagnostics\s+v_updated\s*=\s*row_count/i);
      expect(sql).toMatch(/if\s+v_updated\s*<>\s*1/i);
    });

    it("audita role y staff_status en previous_state y new_state", () => {
      expect(sql).toMatch(
        /jsonb_build_object\(\s*'role',\s*'customer',\s*'staff_status',\s*null\s*\)/i,
      );
      expect(sql).toMatch(
        /jsonb_build_object\(\s*'role',\s*'owner',\s*'staff_status',\s*'active'\s*\)/i,
      );
      expect(sql).toMatch(/first_owner_bootstrap/);
      expect(sql).toMatch(/idempotency_key/);
    });

    it("tiene exactamente una aparición editable de OWNER_EMAIL_HERE", () => {
      const emailHits = sql.match(/OWNER_EMAIL_HERE/g) ?? [];
      expect(emailHits).toHaveLength(1);
    });
  });

  describe("reversión extraordinaria (aislada)", () => {
    const revert = sectionBetween("## D. REVERSIÓN EXTRAORDINARIA — REVISIÓN MANUAL OBLIGATORIA", null);
    const diagnosticSql = firstSqlBlock(revert);

    it("exige placeholders UUID y clave de auditoría", () => {
      expect(revert).toMatch(/OWNER_USER_ID_HERE/);
      expect(revert).toMatch(/BOOTSTRAP_AUDIT_KEY_HERE/);
    });

    it("declara revisión manual obligatoria y no automática", () => {
      expect(revert).toMatch(/REVISIÓN MANUAL OBLIGATORIA/);
      expect(revert).toMatch(/Reversión automática no segura/);
      expect(revert).toMatch(/revisión manual completa/i);
    });

    it("no contiene UPDATE ni COMMIT de reversión", () => {
      expect(revert).not.toMatch(/UPDATE\s+public\.profiles/i);
      expect(revert).not.toMatch(/\bCOMMIT\b/i);
    });

    it("diagnóstico es solo SELECT", () => {
      expect(diagnosticSql).toMatch(/solo\s+SELECT/i);
      expect(diagnosticSql).not.toMatch(/\bUPDATE\b/i);
      expect(diagnosticSql).not.toMatch(/\bINSERT\b/i);
      expect(diagnosticSql).not.toMatch(/\bDELETE\b/i);
      expect(diagnosticSql).toMatch(/SELECT/i);
    });
  });
});
