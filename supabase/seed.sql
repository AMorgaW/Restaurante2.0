-- ============================================================
-- Seed de demostración para Supabase (DATA_MODE=supabase).
-- Los platos reales se cargan desde el manifiesto generado con:
--   npm run generate:menu   (ver README → "Conectar Supabase")
-- Este seed crea el restaurante, sucursales, horarios y categorías.
-- ============================================================

insert into restaurants (id, name, slug, description, currency, timezone, phone, email)
values (
  '00000000-0000-0000-0000-000000000001',
  'Casa Brasa',
  'casa-brasa',
  'Restaurante de parrilla y cocina casera.',
  'COP',
  'America/Bogota',
  '+57 601 000 0000',
  'hola@casabrasa-demo.example'
)
on conflict (slug) do nothing;

insert into branches (
  id, restaurant_id, name, slug, address, city, latitude, longitude,
  phone, whatsapp, email, pickup_enabled, delivery_enabled, delivery_fee, delivery_area_note
)
values
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'Casa Brasa Centro', 'centro',
    'Calle 10 # 5-51 (dirección de demostración)', 'Bogotá', 4.598056, -74.075833,
    '+57 601 000 0001', '+573000000001', 'centro@casabrasa-demo.example',
    true, true, 6000, 'Cobertura de demostración: hasta 5 km a la redonda.'
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    'Casa Brasa Norte', 'norte',
    'Carrera 15 # 93-30 (dirección de demostración)', 'Bogotá', 4.678056, -74.056389,
    '+57 601 000 0002', '+573000000002', 'norte@casabrasa-demo.example',
    true, false, 0, 'Esta sucursal solo ofrece recogida en tienda.'
  )
on conflict (restaurant_id, slug) do nothing;

-- Horarios (idénticos para ambas sucursales de demostración)
insert into opening_hours (branch_id, day_of_week, opening_time, closing_time, is_closed)
select b.id, d.day_of_week, d.opening_time::time, d.closing_time::time, false
from branches b
cross join (
  values
    (0, '12:00', '17:00'),
    (1, '11:30', '21:30'),
    (2, '11:30', '21:30'),
    (3, '11:30', '21:30'),
    (4, '11:30', '22:00'),
    (5, '11:30', '23:00'),
    (6, '12:00', '23:00')
) as d (day_of_week, opening_time, closing_time)
on conflict (branch_id, day_of_week) do nothing;

insert into categories (restaurant_id, name, slug, description, display_order)
values
  ('00000000-0000-0000-0000-000000000001', 'Desayunos', 'desayunos', 'Para empezar el día', 1),
  ('00000000-0000-0000-0000-000000000001', 'Entradas', 'entradas', 'Para abrir el apetito', 2),
  ('00000000-0000-0000-0000-000000000001', 'Sopas', 'sopas', 'Recetas calientes de la casa', 3),
  ('00000000-0000-0000-0000-000000000001', 'Ensaladas', 'ensaladas', 'Frescas y completas', 4),
  ('00000000-0000-0000-0000-000000000001', 'Hamburguesas', 'hamburguesas', 'Al carbón', 5),
  ('00000000-0000-0000-0000-000000000001', 'Pizzas', 'pizzas', 'Al horno', 6),
  ('00000000-0000-0000-0000-000000000001', 'Pastas', 'pastas', 'Tradición italiana', 7),
  ('00000000-0000-0000-0000-000000000001', 'Tacos y mexicana', 'mexicana', 'Sabores de México', 8),
  ('00000000-0000-0000-0000-000000000001', 'Pollo', 'pollo', 'Jugoso y dorado', 9),
  ('00000000-0000-0000-0000-000000000001', 'Carnes', 'carnes', 'A la brasa y a la parrilla', 10),
  ('00000000-0000-0000-0000-000000000001', 'Pescados y mariscos', 'pescados-y-mariscos', 'Del mar a la mesa', 11),
  ('00000000-0000-0000-0000-000000000001', 'Postres', 'postres', 'El final dulce', 12),
  ('00000000-0000-0000-0000-000000000001', 'Bebidas', 'bebidas', 'Para acompañar', 13),
  ('00000000-0000-0000-0000-000000000001', 'Especialidades', 'especialidades', 'Selección de la casa', 14)
on conflict (slug) do nothing;

insert into coupons (code, type, value, description, active)
values ('BIENVENIDA10', 'percent', 10, '10% de descuento de bienvenida (demostración).', true)
on conflict (code) do nothing;
