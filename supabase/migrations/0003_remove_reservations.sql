-- Retira la funcionalidad histórica de reservas de Brisas del Sinú.
-- Se aplica después de 0001_initial.sql y 0002_auth_security_foundation.sql.

begin;

drop policy if exists reservations_own_read on public.reservations;
drop policy if exists reservations_staff_read on public.reservations;
drop policy if exists reservations_staff_update on public.reservations;
revoke all on table public.reservations from public, anon, authenticated, service_role;
drop index if exists public.idx_reservations_branch_date;
drop table if exists public.reservations;

-- 0001 solo creó esta tabla junto con las reservas y no existe ninguna
-- referencia desde la aplicación a capacidad de mesas para ventas o domicilios.
drop policy if exists tables_staff_all on public.tables_capacity;
revoke all on table public.tables_capacity from public, anon, authenticated, service_role;
drop table if exists public.tables_capacity;

alter table public.branches drop column if exists reservations_enabled;

-- Ya no quedan policies que dependan de los helpers históricos de 0001.
drop function if exists public.is_staff();
drop function if exists public.can_edit_menu();

commit;
