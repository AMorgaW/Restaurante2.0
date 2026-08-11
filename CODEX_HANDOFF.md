# Brisas del Sinú — Codex Handoff

Orientación técnica compacta para una nueva tarea. `AGENTS.md` contiene las reglas operativas; código, migraciones y pruebas prevalecen ante cualquier discrepancia documental.

## Producto

Brisas del Sinú es un **sistema web responsive** usado por URL en móvil, tablet y escritorio. No es app nativa, APK/IPA, producto de stores ni PWA instalable obligatoria. No hay reservaciones.

Flujos comerciales: mesa/local, pickup y delivery. El checkout admite guest. Pensionado siempre es `customer` con membresía comercial, no un rol Auth.

## Estado actual

| Etapa | Estado |
|---|---|
| 11B-1…11B-7 | **CLOSED** |
| 11C-1…11C-4 | **CLOSED** |
| Compuerta B | **PENDING** (no iniciada) |

Baseline funcional completo: `79ebd2b`. Checkpoint local al iniciar la publicación documental: `c56d138` sobre `master`.

Cronología posterior al baseline:

- `4189559`: sincronización documental preauditoría.
- auditoría 11C read-only: CRITICAL 0; detectó un HIGH en el formulario pensionado.
- `d365ee4`: cerró el HIGH con formulario/validación accesibles y prueba componente dirigida.
- `56c82a1`: corrigió la regresión post-gate de soft navigation/dead clicks con cargas completas en los puntos afectados.
- `46ab302`…`a8b3850`: refinamiento Admin local; marca Brisas del Sinú, nav scroller, campana de pendientes, progressive disclosure, filtros de inventario, presentación de pensionados y UI de una sede.
- `18243c0` / `c56d138`: documentación y Graphify post-Admin.

El cierre 11C no significa que la regresión completa se haya repetido después de cada cambio: la evidencia completa pertenece a `79ebd2b`; los cambios posteriores tuvieron validación dirigida documentada en `TEST_REPORT.md`.

## Estado local

- `.env.local`: ausente al iniciar esta publicación.
- Stack Supabase local: detenido al comprobarlo; no se inició ni se reseteó.
- Harness local sanitizado: claves desde `SUPABASE_LOCAL_*` o `supabase status -o json`; `service_role` solo en proceso Node y passwords efímeros.
- Demo visual: requiere `AUTH_MODE=disabled` + `DATA_MODE=local` explícitos en development/test.
- Graphify: salida en `graphify-out/`, ignorada por Git. Métricas de esta publicación: **GRAPHIFY_METRICS_PENDING**.

No trate residuos de E2E o `supabase/seed.sql` como dataset estable. `[db.seed].enabled = false` debe permanecer así.

## Migraciones local/remoto

| Alcance | Estado verificado |
|---|---|
| Archivos en `supabase/migrations` | `0001`–`0014` (14) |
| Base local esperada | hasta `0014` |
| Remoto documentado/aplicado | `0001`–`0009` (9) |
| No desplegadas en remoto | `0010`–`0014` (5) |

No se conectó ni modificó el remoto durante esta publicación. No crear `0015` ni ejecutar `db push`.

**Tests ≠ migraciones:**

- `supabase/tests/0014_manual_payments_dining_tables.test.sql` prueba migración `0013` (83/83).
- `supabase/tests/0015_payment_read_models.test.sql` prueba migración `0014` (69/69).
- pgTAP global vigente: 456/456.

### Local-only 0010–0014

| Migración | Propósito |
|---|---|
| `0010_create_customer_order.sql` | Pedido normal transaccional e idempotente; sin consumo al crear |
| `0011_profiles_staff_status_select_grant.sql` | Grant mínimo de columna `staff_status` |
| `0012_pension_orders_and_management.sql` | Pedidos/membresías pensionado y coupling order↔consumption |
| `0013_manual_payments_and_dining_tables.sql` | Mesas, QR hash-only, sesiones y ledger de cobro manual |
| `0014_payment_read_models.sql` | Read models staff sin SELECT table-wide ni QR sensible |

## Dominios cerrados

- Catálogo autoritativo por `DATA_MODE` y administración vía sesión/RLS.
- Pedidos normales mediante `create_customer_order`.
- Operación staff con transición optimista y autoridad PostgreSQL.
- Inventario en `ready→delivered`, transaccional y exactly-once.
- Pensionados mediante SQL `0012` y UI web.
- Mesas/QR/cobros mediante SQL `0013`/`0014` y UI web.
- Avisos internos mediante polling ~15 s, sin Realtime/Web Push.
- Admin responsive de una sede, conservando el backend multi-sucursal y dominio de promociones.

## Invariantes críticas

- `DATA_MODE=local` = demo explícito; `supabase` = PostgreSQL sin fallback/hybrid.
- Crear, pagar o consumir beneficio no descuenta inventario. Solo `delivered` consume stock con receta activa, sin saldo negativo y exactamente una vez.
- `payment_status` y `orders.status` son ejes independientes. MVP manual: `cash`, `bank_transfer`, `zero_balance`; Stripe dormido.
- `dining_table` ≠ `table_session`; una sesión abierta por mesa, muchos pedidos por sesión, pago cierra sesión y libera mesa; void no la reabre.
- QR de mesa ≠ QR bancario. Token impredecible; DB conserva SHA-256; raw solo create/rotate.
- Pensionado = customer + membresía. `calendar_period`, 30 días inclusivos, 1 lunch + 1 dinner/día; surcharge y fee desde DB.
- Registro público siempre `customer`; no existe rol `employee`.

## Roles y destinos

| Identidad | Destino |
|---|---|
| owner / admin | `/admin` |
| manager / kitchen / cashier / editor / support activos | `/empleado` |
| manager / editor (catálogo) | `/empleado/catalogo` |
| customer con membresía | `/pensionado` |
| customer sin membresía | `/cuenta` |
| staff inactive/suspended | `/cuenta` |
| anónimo | `/login` |

## Evidencia vigente

Validación completa histórica en `79ebd2b`:

- pgTAP: 7 suites, 456/456.
- Concurrencia: 28 escenarios, 36 aserciones, PASS ×2.
- Vitest: 68 archivos, 552/552.
- typecheck PASS; lint 0 errores/2 warnings conocidos; build PASS.
- Playwright oficial EXIT=0: Chromium 150 passed/7 flaky; WebKit 134 passed/6 flaky/3 skipped; desktop 3/3.
- Flujos reales mesa, pensión y pedido normal aprobados; CRITICAL 0/HIGH 0 al cierre.

Validación posterior dirigida:

- formulario pensionado y accesibilidad tras `d365ee4`;
- interactividad/navegación tras `56c82a1`;
- Admin: typecheck, lint de archivos tocados, Vitest dirigido y browser desktop/móvil/teclado/reduced-motion. No hubo full E2E, pgTAP, concurrencia ni reset por el refinamiento Admin.

## Pendientes reales

1. **EMPLOYEE CREATION AUTH BLOCKER:** no existe vía segura de invite/create Auth desde producto. `/admin/empleados` muestra el formulario, explica el bloqueo y mantiene submit deshabilitado; no simular el alta con Zustand.
2. **CUSTOMER PHASE:** delivery ya recoge dirección, teléfono y referencia opcional. Sigue diferida la selección real de forma de pago customer; pickup y mesa no requieren dirección.
3. **Compuerta B:** pendiente. No iniciar Auth remoto, bootstrap, migraciones, deploy ni cambios de producción desde este handoff.
4. **PUBLICATION REVIEW REQUIRED:** el historial anterior conserva credenciales locales retiradas y este host no tiene `git-filter-repo`/BFG. El MP4 de referencia y 265 derivados no tienen licencia/procedencia redistribuible documentada; no publicar hasta resolver ambos puntos.

## Seguridad operativa

- Sin autorización explícita: no `supabase link`, `db push`, `--linked`, escrituras remotas, deploy ni `git push`.
- Nunca publicar `.env.local`, secretos, tokens, JWT, cookies, `.codex/`, logs, artefactos de prueba ni `graphify-out/`.
- Resets solo locales, intencionales y con `supabase db reset --local --no-seed`.
- `test:db` y `test:db:concurrency` se ejecutan en serie.
- No repetir la regresión completa automáticamente en una auditoría read-only salvo CRITICAL/HIGH nuevo que requiera prueba dirigida.

## Lectura recomendada

1. `AGENTS.md`
2. `CODEX_HANDOFF.md`
3. `DECISIONS.md`
4. `TEST_REPORT.md`
5. `references/analysis/POSTGRESQL_SECURITY_MODEL.md`
6. código/migraciones/pruebas directamente relacionados

Graphify es solo un mapa auxiliar; contraste siempre con código y SQL.
