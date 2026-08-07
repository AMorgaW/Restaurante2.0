import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const runbook = readFileSync(
  resolve(process.cwd(), "references/runbooks/FIRST_OWNER_BOOTSTRAP.md"),
  "utf8",
);

const REAL_EMAIL = /[a-z0-9._%+-]+@(?:gmail|yahoo|hotmail|outlook|icloud)\.[a-z]{2,}/i;

const FORBIDDEN_SQL_OPS = [
  "UPDATE",
  "INSERT",
  "DELETE",
  "MERGE",
  "CALL",
  "DO",
  "EXECUTE",
  "COMMIT",
  "BEGIN",
  "ROLLBACK",
  "CREATE",
  "ALTER",
  "DROP",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  "COPY",
  "LOCK",
] as const;

/** Extrae una sección Markdown hasta el siguiente encabezado del mismo nivel o superior. */
export function extractMarkdownSection(doc: string, headingLine: string): string {
  const start = doc.indexOf(headingLine);
  if (start < 0) throw new Error(`Encabezado no encontrado: ${headingLine}`);
  const levelMatch = /^(#{1,6})\s/.exec(headingLine);
  const hashes = levelMatch?.[1];
  const level = hashes?.length ?? 2;
  const afterHeading = doc.slice(start + headingLine.length);
  const nextHeading = new RegExp(`\\n#{1,${level}}\\s`);
  const next = afterHeading.search(nextHeading);
  return next < 0
    ? doc.slice(start)
    : doc.slice(start, start + headingLine.length + next);
}

/** Todos los bloques fenced ```sql (no solo el primero). */
export function extractSqlFencedBlocks(section: string): string[] {
  const blocks: string[] = [];
  const fence = /```sql\b([^\n]*)\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(section)) !== null) {
    const body = match[2];
    if (body !== undefined) blocks.push(body);
  }
  return blocks;
}

/** Neutraliza comentarios y literales para evitar falsos positivos. */
export function neutralizeSqlForAnalysis(sql: string): string {
  let out = sql.replace(/\/\*[\s\S]*?\*\//g, " ");
  out = out.replace(/--[^\n]*/g, " ");
  out = out.replace(/'(?:''|[^'])*'/g, "''");
  out = out.replace(/"(?:""|[^"])*"/g, '""');
  return out;
}

function forbiddenOpsIn(sqlBody: string): string[] {
  const normalized = neutralizeSqlForAnalysis(sqlBody);
  return FORBIDDEN_SQL_OPS.filter((op) => new RegExp(`\\b${op}\\b`, "i").test(normalized));
}

function hasModifyingCte(normalized: string): boolean {
  return /\bwith\b[\s\S]*?\bas\s*\(\s*(?:delete|update|insert|merge)\b/i.test(normalized);
}

function hasMultipleExecutableStatements(normalized: string): boolean {
  const body = normalized.replace(/;\s*$/u, "").trim();
  return /;/.test(body);
}

function startsWithSelectOrWith(normalized: string): boolean {
  return /^\s*(?:select|with)\b/i.test(normalized);
}

/** Devuelve violaciones; vacío = contrato read-only cumplido. */
export function readOnlyRevertSqlViolations(sqlBody: string): string[] {
  const violations: string[] = [];
  const normalized = neutralizeSqlForAnalysis(sqlBody);

  if (!startsWithSelectOrWith(normalized)) {
    violations.push("must_start_with_select_or_with");
  }
  if (!/\bselect\b/i.test(normalized)) {
    violations.push("missing_select");
  }
  if (hasModifyingCte(normalized)) {
    violations.push("modifying_cte");
  }
  if (hasMultipleExecutableStatements(normalized)) {
    violations.push("multiple_statements");
  }

  for (const op of forbiddenOpsIn(sqlBody)) {
    violations.push(`forbidden:${op}`);
  }

  if (!/\bOWNER_USER_ID_HERE\b/.test(sqlBody)) {
    violations.push("missing_OWNER_USER_ID_HERE");
  }
  if (!/\bBOOTSTRAP_AUDIT_KEY_HERE\b/.test(sqlBody)) {
    violations.push("missing_BOOTSTRAP_AUDIT_KEY_HERE");
  }
  if (/reversi[oó]n\s+es\s+segura|safe\s+to\s+revert/i.test(sqlBody)) {
    violations.push("concludes_revert_is_safe");
  }

  return violations;
}

/** Valida todos los bloques SQL de una sección de reversión. */
export function readOnlyRevertSectionViolations(section: string): string[] {
  const blocks = extractSqlFencedBlocks(section);
  if (blocks.length === 0) return ["no_sql_blocks"];
  const violations: string[] = [];
  if (blocks.length !== 1) {
    violations.push(`unexpected_sql_block_count:${blocks.length}`);
  }
  blocks.forEach((block, index) => {
    for (const v of readOnlyRevertSqlViolations(block)) {
      violations.push(`block[${index}]:${v}`);
    }
  });
  return violations;
}

function sectionBetween(startHeading: string, endHeading: string | null): string {
  const start = runbook.indexOf(startHeading);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = endHeading ? runbook.indexOf(endHeading, start + 1) : runbook.length;
  expect(end).toBeGreaterThan(start);
  return runbook.slice(start, end);
}

function firstSqlBlock(section: string): string {
  const blocks = extractSqlFencedBlocks(section);
  expect(blocks.length).toBeGreaterThanOrEqual(1);
  return blocks[0]!;
}

const VALID_WITH_SELECT = `
-- DIAGNÓSTICO (solo SELECT). No concluye que la reversión sea segura.
with params as (
  select
    'OWNER_USER_ID_HERE'::uuid as profile_id,
    btrim('BOOTSTRAP_AUDIT_KEY_HERE') as audit_key
)
select p.id, p.role
from public.profiles p
join params x on x.profile_id = p.id;
`.trim();

describe("helpers read-only del diagnóstico de reversión", () => {
  it("acepta un WITH…SELECT read-only válido", () => {
    expect(readOnlyRevertSqlViolations(VALID_WITH_SELECT)).toEqual([]);
  });

  it.each([
    ["UPDATE", "update public.profiles set role = 'customer' where id = 'OWNER_USER_ID_HERE';"],
    ["INSERT", "insert into public.profiles (id) values ('OWNER_USER_ID_HERE');"],
    ["DELETE", "delete from public.profiles where id = 'OWNER_USER_ID_HERE';"],
    ["MERGE", "merge into public.profiles t using (select 1) s on true when matched then update set role = 'x';"],
    ["CALL", "call public.some_proc('OWNER_USER_ID_HERE');"],
    ["DO", "do $$ begin null; end $$;"],
    ["EXECUTE", "execute 'select 1';"],
    ["COMMIT", "select 1; commit;"],
  ] as const)("rechaza %s", (op, fragment) => {
    const sql = `${fragment}\n-- OWNER_USER_ID_HERE BOOTSTRAP_AUDIT_KEY_HERE`;
    const violations = readOnlyRevertSqlViolations(sql);
    expect(violations.some((v) => v === `forbidden:${op}` || v.startsWith("forbidden:"))).toBe(true);
  });

  it("rechaza CTE modificador con DELETE", () => {
    const sql = `
with x as (
  delete from public.profiles where id = 'OWNER_USER_ID_HERE'::uuid returning id
)
select * from x;
-- BOOTSTRAP_AUDIT_KEY_HERE
`.trim();
    expect(readOnlyRevertSqlViolations(sql)).toEqual(
      expect.arrayContaining(["modifying_cte", "forbidden:DELETE"]),
    );
  });

  it("rechaza múltiples sentencias cuando la segunda escribe", () => {
    const sql = `
select 1 as ok;
update public.profiles set role = 'customer' where id = 'OWNER_USER_ID_HERE';
-- BOOTSTRAP_AUDIT_KEY_HERE
`.trim();
    expect(readOnlyRevertSqlViolations(sql)).toEqual(
      expect.arrayContaining(["multiple_statements", "forbidden:UPDATE"]),
    );
  });

  it("rechaza un segundo bloque SQL con UPDATE en la sección", () => {
    const section = `
## D. REVERSIÓN EXTRAORDINARIA — REVISIÓN MANUAL OBLIGATORIA
\`\`\`sql
${VALID_WITH_SELECT}
\`\`\`
\`\`\`sql
update public.profiles set role = 'customer' where id = 'OWNER_USER_ID_HERE';
-- BOOTSTRAP_AUDIT_KEY_HERE
\`\`\`
`;
    const violations = readOnlyRevertSectionViolations(section);
    expect(violations).toEqual(
      expect.arrayContaining([
        "unexpected_sql_block_count:2",
        expect.stringMatching(/block\[1\]:forbidden:UPDATE/),
      ]),
    );
  });

  it("ignora palabras prohibidas solo dentro de comentarios", () => {
    const sql = `
-- Never UPDATE INSERT DELETE MERGE CALL DO EXECUTE COMMIT BEGIN
with params as (
  select 'OWNER_USER_ID_HERE'::uuid as id, 'BOOTSTRAP_AUDIT_KEY_HERE' as k
)
select * from params;
`.trim();
    expect(readOnlyRevertSqlViolations(sql)).toEqual([]);
  });
});

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
    const revertHeading = "## D. REVERSIÓN EXTRAORDINARIA — REVISIÓN MANUAL OBLIGATORIA";
    const revert = extractMarkdownSection(runbook, revertHeading);

    it("exige placeholders UUID y clave de auditoría", () => {
      expect(revert).toMatch(/OWNER_USER_ID_HERE/);
      expect(revert).toMatch(/BOOTSTRAP_AUDIT_KEY_HERE/);
    });

    it("declara revisión manual obligatoria y no automática", () => {
      expect(revert).toMatch(/REVISIÓN MANUAL OBLIGATORIA/);
      expect(revert).toMatch(/Reversión automática no segura/);
      expect(revert).toMatch(/revisión manual completa/i);
    });

    it("inspecciona todos los bloques SQL como estrictamente read-only", () => {
      const blocks = extractSqlFencedBlocks(revert);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks).toHaveLength(1);
      expect(readOnlyRevertSectionViolations(revert)).toEqual([]);
      for (const block of blocks) {
        expect(readOnlyRevertSqlViolations(block)).toEqual([]);
        expect(block).toMatch(/solo\s+SELECT/i);
        expect(block).toMatch(/No concluye que la reversi[oó]n sea segura/i);
      }
    });

    it("no contiene UPDATE public.profiles ni operaciones de escritura en prosa ejecutable de SQL", () => {
      expect(revert).not.toMatch(/UPDATE\s+public\.profiles/i);
      const blocks = extractSqlFencedBlocks(revert);
      for (const block of blocks) {
        expect(forbiddenOpsIn(block)).toEqual([]);
      }
    });
  });
});
