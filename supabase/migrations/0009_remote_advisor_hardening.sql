-- Endurecimiento a partir de los asesores remotos posteriores al despliegue.
-- Append-only: no edita 0001-0008. Solo añade índices de cobertura con
-- justificación concreta y consolida políticas SELECT permisivas duplicadas
-- conservando exactamente la semántica de acceso.
-- No toca payment_webhook_events (deny-by-default intencional), no elimina
-- índices reportados como no usados (base sin tráfico) y no crea roles/tablas.

begin;

-- 1) Índices de cobertura para claves foráneas con acceso remoto real.
--    Solo se indexan FKs usadas por RLS o por rutas de lectura expuestas por
--    el Data API (catálogo público y pedidos propios). Las FKs que apuntan a
--    actores de auditoría (activated_by, finalized_by, authorized_by,
--    reversed_by, resolved_by, published_by, actor_profile_id) y a padres que
--    solo se desactivan lógicamente (nunca DELETE físico) no se indexan aquí:
--    su beneficio es nulo sin tráfico y su escritura tiene costo permanente.

-- RLS `orders_own_or_staff_read` filtra `user_id = auth.uid()`; es la ruta de
-- "mis pedidos" de todo customer autenticado (SELECT concedido a authenticated).
create index if not exists orders_user_id_idx on public.orders (user_id);

-- Catálogo público: la ficha de producto carga modificadores por producto y sus
-- opciones por grupo (SELECT concedido a anon/authenticated).
create index if not exists modifier_groups_menu_item_idx on public.modifier_groups (menu_item_id);
create index if not exists modifier_options_group_idx on public.modifier_options (modifier_group_id);

-- Catálogo público: la fusión de precios/disponibilidad por sucursal une
-- menu_items → branch_menu_items por menu_item_id (la PK compuesta lidera con
-- branch_id, así que la búsqueda por producto no está cubierta).
create index if not exists branch_menu_items_menu_item_idx on public.branch_menu_items (menu_item_id);

-- 1b) Corrección de permiso surgida al validar la consolidación (defecto
--     preexistente, no introducido aquí): las policies `profiles` y
--     `pension_plans` invocan `private.current_role()` directamente, pero esa
--     función carecía de EXECUTE para `authenticated` (solo se concedieron los
--     helpers `can_*`). Sin este grant, cualquier lectura autenticada de esas
--     tablas falla con "permission denied for function current_role". El grant
--     es neutral en seguridad: `current_role()` devuelve solo el rol del propio
--     llamante (su fila) y no amplía el acceso a filas de ninguna policy.
grant execute on function private.current_role() to authenticated;

-- 2) Consolidación de políticas SELECT permisivas duplicadas.
--    Antes: una policy pública (anon+authenticated) y una de personal
--    (authenticated) coexistían -> para authenticated se evaluaban dos policies
--    permisivas OR. Ahora: la pública queda solo para anon y una única policy
--    para authenticated combina `público OR personal`. Semántica idéntica:
--    anon ve solo lo público; authenticated ve lo mismo que antes (unión).

-- banners
drop policy if exists banners_public_read on public.banners;
drop policy if exists banners_staff_read on public.banners;
create policy banners_public_read on public.banners for select to anon
  using (active = true);
create policy banners_read on public.banners for select to authenticated
  using (active = true or private.can_manage_marketing());

-- promotions
drop policy if exists promotions_public_read on public.promotions;
drop policy if exists promotions_staff_read on public.promotions;
create policy promotions_public_read on public.promotions for select to anon
  using (active = true);
create policy promotions_read on public.promotions for select to authenticated
  using (active = true or private.can_manage_marketing());

-- pension_plans
drop policy if exists pension_plans_public_read on public.pension_plans;
drop policy if exists pension_plans_staff_read on public.pension_plans;
create policy pension_plans_public_read on public.pension_plans for select to anon
  using (is_active);
create policy pension_plans_read on public.pension_plans for select to authenticated
  using (is_active or private.current_role() in ('owner', 'admin', 'manager'));

-- pension_menus
drop policy if exists pension_menus_public_read on public.pension_menus;
drop policy if exists pension_menus_staff_read on public.pension_menus;
create policy pension_menus_public_read on public.pension_menus for select to anon
  using (status = 'published');
create policy pension_menus_read on public.pension_menus for select to authenticated
  using (status = 'published' or private.can_read_pension_admin(branch_id));

-- pension_menu_categories
drop policy if exists pension_menu_categories_public_read on public.pension_menu_categories;
drop policy if exists pension_menu_categories_staff_read on public.pension_menu_categories;
create policy pension_menu_categories_public_read on public.pension_menu_categories for select to anon
  using (exists (
    select 1 from public.pension_menus m where m.id = menu_id and m.status = 'published'
  ));
create policy pension_menu_categories_read on public.pension_menu_categories for select to authenticated
  using (exists (
    select 1 from public.pension_menus m
    where m.id = menu_id
      and (m.status = 'published' or private.can_read_pension_admin(m.branch_id))
  ));

-- pension_menu_items
drop policy if exists pension_menu_items_public_read on public.pension_menu_items;
drop policy if exists pension_menu_items_staff_read on public.pension_menu_items;
create policy pension_menu_items_public_read on public.pension_menu_items for select to anon
  using (exists (
    select 1 from public.pension_menu_categories c
    join public.pension_menus m on m.id = c.menu_id
    where c.id = menu_category_id and m.status = 'published'
  ));
create policy pension_menu_items_read on public.pension_menu_items for select to authenticated
  using (exists (
    select 1 from public.pension_menu_categories c
    join public.pension_menus m on m.id = c.menu_id
    where c.id = menu_category_id
      and (m.status = 'published' or private.can_read_pension_admin(m.branch_id))
  ));

-- profiles (sin policy anon: no hay grant Data API para anon)
drop policy if exists profiles_own_read on public.profiles;
drop policy if exists profiles_staff_admin_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.current_role() in ('owner', 'admin'));

commit;
