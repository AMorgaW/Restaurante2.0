import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/0004_inventory_foundation.sql"), "utf8");

describe("migración 0004 de inventario", () => {
  it("modela insumos, recetas, ingredientes y movimientos con numeric y restricciones", () => {
    expect(migration).toMatch(/create table public\.inventory_items/);
    expect(migration).toMatch(/current_quantity numeric\(24,3\)/);
    expect(migration).toMatch(/check \(current_quantity >= 0\)/);
    expect(migration).toMatch(/create table public\.recipes/);
    expect(migration).toMatch(/create table public\.recipe_items/);
    expect(migration).toMatch(/primary key \(recipe_id, inventory_item_id\)/);
    expect(migration).toMatch(/create table public\.inventory_movements/);
    expect(migration).toMatch(/unique \(branch_id, inventory_item_id, idempotency_key\)/);
    expect(migration).toMatch(/balance_after = balance_before \+ quantity_delta/);
  });

  it("mantiene helpers privados, RLS y ausencia de grants de escritura a clientes", () => {
    expect(migration).toMatch(/set search_path = ''/);
    expect(migration).toMatch(/revoke all on all functions in schema private from public, anon, authenticated, service_role/);
    expect(migration).toMatch(/alter table public\.inventory_items enable row level security/);
    expect(migration).toMatch(/alter table public\.recipes enable row level security/);
    expect(migration).toMatch(/alter table public\.inventory_movements enable row level security/);
    expect(migration).toMatch(/grant select on public\.inventory_items, public\.recipes, public\.recipe_items, public\.inventory_movements to authenticated/);
    expect(migration).toMatch(/revoke insert, update, delete on public\.inventory_items, public\.recipes, public\.recipe_items, public\.inventory_movements from anon, authenticated/);
  });

  it("integra entrega y consumo en la misma transacción con idempotencia y reversión", () => {
    expect(migration).toMatch(/create or replace function private\.consume_order_inventory/);
    expect(migration).toMatch(/if exists \(select 1 from public\.inventory_movements m where m\.order_id = target_order and m\.movement_type = 'consumption'\)/);
    expect(migration).toMatch(/products? sin receta activa|productos sin receta activa/i);
    expect(migration).toMatch(/create or replace function private\.reverse_inventory_consumption/);
    expect(migration).toMatch(/reversal_of_movement_id/);
    expect(migration).toMatch(/if new\.status = 'delivered' then perform private\.consume_order_inventory/);
    expect(migration).toMatch(/prevent_recipe_ingredient_deactivation/);
  });
});
