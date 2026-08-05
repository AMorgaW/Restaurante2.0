import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/0002_auth_security_foundation.sql"), "utf8");
const removal = readFileSync(resolve(process.cwd(), "supabase/migrations/0003_remove_reservations.sql"), "utf8");

function functionBody(name: string): string {
  const match = migration.match(new RegExp(`create or replace function private\\.${name}\\([^]*?\\$\\$;`, "i"));
  if (!match) throw new Error(`No se encontro private.${name}`);
  return match[0];
}

describe("migracion 0002 de seguridad", () => {
  it("prevalida branch_id y crea la FK solo despues de una conversion explicita", () => {
    expect(migration).toMatch(/empty_count/);
    expect(migration).toMatch(/format_count/);
    expect(migration).toMatch(/missing_count/);
    expect(migration).toMatch(/alter column branch_id type uuid using pg_catalog\.btrim\(branch_id\)::uuid/);
    expect(migration.indexOf("missing_count")).toBeLessThan(migration.indexOf("alter column branch_id type uuid"));
    expect(migration).toMatch(/foreign key \(branch_id\) references public\.branches \(id\) on delete restrict/);
  });

  it("crea customer incondicional y aborta cualquier conflicto de perfil", () => {
    const body = functionBody("handle_new_user");
    expect(body).toContain("values (new.id, new.email, 'customer')");
    expect(body).not.toMatch(/raw_user_meta_data|user_metadata|app_metadata|on conflict/i);
    expect(body).toMatch(/when unique_violation/);
    expect(body).toMatch(/alta cancelada/);
  });

  it("elimina helpers publicos y mantiene helpers SECURITY DEFINER en private con search_path vacio", () => {
    expect(migration).not.toMatch(/create or replace function public\.(?:is_staff|can_edit_menu)/);
    expect(migration).toMatch(/drop function if exists public\.is_staff\(\)/);
    expect(migration).toMatch(/drop function if exists public\.can_edit_menu\(\)/);
    for (const name of ["current_role", "has_branch_access", "can_manage_configuration", "can_manage_catalog", "can_read_orders"]) {
      expect(functionBody(name)).toMatch(/security definer/);
      expect(functionBody(name)).toMatch(/set search_path = ''/);
    }
    expect(migration).toMatch(/revoke all on all functions in schema private from public, anon, authenticated, service_role/);
  });

  it("separa catalogo, configuracion, operacion y marketing", () => {
    expect(functionBody("can_manage_catalog")).toContain("'editor'");
    expect(functionBody("can_manage_configuration")).not.toContain("'editor'");
    expect(functionBody("can_manage_marketing")).not.toContain("'editor'");
    expect(functionBody("can_read_orders")).not.toContain("'editor'");
    expect(migration).toMatch(/branches_config_update[\s\S]*private\.can_manage_configuration/);
    expect(migration).toMatch(/delivery_zones_operations_update[\s\S]*private\.can_manage_branch_operations/);
    expect(migration).toMatch(/coupons_marketing_update[\s\S]*private\.can_manage_marketing/);
    expect(migration).toMatch(/promotions_marketing_update[\s\S]*private\.can_manage_marketing/);
    expect(migration).not.toMatch(/(?:restaurants|branches|delivery_zones|promotions|coupons)_[^\n]* for all/i);
  });

  it("no concede DELETE de catalogo a editor", () => {
    expect(functionBody("can_delete_catalog")).not.toContain("'editor'");
    expect(functionBody("can_delete_branch_catalog")).toContain("private.can_delete_catalog()");
    expect(migration).toMatch(/categories_catalog_delete[\s\S]*private\.can_delete_catalog/);
  });

  it("implementa la maquina de estados en un trigger BEFORE UPDATE OF status", () => {
    const body = functionBody("enforce_order_status_transition");
    expect(body).toContain("old.status");
    expect(body).toContain("new.status");
    expect(body).toContain("auth.uid()");
    expect(body).toContain("staff_branch_permissions");
    expect(body).toContain("old.branch_id");
    expect(body).toMatch(/old\.status in \('delivered', 'cancelled'\)/);
    expect(body).toMatch(/when 'kitchen'/);
    expect(body).toMatch(/when 'cashier'/);
    expect(body).not.toMatch(/when 'support'|when 'editor'/);
    expect(migration).toMatch(/before update of status on public\.orders/);
    expect(migration).toMatch(/grant update \(status\) on public\.orders/);
  });

  it("protege columnas de perfil y notificaciones mediante ACL por columna", () => {
    expect(migration).not.toMatch(/grant insert[^;]*public\.profiles/i);
    expect(migration).toMatch(/grant update \(name, phone, avatar_url, preferred_branch_id, language, marketing_consent\)/);
    expect(migration).not.toMatch(/grant update \([^)]*role[^)]*\)[^;]*profiles/i);
    expect(migration).toMatch(/grant update \(read_at\) on public\.notifications/);
    expect(migration).not.toMatch(/grant update on public\.notifications/i);
  });

  it("retira dependencias de helpers antes de que 0003 elimine reservas", () => {
    expect(migration).toMatch(/drop policy if exists reservations_own_read/);
    expect(migration).toMatch(/drop policy if exists tables_staff_all/);
    expect(removal).toMatch(/drop table if exists public\.reservations/);
    expect(removal).toMatch(/drop table if exists public\.tables_capacity/);
    expect(removal).toMatch(/drop column if exists reservations_enabled/);
  });
});
