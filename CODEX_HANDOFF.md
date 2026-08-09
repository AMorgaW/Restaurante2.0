# Brisas del Sinú — Codex Handoff

Compact orientation for a new agent. Full operational detail lives in `AGENTS.md`.
Code, migrations and tests beat documentation when they disagree.

## Product

Brisas del Sinú is a **responsive web system** (URL in a browser on phone, tablet, desktop).
It is **not** a native app, APK/IPA, Play/App Store product, or mandatory installable PWA.
`InstallPwaPrompt` must not be promoted in product UI (legacy component may remain for `/visual-lab` only).
A legacy service worker may exist; installation is **not** a requirement.
Sales: local/table, pickup, delivery. **No reservations.**

## Current gate

| Stage | Status |
|---|---|
| 11B-1…11B-7 | **CLOSED** |
| 11C-1 precheck | **CLOSED** |
| 11C-2 technical regression | **CLOSED** |
| 11C-3 real restaurant flows | **CLOSED** |
| 11C-4 | **PENDING** |
| Compuerta B | **PENDING** (not started) |

Next task for Codex: **independent pre-11C-4 audit** (read-only unless a new CRITICAL/HIGH needs directed proof).

## Git baseline

- Branch: `master`
- Functional baseline before documentation sync: `79ebd2b` — `test: estabiliza regresion e2e preproduccion`
- For current documentation-sync HEAD: run `git log -1 --oneline` (do not hardcode the docs commit hash here)

## Local/remote migration state

| Scope | Versions |
|---|---|
| Files on disk (local) | `0001`–`0014` |
| Local DB expected | through `0014` |
| Remote documented | `0001`–`0009` |
| **Not** deployed remote | `0010`–`0014` |

No `db push`. No migration `0015`.

**Test filename ≠ migration number:**

- `supabase/tests/0014_manual_payments_dining_tables.test.sql` → tests **migration 0013** (83/83)
- `supabase/tests/0015_payment_read_models.test.sql` → tests **migration 0014** (69/69)
- Global pgTAP: **456/456**

### Local-only migrations (purpose)

| Mig | File | PURPOSE | KEY RPC/FUNCTIONS | SECURITY/INTEGRITY | Remote |
|---|---|---|---|---|---|
| 0010 | `0010_create_customer_order.sql` | Idempotent standard order create | `create_customer_order` | SECURITY DEFINER; replay before catalog; no inventory on create | NOT deployed |
| 0011 | `0011_profiles_staff_status_select_grant.sql` | Column grant for session resolver | `GRANT SELECT (staff_status)` only | No table SELECT; RLS unchanged | NOT deployed |
| 0012 | `0012_pension_orders_and_management.sql` | Pension orders + owner/admin management | `create_pension_order`, activate/renew/menu RPCs | calendar_period 30d; lunch/dinner; coupling order↔consumption | NOT deployed |
| 0013 | `0013_manual_payments_and_dining_tables.sql` | Manual payments + dining tables/QR/sessions | `create_dining_table`, `resolve_table_qr`, confirm/void RPCs | Hash-only QR; append-only ledger; Stripe dormant coexistence | NOT deployed |
| 0014 | `0014_payment_read_models.sql` | Staff read models for tables/payments | `list_dining_tables_for_staff`, `get_table_session_account`, `get_manual_payment_history` | No table-wide SELECT; no QR hash/raw | NOT deployed |

## Closed functional domains

- **11B-1** catalog (authoritative DATA_MODE + admin writes via session/RLS)
- **11B-2** orders (`create_customer_order` + checkout wired)
- **11B-3** staff order operations (optimistic status; `payment_status` read-only)
- **11B-4** inventory on `ready→delivered` (exactly-once, transactional)
- **11B-5** pensionados (SQL 0012 + web `/pensionado`, `/admin/pensionados`)
- **11B-6** mesas/QR/cobros (SQL 0013/0014 + web)
- **11B-7** in-web order alerts (polling ~15 s; no Realtime/Push)

## Critical invariants

- **DATA_MODE:** `local` = explicit demo; `supabase` = PostgreSQL only. No silent fallback/hybrid. Empty DB → empty UI; DB error → real error.
- **Inventory:** order created ≠ inventory consumed. Only valid **delivered** consumes stock (transactional, exactly-once, recipe required, no negative stock). Payment and pension benefit alone do **not** consume inventory.
- **Payment vs ops:** `payment_status` independent of `orders.status`. Valid: paid+preparing; delivered+payment pending. PAID records money; DELIVERED consumes inventory.
- **MVP payments:** `cash`, `bank_transfer`, `zero_balance` when applicable. No partial/split/arqueo/bank sync/refund ERP. **Stripe dormant.**
- **Pension:** `customer` + commercial membership (not Auth/JWT role). Plan `calendar_period`, 30 calendar days, `ends_at = starts_at + 29`. 1 lunch + 1 dinner/day (not 60 interchangeable meals). Surcharge and pension delivery fee from DB config. `/menu` normal orders do not consume benefit.
- **Tables:** `dining_table` = physical; `table_session` = account/occupation. Max one open session per table; many orders per session. Paying the account closes session → table FREE. Void does **not** reopen session. QR = opaque random token; DB stores SHA-256 only; raw only on create/rotate. Table UUID/code is not customer auth. Table QR ≠ bank QR.
- **Confirm payment:** owner/admin/manager/cashier. **Void:** owner/admin only. Append-only void (no destructive paid→pending UPDATE).
- **Alerts MVP:** in-web poll ~15 s + focus/visibility/online refetch; dedup `order.id`; baseline skips pre-existing toasts; pending = persistent signal. No Realtime / Notification API / Web Push. Closed browser → no MVP notification.
- **No reservations.** Public signup always `customer` (no role picker). No generic `employee` role.

## Roles/routes

| Who | Destination |
|---|---|
| owner / admin | `/admin` |
| manager, kitchen, cashier, editor, support (active) | `/empleado` |
| manager / editor catalog | `/empleado/catalogo` |
| customer + membership | `/pensionado` |
| customer without membership | `/cuenta` |
| inactive/suspended staff | `/cuenta` |
| anonymous | `/login` |

Canonical roles only: `owner`, `admin`, `manager`, `kitchen`, `cashier`, `editor`, `support`, `customer`.

## Data modes

- `AUTH_MODE` and `DATA_MODE` are independent.
- Demo identity only with explicit `AUTH_MODE=disabled` in development/test.
- Production Auth: only configured `AUTH_MODE=supabase` is valid.

## Latest test evidence

Source: `TEST_REPORT.md` (11C-2 / 11C-3 at functional baseline `79ebd2b`).

- pgTAP: 7 suites · **456/456** · 0 failed
- Concurrency: 28 scenarios · 36 assertions · run1 PASS · run2 PASS
- Vitest: 68 files · **552/552** · 0 skipped
- typecheck PASS · lint 0 errors / 2 known dashboard warnings · build PASS
- Official E2E `npm run test:e2e` EXIT=0: Chromium 150p/7 flaky/0 fail; WebKit 134p/6 flaky/3 skip/0 fail; desktop 3/3
- Dedicated Supabase: catalog 12 · staff 14 · dining 4 · pension 14 · alerts 8
- 11C-3: CRITICAL 0 · HIGH 0 · real mesa/pension/normal flows approved

## Known non-blocking issues

- E2E cold-login / long-suite flakes (MEDIUM; environment/tooling)
- Local Auth sensitivity after rapid `db reset` (MEDIUM; environment; recovered)
- Lint: 2 `react-hooks/exhaustive-deps` warnings on dashboard (known)

## Sources of truth

1. Code / migrations / tests
2. Git
3. Scripts
4. Local DB (read-only when consulted)
5. Docs (`AGENTS.md`, this file, `DECISIONS.md`, `TEST_REPORT.md`, `references/analysis/POSTGRESQL_SECURITY_MODEL.md`)

Graphify (`graphify-out/`, gitignored): auxiliary map. Canonical refresh: `graphify update .`. Latest regen metrics: **2622 nodes · 6979 edges · 181 communities**. Always verify against code.

Project-scoped Codex custom agents may exist under `.codex/agents/` (gitignored): security, PostgreSQL, architecture, payments, QA, UI/UX, accessibility, performance. Do **not** modify them in a docs sync.

## Forbidden remote operations

Without explicit authorization: `supabase link`, `supabase db push`, `--linked`, remote MCP writes, production changes, `git push`, deploy, Compuerta B, creating users, requesting secrets. Never publish `.env.local`, keys, tokens, JWT, cookies, or `.codex/` contents.

## Files worth reading first

1. `AGENTS.md`
2. `CODEX_HANDOFF.md` (this file)
3. `DECISIONS.md` (canonical D-001…D-018 index + history)
4. `TEST_REPORT.md` (11C evidence)
5. `references/analysis/POSTGRESQL_SECURITY_MODEL.md`
6. `references/analysis/PENSIONADOS_BUSINESS_RULES.md`
7. Target code under `src/`, `supabase/migrations/`, `supabase/tests/`, `tests/`

## What NOT to rerun automatically

Do **not** rerun full regression automatically during a read-only audit unless a new CRITICAL/HIGH requires directed proof.
That means: no automatic full pgTAP/concurrency/Vitest/Playwright/build marathon “just to reconfirm.”

## Next task: independent pre-11C-4 audit

Read-only multiagent audit against the documented baseline. Do not start 11C-4 or Compuerta B from this handoff alone.
