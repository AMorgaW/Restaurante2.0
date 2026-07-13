-- ============================================================
-- Restaurante 2.0 — Esquema inicial (PostgreSQL / Supabase)
-- Ejecutar con: supabase db push  (o desde el SQL editor)
-- Incluye Row Level Security para todas las tablas.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Núcleo ------------------------------------------------

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  logo_url text,
  currency text not null default 'COP',
  timezone text not null default 'America/Bogota',
  default_language text not null default 'es',
  phone text,
  email text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  name text not null,
  slug text not null,
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  phone text,
  whatsapp text,
  email text,
  timezone text not null default 'America/Bogota',
  pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default false,
  reservations_enabled boolean not null default true,
  delivery_fee integer not null default 0,
  delivery_area_note text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  unique (restaurant_id, slug)
);

create table if not exists opening_hours (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opening_time time,
  closing_time time,
  is_closed boolean not null default false,
  unique (branch_id, day_of_week)
);

create table if not exists special_hours (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches (id) on delete cascade,
  date date not null,
  opening_time time,
  closing_time time,
  is_closed boolean not null default false,
  reason text,
  unique (branch_id, date)
);

-- ---------- Menú --------------------------------------------------

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants (id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  display_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists menu_items (
  id text primary key, -- slug estable generado desde el archivo de imagen
  restaurant_id uuid references restaurants (id) on delete cascade,
  category_slug text not null references categories (slug),
  slug text not null unique,
  name text not null,
  short_name text,
  short_description text,
  description text,
  base_price integer not null check (base_price >= 0),
  available boolean not null default true,
  featured boolean not null default false,
  tags text[] default '{}',
  ingredients text[],
  allergens text[],
  preparation_minutes integer check (preparation_minutes > 0),
  calories integer check (calories > 0),
  display_order integer not null default 0,
  image_path text not null,
  image_width integer,
  image_height integer,
  image_blur_data_url text,
  original_filename text,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now()
);

create table if not exists branch_menu_items (
  branch_id uuid not null references branches (id) on delete cascade,
  menu_item_id text not null references menu_items (id) on delete cascade,
  price integer check (price >= 0),
  available boolean not null default true,
  stock integer,
  primary key (branch_id, menu_item_id)
);

create table if not exists dietary_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

create table if not exists allergens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

create table if not exists modifier_groups (
  id text primary key,
  menu_item_id text not null references menu_items (id) on delete cascade,
  name text not null,
  minimum_selections integer not null default 0,
  maximum_selections integer not null default 1,
  required boolean not null default false,
  display_order integer not null default 0
);

create table if not exists modifier_options (
  id text primary key,
  modifier_group_id text not null references modifier_groups (id) on delete cascade,
  name text not null,
  additional_price integer not null default 0 check (additional_price >= 0),
  available boolean not null default true,
  display_order integer not null default 0
);

-- ---------- Personas ----------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text,
  phone text,
  avatar_url text,
  preferred_branch_id uuid references branches (id),
  language text not null default 'es',
  marketing_consent boolean not null default false,
  role text not null default 'customer'
    check (role in ('customer', 'owner', 'admin', 'manager', 'kitchen', 'cashier', 'editor', 'support')),
  created_at timestamptz not null default now()
);

create table if not exists staff_branch_permissions (
  profile_id uuid not null references profiles (id) on delete cascade,
  branch_id uuid not null references branches (id) on delete cascade,
  primary key (profile_id, branch_id)
);

create table if not exists favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  menu_item_id text not null references menu_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, menu_item_id)
);

-- ---------- Comercio ----------------------------------------------

create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  session_id text,
  branch_id uuid references branches (id),
  fulfillment_type text check (fulfillment_type in ('pickup', 'delivery')),
  status text not null default 'open' check (status in ('open', 'converted', 'abandoned')),
  created_at timestamptz not null default now()
);

create table if not exists cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts (id) on delete cascade,
  menu_item_id text not null references menu_items (id),
  quantity integer not null check (quantity between 1 and 99),
  unit_price_snapshot integer not null,
  notes text
);

create table if not exists cart_item_modifiers (
  cart_item_id uuid not null references cart_items (id) on delete cascade,
  modifier_option_id text not null references modifier_options (id),
  price_snapshot integer not null default 0,
  primary key (cart_item_id, modifier_option_id)
);

create table if not exists orders (
  id uuid primary key,
  order_number text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  branch_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled')),
  payment_method text not null default 'demo',
  payment_reference text,
  fulfillment_type text not null check (fulfillment_type in ('pickup', 'delivery')),
  subtotal integer not null,
  discount integer not null default 0,
  tax integer not null default 0,
  service_fee integer not null default 0,
  delivery_fee integer not null default 0,
  tip integer not null default 0,
  total integer not null,
  currency text not null default 'COP',
  coupon_code text,
  scheduled_at timestamptz,
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  address_snapshot jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  menu_item_id text not null,
  name_snapshot text not null,
  unit_price integer not null,
  quantity integer not null check (quantity between 1 and 99),
  modifiers_snapshot jsonb not null default '[]',
  notes text,
  total integer not null
);

create table if not exists reservations (
  id uuid primary key,
  branch_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  customer_name text not null,
  phone text not null,
  email text not null,
  date date not null,
  time time not null,
  party_size integer not null check (party_size between 1 and 50),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled')),
  occasion text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- Marketing y operaciones --------------------------------

create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  badge text,
  item_slug text references menu_items (slug),
  coupon_code text,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz
);

create table if not exists coupons (
  code text primary key,
  type text not null check (type in ('percent', 'fixed')),
  value integer not null check (value > 0),
  description text,
  active boolean not null default true,
  max_redemptions integer,
  redeemed_count integer not null default 0,
  expires_at timestamptz
);

create table if not exists delivery_zones (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches (id) on delete cascade,
  name text not null,
  fee integer not null default 0,
  polygon jsonb
);

create table if not exists banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text,
  link text,
  display_order integer not null default 0,
  active boolean not null default true
);

create table if not exists tables_capacity (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches (id) on delete cascade,
  name text not null,
  seats integer not null check (seats > 0),
  active boolean not null default true
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  changes jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Índices -------------------------------------------------

create index if not exists idx_menu_items_category on menu_items (category_slug, display_order);
create index if not exists idx_orders_created on orders (created_at desc);
create index if not exists idx_orders_branch on orders (branch_id, status);
create index if not exists idx_reservations_branch_date on reservations (branch_id, date);
create index if not exists idx_order_items_order on order_items (order_id);

-- ---------- Row Level Security --------------------------------------

-- Lectura pública del catálogo; escritura solo para personal autorizado.
-- El personal se identifica por profiles.role.

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('owner', 'admin', 'manager', 'kitchen', 'cashier', 'editor', 'support')
  );
$$;

create or replace function public.can_edit_menu()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('owner', 'admin', 'manager', 'editor')
  );
$$;

-- Catálogo público (solo lectura anónima)
alter table restaurants enable row level security;
create policy "restaurants_public_read" on restaurants for select using (true);
create policy "restaurants_staff_write" on restaurants for all
  using (public.can_edit_menu()) with check (public.can_edit_menu());

alter table branches enable row level security;
create policy "branches_public_read" on branches for select using (true);
create policy "branches_staff_write" on branches for all
  using (public.can_edit_menu()) with check (public.can_edit_menu());

alter table opening_hours enable row level security;
create policy "opening_hours_public_read" on opening_hours for select using (true);
create policy "opening_hours_staff_write" on opening_hours for all
  using (public.can_edit_menu()) with check (public.can_edit_menu());

alter table special_hours enable row level security;
create policy "special_hours_public_read" on special_hours for select using (true);
create policy "special_hours_staff_write" on special_hours for all
  using (public.can_edit_menu()) with check (public.can_edit_menu());

alter table categories enable row level security;
create policy "categories_public_read" on categories for select using (true);
create policy "categories_staff_write" on categories for all
  using (public.can_edit_menu()) with check (public.can_edit_menu());

alter table menu_items enable row level security;
create policy "menu_items_public_read" on menu_items for select using (true);
create policy "menu_items_staff_write" on menu_items for all
  using (public.can_edit_menu()) with check (public.can_edit_menu());

alter table branch_menu_items enable row level security;
create policy "branch_menu_items_public_read" on branch_menu_items for select using (true);
create policy "branch_menu_items_staff_write" on branch_menu_items for all
  using (public.can_edit_menu()) with check (public.can_edit_menu());

alter table dietary_tags enable row level security;
create policy "dietary_tags_public_read" on dietary_tags for select using (true);
create policy "dietary_tags_staff_write" on dietary_tags for all
  using (public.can_edit_menu()) with check (public.can_edit_menu());

alter table allergens enable row level security;
create policy "allergens_public_read" on allergens for select using (true);
create policy "allergens_staff_write" on allergens for all
  using (public.can_edit_menu()) with check (public.can_edit_menu());

alter table modifier_groups enable row level security;
create policy "modifier_groups_public_read" on modifier_groups for select using (true);
create policy "modifier_groups_staff_write" on modifier_groups for all
  using (public.can_edit_menu()) with check (public.can_edit_menu());

alter table modifier_options enable row level security;
create policy "modifier_options_public_read" on modifier_options for select using (true);
create policy "modifier_options_staff_write" on modifier_options for all
  using (public.can_edit_menu()) with check (public.can_edit_menu());

-- Datos personales: cada usuario ve solo lo suyo; el personal, todo.
alter table profiles enable row level security;
create policy "profiles_own_read" on profiles for select
  using (id = auth.uid() or public.is_staff());
create policy "profiles_own_update" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_own_insert" on profiles for insert
  with check (id = auth.uid());

alter table staff_branch_permissions enable row level security;
create policy "staff_permissions_staff_read" on staff_branch_permissions for select
  using (public.is_staff());

alter table favorites enable row level security;
create policy "favorites_own_all" on favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table carts enable row level security;
create policy "carts_own_all" on carts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table cart_items enable row level security;
create policy "cart_items_own_all" on cart_items for all
  using (exists (select 1 from carts where carts.id = cart_id and carts.user_id = auth.uid()))
  with check (exists (select 1 from carts where carts.id = cart_id and carts.user_id = auth.uid()));

alter table cart_item_modifiers enable row level security;
create policy "cart_item_modifiers_own_all" on cart_item_modifiers for all
  using (
    exists (
      select 1
      from cart_items
      join carts on carts.id = cart_items.cart_id
      where cart_items.id = cart_item_id and carts.user_id = auth.uid()
    )
  );

-- Pedidos/reservas: se crean vía service-role (API del servidor).
-- Los clientes autenticados solo ven los suyos; el personal, todos.
alter table orders enable row level security;
create policy "orders_own_read" on orders for select
  using (user_id = auth.uid() or public.is_staff());
create policy "orders_staff_update" on orders for update
  using (public.is_staff()) with check (public.is_staff());

alter table order_items enable row level security;
create policy "order_items_own_read" on order_items for select
  using (
    exists (
      select 1 from orders
      where orders.id = order_id and (orders.user_id = auth.uid() or public.is_staff())
    )
  );

alter table reservations enable row level security;
create policy "reservations_own_read" on reservations for select
  using (user_id = auth.uid() or public.is_staff());
create policy "reservations_staff_update" on reservations for update
  using (public.is_staff()) with check (public.is_staff());

-- Marketing
alter table promotions enable row level security;
create policy "promotions_public_read" on promotions for select using (active = true or public.is_staff());
create policy "promotions_staff_write" on promotions for all
  using (public.can_edit_menu()) with check (public.can_edit_menu());

alter table coupons enable row level security;
create policy "coupons_staff_read" on coupons for select using (public.is_staff());
create policy "coupons_staff_write" on coupons for all
  using (public.can_edit_menu()) with check (public.can_edit_menu());

alter table delivery_zones enable row level security;
create policy "delivery_zones_public_read" on delivery_zones for select using (true);
create policy "delivery_zones_staff_write" on delivery_zones for all
  using (public.can_edit_menu()) with check (public.can_edit_menu());

alter table banners enable row level security;
create policy "banners_public_read" on banners for select using (active = true or public.is_staff());
create policy "banners_staff_write" on banners for all
  using (public.can_edit_menu()) with check (public.can_edit_menu());

alter table tables_capacity enable row level security;
create policy "tables_staff_all" on tables_capacity for all
  using (public.is_staff()) with check (public.is_staff());

alter table notifications enable row level security;
create policy "notifications_own_read" on notifications for select using (user_id = auth.uid());
create policy "notifications_own_update" on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table audit_log enable row level security;
create policy "audit_staff_read" on audit_log for select using (public.is_staff());
