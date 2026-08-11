/**
 * Runner de verificación (usado cuando la shell interactiva no está
 * disponible): ejecuta typecheck, lint, unitarias y la suite E2E completa
 * con build, y escribe el resumen en references/analysis/reports/verify.log.
 *
 * Uso: node scripts/verify-motion.mjs [--skip-e2e]
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const LOG = "references/analysis/reports/verify.log";
const skipE2e = process.argv.includes("--skip-e2e");

mkdirSync(dirname(LOG), { recursive: true });
writeFileSync(LOG, `verify-motion ${new Date().toISOString()}\n\n`);

function run(label, command, args) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  const tail = (result.stdout + "\n" + result.stderr)
    .split("\n")
    .filter(Boolean)
    .slice(-25)
    .join("\n");
  appendFileSync(
    LOG,
    `=== ${label} · exit=${result.status} · ${seconds}s ===\n${tail}\n\n`,
  );
  console.log(`${label}: exit=${result.status} (${seconds}s)`);
  return result.status ?? 1;
}

const results = {};
results.tsc = run("typecheck", "npx", ["tsc", "--noEmit"]);
results.lint = run("lint", "npx", ["eslint", "."]);
results.unit = run("unit", "npx", ["vitest", "run"]);
if (!skipE2e) {
  results.build = run("build", "npm", ["run", "build"]);
  if (results.build === 0) {
    results.e2e = run("e2e", "npx", ["playwright", "test"]);
  }
}

appendFileSync(LOG, `RESUMEN: ${JSON.stringify(results)}\n`);
console.log("RESUMEN:", JSON.stringify(results));
process.exit(Object.values(results).some((code) => code !== 0) ? 1 : 0);
