$ErrorActionPreference = 'Stop'

$docker = 'C:\Users\alex\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
$container = 'supabase_db_Restaurante2.0'

function Invoke-DatabaseSql([string]$sql) {
  $output = $sql | & $docker exec -i $container sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U postgres -d postgres -X -q -v ON_ERROR_STOP=1' 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($output -join "`n") }
}

function Invoke-SqlPair([string]$first, [string]$second, [int]$expectedFailures, [string]$label) {
  $runner = {
    param($dockerPath, $containerName, $statement)
    $output = $statement | & $dockerPath exec -i $containerName sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U postgres -d postgres -X -q -v ON_ERROR_STOP=1' 2>&1
    [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($output -join "`n") }
  }
  $a = Start-Job -ScriptBlock $runner -ArgumentList $docker, $container, $first
  $b = Start-Job -ScriptBlock $runner -ArgumentList $docker, $container, $second
  $results = @($a, $b | Wait-Job | Receive-Job)
  Remove-Job -Job $a, $b -Force
  $failures = @($results | Where-Object ExitCode -ne 0).Count
  if ($failures -ne $expectedFailures) {
    $details = ($results | ForEach-Object { "exit=$($_.ExitCode) $($_.Output)" }) -join "`n"
    throw "$label esperaba $expectedFailures fallos y obtuvo $failures.`n$details"
  }
}

$setup = @'
insert into public.restaurants (id,name,slug) values ('81000000-0000-0000-0000-000000000001','Concurrency','concurrency');
insert into public.branches (id,restaurant_id,name,slug) values ('82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','Concurrency branch','concurrency-branch');
insert into public.categories (id,restaurant_id,name,slug) values ('83000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','Concurrency','concurrency-category');
insert into public.menu_items (id,restaurant_id,category_slug,slug,name,base_price,image_path) values
('race-product-1','81000000-0000-0000-0000-000000000001','concurrency-category','race-product-1','Race 1',10000,'/demo.jpg'),
('race-product-2','81000000-0000-0000-0000-000000000001','concurrency-category','race-product-2','Race 2',10000,'/demo.jpg'),
('race-product-3','81000000-0000-0000-0000-000000000001','concurrency-category','race-product-3','Race 3',10000,'/demo.jpg');
insert into auth.users (instance_id,id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous) values
('00000000-0000-0000-0000-000000000000','84000000-0000-0000-0000-000000000001','authenticated','authenticated','race-owner@test.local','{}','{}',now(),now(),false,false),
('00000000-0000-0000-0000-000000000000','84000000-0000-0000-0000-000000000002','authenticated','authenticated','race-cashier@test.local','{}','{}',now(),now(),false,false),
('00000000-0000-0000-0000-000000000000','84000000-0000-0000-0000-000000000003','authenticated','authenticated','race-customer@test.local','{}','{}',now(),now(),false,false);
update public.profiles set role='owner',staff_status='active' where id='84000000-0000-0000-0000-000000000001';
update public.profiles set role='cashier',staff_status='active' where id='84000000-0000-0000-0000-000000000002';
insert into public.staff_branch_permissions values ('84000000-0000-0000-0000-000000000002','82000000-0000-0000-0000-000000000001');
insert into public.inventory_items (id,branch_id,name,slug,category,base_unit,display_unit,current_quantity,minimum_quantity,cost_per_base_unit) values
('85000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','Race ingredient 1','race-ingredient-1','race','g','g',100,10,1),
('85000000-0000-0000-0000-000000000002','82000000-0000-0000-0000-000000000001','Race ingredient 2','race-ingredient-2','race','g','g',100,10,1),
('85000000-0000-0000-0000-000000000003','82000000-0000-0000-0000-000000000001','Race ingredient 3','race-ingredient-3','race','g','g',100,10,1);
insert into public.recipes (id,product_id,branch_id,portion_yield) values
('86000000-0000-0000-0000-000000000001','race-product-1','82000000-0000-0000-0000-000000000001',1),
('86000000-0000-0000-0000-000000000002','race-product-2','82000000-0000-0000-0000-000000000001',1),
('86000000-0000-0000-0000-000000000003','race-product-3','82000000-0000-0000-0000-000000000001',1);
insert into public.recipe_items values
('86000000-0000-0000-0000-000000000001','85000000-0000-0000-0000-000000000001',60,'g',now()),
('86000000-0000-0000-0000-000000000002','85000000-0000-0000-0000-000000000002',60,'g',now()),
('86000000-0000-0000-0000-000000000003','85000000-0000-0000-0000-000000000003',60,'g',now());
insert into public.orders (id,order_number,user_id,branch_id,status,payment_method,fulfillment_type,subtotal,total,customer_name,customer_phone,customer_email) values
('87000000-0000-0000-0000-000000000001','RACE-1','84000000-0000-0000-0000-000000000003','82000000-0000-0000-0000-000000000001','ready','demo','pickup',10000,10000,'Race','3000000000','race@test.local'),
('87000000-0000-0000-0000-000000000002','RACE-2','84000000-0000-0000-0000-000000000003','82000000-0000-0000-0000-000000000001','ready','demo','pickup',10000,10000,'Race','3000000000','race@test.local'),
('87000000-0000-0000-0000-000000000003','RACE-3','84000000-0000-0000-0000-000000000003','82000000-0000-0000-0000-000000000001','ready','demo','pickup',10000,10000,'Race','3000000000','race@test.local'),
('87000000-0000-0000-0000-000000000004','RACE-4','84000000-0000-0000-0000-000000000003','82000000-0000-0000-0000-000000000001','ready','demo','pickup',10000,10000,'Race','3000000000','race@test.local');
insert into public.order_items (id,order_id,menu_item_id,name_snapshot,unit_price,quantity,total) values
('88000000-0000-0000-0000-000000000001','87000000-0000-0000-0000-000000000001','race-product-1','Race 1',10000,1,10000),
('88000000-0000-0000-0000-000000000002','87000000-0000-0000-0000-000000000002','race-product-1','Race 1',10000,1,10000),
('88000000-0000-0000-0000-000000000003','87000000-0000-0000-0000-000000000003','race-product-2','Race 2',10000,1,10000),
('88000000-0000-0000-0000-000000000004','87000000-0000-0000-0000-000000000004','race-product-3','Race 3',10000,1,10000);
insert into public.pension_plans (id,name,public_price,modality,default_meal_limit,included_periods) values ('89000000-0000-0000-0000-000000000001','Race plan',100000,'meal_count',10,array['lunch']);
insert into public.pension_memberships (id,profile_id,plan_id,branch_id,status,modality,public_price_snapshot,request_idempotency_key) values ('8a000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000003','89000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','pending','meal_count',100000,'race-request');
insert into public.pension_menus (id,branch_id,service_date,period,status,published_at,published_by) values ('8b000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001',current_date,'lunch','published',now(),'84000000-0000-0000-0000-000000000001');
insert into public.pension_menu_categories (id,menu_id,category,label,is_required) values ('8c000000-0000-0000-0000-000000000001','8b000000-0000-0000-0000-000000000001','main','Principal',true);
insert into public.pension_menu_items (id,menu_category_id,menu_item_id,is_included) values ('8d000000-0000-0000-0000-000000000001','8c000000-0000-0000-0000-000000000001','race-product-1',true);
'@
Invoke-DatabaseSql $setup

$cashier = "select set_config('request.jwt.claim.sub','84000000-0000-0000-0000-000000000002',false); set role authenticated;"
$owner = "select set_config('request.jwt.claim.sub','84000000-0000-0000-0000-000000000001',false); set role authenticated;"
$customer = "select set_config('request.jwt.claim.sub','84000000-0000-0000-0000-000000000003',false); set role authenticated;"

Invoke-SqlPair "$cashier begin; update public.orders set status='delivered' where id='87000000-0000-0000-0000-000000000001'; select pg_sleep(1); commit;" "$cashier update public.orders set status='delivered' where id='87000000-0000-0000-0000-000000000002';" 1 'stock race'
Invoke-SqlPair "$cashier begin; update public.orders set status='delivered' where id='87000000-0000-0000-0000-000000000003'; select pg_sleep(1); commit;" "$cashier update public.orders set status='delivered' where id='87000000-0000-0000-0000-000000000003';" 1 'duplicate delivery'
Invoke-SqlPair "$owner begin; select public.activate_pension_membership('8a000000-0000-0000-0000-000000000001',90000,'cash',null,current_date,current_date,null,10,false,'race','race-activate'); select pg_sleep(1); commit;" "$owner select public.activate_pension_membership('8a000000-0000-0000-0000-000000000001',90000,'cash',null,current_date,current_date,null,10,false,'race','race-activate');" 0 'duplicate activation'
Invoke-SqlPair "$customer begin; select public.consume_pension_benefit('8a000000-0000-0000-0000-000000000001','8b000000-0000-0000-0000-000000000001',array['8d000000-0000-0000-0000-000000000001']::uuid[],null,'race-benefit'); select pg_sleep(1); commit;" "$customer select public.consume_pension_benefit('8a000000-0000-0000-0000-000000000001','8b000000-0000-0000-0000-000000000001',array['8d000000-0000-0000-0000-000000000001']::uuid[],null,'race-benefit');" 0 'duplicate benefit'
Invoke-DatabaseSql "$cashier update public.orders set status='delivered' where id='87000000-0000-0000-0000-000000000004';"
$movement = "(select id from public.inventory_movements where order_id='87000000-0000-0000-0000-000000000004' and movement_type='consumption')"
Invoke-SqlPair "$owner begin; select public.reverse_inventory_consumption($movement,'race reversal','race-reversal'); select pg_sleep(1); commit;" "$owner select public.reverse_inventory_consumption($movement,'race reversal','race-reversal');" 0 'duplicate reversal'
Invoke-SqlPair "set role service_role; begin; select public.process_stripe_payment_event('evt_race','payment_intent.succeeded','87000000-0000-0000-0000-000000000003','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'); select pg_sleep(1); commit;" "set role service_role; select public.process_stripe_payment_event('evt_race','payment_intent.succeeded','87000000-0000-0000-0000-000000000003','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');" 0 'duplicate webhook'

$assertions = @'
do $$ begin
  if (select current_quantity from public.inventory_items where id='85000000-0000-0000-0000-000000000001') <> 40 then raise exception 'stock race failed'; end if;
  if (select count(*) from public.orders where id in ('87000000-0000-0000-0000-000000000001','87000000-0000-0000-0000-000000000002') and status='delivered') <> 1 then raise exception 'race delivered count failed'; end if;
  if (select count(*) from public.inventory_movements where order_id in ('87000000-0000-0000-0000-000000000001','87000000-0000-0000-0000-000000000002') and movement_type='consumption') <> 1 then raise exception 'race movement count failed'; end if;
  if (select current_quantity from public.inventory_items where id='85000000-0000-0000-0000-000000000002') <> 40 then raise exception 'duplicate delivery stock failed'; end if;
  if (select count(*) from public.inventory_movements where order_id='87000000-0000-0000-0000-000000000003' and movement_type='consumption') <> 1 then raise exception 'duplicate delivery movement failed'; end if;
  if (select count(*) from public.pension_membership_cycles where membership_id='8a000000-0000-0000-0000-000000000001') <> 1 then raise exception 'activation idempotency failed'; end if;
  if (select meals_consumed from public.pension_memberships where id='8a000000-0000-0000-0000-000000000001') <> 1 then raise exception 'benefit idempotency failed'; end if;
  if (select current_quantity from public.inventory_items where id='85000000-0000-0000-0000-000000000003') <> 100 then raise exception 'reversal stock failed'; end if;
  if (select count(*) from public.inventory_movements where inventory_item_id='85000000-0000-0000-0000-000000000003' and movement_type='reversal') <> 1 then raise exception 'reversal idempotency failed'; end if;
  if (select count(*) from public.payment_webhook_events where provider_event_id='evt_race') <> 1 then raise exception 'webhook idempotency failed'; end if;
end $$;
'@
Invoke-DatabaseSql $assertions

# --- 11B-2A: create_customer_order concurrency ---
$orderSetup = @'
insert into public.branch_menu_items (branch_id, menu_item_id, price, available) values
('82000000-0000-0000-0000-000000000001', 'race-product-1', 10000, true),
('82000000-0000-0000-0000-000000000001', 'race-product-2', 10000, true)
on conflict do nothing;
update public.restaurants set checkout_tax_rate = 0.0800, service_fee_rate = 0, max_line_quantity = 20, order_number_prefix = 'CB'
where id = '81000000-0000-0000-0000-000000000001';
'@
Invoke-DatabaseSql $orderSetup

$orderPayload = @"
select * from public.create_customer_order(
  '91000000-0000-0000-0000-000000000001'::uuid,
  '82000000-0000-0000-0000-000000000001'::uuid,
  'pickup',
  'Race Customer',
  '3001234567',
  'race-order@test.local',
  '[{"menu_item_id":"race-product-1","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null
);
"@

$orderPayloadB = @"
select * from public.create_customer_order(
  '91000000-0000-0000-0000-000000000002'::uuid,
  '82000000-0000-0000-0000-000000000001'::uuid,
  'pickup',
  'Race Customer',
  '3001234567',
  'race-order@test.local',
  '[{"menu_item_id":"race-product-1","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null
);
"@

$customer1 = "select set_config('request.jwt.claim.sub','84000000-0000-0000-0000-000000000003',false); set role authenticated;"

# A: same key + same intention concurrent → exactly one order (both succeed via create/replay)
Invoke-SqlPair "$customer1 begin; $orderPayload select pg_sleep(0.5); commit;" "$customer1 $orderPayload" 0 'order same-key same-intent'

# B: same key + different intention concurrent → one creates, one conflicts
$conflictA = @"
select set_config('request.jwt.claim.sub','84000000-0000-0000-0000-000000000003',false);
set role authenticated;
begin;
select public.create_customer_order(
  '91000000-0000-0000-0000-0000000000cc'::uuid,
  '82000000-0000-0000-0000-000000000001'::uuid,
  'pickup','Race Customer','3001234567','race-order@test.local',
  '[{"menu_item_id":"race-product-1","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null,null,0,null);
select pg_sleep(0.8);
commit;
"@
$conflictB = @"
select set_config('request.jwt.claim.sub','84000000-0000-0000-0000-000000000003',false);
set role authenticated;
select public.create_customer_order(
  '91000000-0000-0000-0000-0000000000cc'::uuid,
  '82000000-0000-0000-0000-000000000001'::uuid,
  'pickup','Race Customer','3001234567','race-order@test.local',
  '[{"menu_item_id":"race-product-2","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null,null,0,null);
"@
Invoke-SqlPair $conflictA $conflictB 1 'order same-key different-intent'

# C: different keys → 2 orders
Invoke-SqlPair "$customer1 begin; $orderPayloadB select pg_sleep(0.3); commit;" "$customer1 select * from public.create_customer_order('91000000-0000-0000-0000-000000000003'::uuid,'82000000-0000-0000-0000-000000000001'::uuid,'pickup','Race Customer','3001234567','race-order@test.local','[{""menu_item_id"":""race-product-1"",""quantity"":1,""notes"":"""",""modifier_option_ids"":[]}]'::jsonb,null,null,0,null);" 0 'order different keys'

# D: two users same key UUID → 2 orders (scopes differ)
$sharedKeyA = @"
select set_config('request.jwt.claim.sub','84000000-0000-0000-0000-000000000003',false);
set role authenticated;
select public.create_customer_order(
  '91000000-0000-0000-0000-0000000000dd'::uuid,
  '82000000-0000-0000-0000-000000000001'::uuid,
  'pickup','Race Customer','3001234567','race-order@test.local',
  '[{"menu_item_id":"race-product-1","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null,null,0,null);
"@
$sharedKeyB = @"
select set_config('request.jwt.claim.sub','84000000-0000-0000-0000-000000000001',false);
set role authenticated;
select public.create_customer_order(
  '91000000-0000-0000-0000-0000000000dd'::uuid,
  '82000000-0000-0000-0000-000000000001'::uuid,
  'pickup','Race Owner','3001234567','race-owner-order@test.local',
  '[{"menu_item_id":"race-product-1","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null,null,0,null);
"@
Invoke-SqlPair $sharedKeyA $sharedKeyB 0 'order same-key different-users'

$orderAssertions = @'
do $$ begin
  if (select count(*) from public.orders where idempotency_key = '91000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'same-key same-intent concurrency created % orders',
      (select count(*) from public.orders where idempotency_key = '91000000-0000-0000-0000-000000000001');
  end if;
  if (select count(*) from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where o.idempotency_key = '91000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'same-key same-intent concurrency duplicated items';
  end if;
  if (select count(*) from public.orders where idempotency_key = '91000000-0000-0000-0000-0000000000cc') <> 1 then
    raise exception 'same-key different-intent created more than one order';
  end if;
  if (select count(*) from public.orders where idempotency_key in (
        '91000000-0000-0000-0000-000000000002',
        '91000000-0000-0000-0000-000000000003'
      )) <> 2 then
    raise exception 'different keys did not create two orders';
  end if;
  if (select count(*) from public.orders where idempotency_key = '91000000-0000-0000-0000-0000000000dd') <> 2 then
    raise exception 'shared key across users did not isolate by scope';
  end if;
  if exists (
    select 1 from public.inventory_movements m
    join public.orders o on o.id = m.order_id
    where o.idempotency_key is not null
      and o.created_at > now() - interval '10 minutes'
      and m.movement_type = 'consumption'
      and o.status = 'pending'
  ) then
    raise exception 'order create consumed inventory';
  end if;
end $$;
'@
Invoke-DatabaseSql $orderAssertions
Write-Output 'CONCURRENCY_TESTS_PASS scenarios=10 assertions=16'
