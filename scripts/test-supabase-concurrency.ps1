$ErrorActionPreference = 'Stop'

$docker = 'C:\Users\alex\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
$container = 'supabase_db_Restaurante2.0'
$runId = [guid]::NewGuid().ToString('N').Substring(0, 12)
$runTag = "race-$runId"

function New-DeterministicGuid([string]$seed) {
  $md5 = [System.Security.Cryptography.MD5]::Create()
  try {
    $bytes = $md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes("${runId}:$seed"))
    $bytes[7] = ($bytes[7] -band 0x0F) -bor 0x40
    $bytes[8] = ($bytes[8] -band 0x3F) -bor 0x80
    return ([guid]::new($bytes)).Guid
  } finally {
    $md5.Dispose()
  }
}

$ids = @{
  restaurant = New-DeterministicGuid 'restaurant'
  branch = New-DeterministicGuid 'branch'
  category = New-DeterministicGuid 'category'
  owner = New-DeterministicGuid 'owner'
  cashier = New-DeterministicGuid 'cashier'
  customer = New-DeterministicGuid 'customer'
  inv1 = New-DeterministicGuid 'inv1'
  inv2 = New-DeterministicGuid 'inv2'
  inv3 = New-DeterministicGuid 'inv3'
  recipe1 = New-DeterministicGuid 'recipe1'
  recipe2 = New-DeterministicGuid 'recipe2'
  recipe3 = New-DeterministicGuid 'recipe3'
  order1 = New-DeterministicGuid 'order1'
  order2 = New-DeterministicGuid 'order2'
  order3 = New-DeterministicGuid 'order3'
  order4 = New-DeterministicGuid 'order4'
  oi1 = New-DeterministicGuid 'oi1'
  oi2 = New-DeterministicGuid 'oi2'
  oi3 = New-DeterministicGuid 'oi3'
  oi4 = New-DeterministicGuid 'oi4'
  plan = New-DeterministicGuid 'plan'
  membership = New-DeterministicGuid 'membership'
  menu = New-DeterministicGuid 'menu'
  menuCat = New-DeterministicGuid 'menuCat'
  menuItem = New-DeterministicGuid 'menuItem'
  keySame = New-DeterministicGuid 'keySame'
  keyDiffA = New-DeterministicGuid 'keyDiffA'
  keyDiffB = New-DeterministicGuid 'keyDiffB'
  keyConflict = New-DeterministicGuid 'keyConflict'
  keyShared = New-DeterministicGuid 'keyShared'
  keyCatalog = New-DeterministicGuid 'keyCatalog'
  keyCouponA = New-DeterministicGuid 'keyCouponA'
  keyCouponB = New-DeterministicGuid 'keyCouponB'
}

$product1 = "p1-$runId"
$product2 = "p2-$runId"
$product3 = "p3-$runId"
$couponLast = ("LAST" + $runId.Substring(0, 8)).ToUpperInvariant()
$webhookEvent = "evt_$runId"
$activateKey = "activate-$runId"
$benefitKey = "benefit-$runId"
$reversalKey = "reversal-$runId"
$requestKey = "request-$runId"

function Invoke-DatabaseSql([string]$sql) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = $sql | & $docker exec -i $container sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U postgres -d postgres -X -q -v ON_ERROR_STOP=1' 2>&1
    if ($LASTEXITCODE -ne 0) { throw ($output -join "`n") }
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Invoke-SqlPair([string]$first, [string]$second, [int]$expectedFailures, [string]$label) {
  $runner = {
    param($dockerPath, $containerName, $statement)
    $ErrorActionPreference = 'Continue'
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

Write-Output "CONCURRENCY_RUN_ID=$runId"

$setup = @"
insert into public.restaurants (id,name,slug) values ('$($ids.restaurant)','Concurrency $runTag','$runTag');
insert into public.branches (id,restaurant_id,name,slug) values ('$($ids.branch)','$($ids.restaurant)','Concurrency branch $runTag','$runTag-branch');
insert into public.categories (id,restaurant_id,name,slug) values ('$($ids.category)','$($ids.restaurant)','Concurrency','$runTag-category');
insert into public.menu_items (id,restaurant_id,category_slug,slug,name,base_price,image_path) values
('$product1','$($ids.restaurant)','$runTag-category','$product1','Race 1',10000,'/demo.jpg'),
('$product2','$($ids.restaurant)','$runTag-category','$product2','Race 2',10000,'/demo.jpg'),
('$product3','$($ids.restaurant)','$runTag-category','$product3','Race 3',10000,'/demo.jpg');
insert into auth.users (instance_id,id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous) values
('00000000-0000-0000-0000-000000000000','$($ids.owner)','authenticated','authenticated','owner-$runId@test.local','{}','{}',now(),now(),false,false),
('00000000-0000-0000-0000-000000000000','$($ids.cashier)','authenticated','authenticated','cashier-$runId@test.local','{}','{}',now(),now(),false,false),
('00000000-0000-0000-0000-000000000000','$($ids.customer)','authenticated','authenticated','customer-$runId@test.local','{}','{}',now(),now(),false,false);
update public.profiles set role='owner',staff_status='active' where id='$($ids.owner)';
update public.profiles set role='cashier',staff_status='active' where id='$($ids.cashier)';
insert into public.staff_branch_permissions values ('$($ids.cashier)','$($ids.branch)');
insert into public.inventory_items (id,branch_id,name,slug,category,base_unit,display_unit,current_quantity,minimum_quantity,cost_per_base_unit) values
('$($ids.inv1)','$($ids.branch)','Race ingredient 1','$runTag-ing-1','race','g','g',100,10,1),
('$($ids.inv2)','$($ids.branch)','Race ingredient 2','$runTag-ing-2','race','g','g',100,10,1),
('$($ids.inv3)','$($ids.branch)','Race ingredient 3','$runTag-ing-3','race','g','g',100,10,1);
insert into public.recipes (id,product_id,branch_id,portion_yield) values
('$($ids.recipe1)','$product1','$($ids.branch)',1),
('$($ids.recipe2)','$product2','$($ids.branch)',1),
('$($ids.recipe3)','$product3','$($ids.branch)',1);
insert into public.recipe_items values
('$($ids.recipe1)','$($ids.inv1)',60,'g',now()),
('$($ids.recipe2)','$($ids.inv2)',60,'g',now()),
('$($ids.recipe3)','$($ids.inv3)',60,'g',now());
insert into public.orders (id,order_number,user_id,branch_id,status,payment_method,fulfillment_type,subtotal,total,customer_name,customer_phone,customer_email) values
('$($ids.order1)','RACE-$runId-1','$($ids.customer)','$($ids.branch)','ready','demo','pickup',10000,10000,'Race','3000000000','race-$runId@test.local'),
('$($ids.order2)','RACE-$runId-2','$($ids.customer)','$($ids.branch)','ready','demo','pickup',10000,10000,'Race','3000000000','race-$runId@test.local'),
('$($ids.order3)','RACE-$runId-3','$($ids.customer)','$($ids.branch)','ready','demo','pickup',10000,10000,'Race','3000000000','race-$runId@test.local'),
('$($ids.order4)','RACE-$runId-4','$($ids.customer)','$($ids.branch)','ready','demo','pickup',10000,10000,'Race','3000000000','race-$runId@test.local');
insert into public.order_items (id,order_id,menu_item_id,name_snapshot,unit_price,quantity,total) values
('$($ids.oi1)','$($ids.order1)','$product1','Race 1',10000,1,10000),
('$($ids.oi2)','$($ids.order2)','$product1','Race 1',10000,1,10000),
('$($ids.oi3)','$($ids.order3)','$product2','Race 2',10000,1,10000),
('$($ids.oi4)','$($ids.order4)','$product3','Race 3',10000,1,10000);
insert into public.pension_plans (id,name,public_price,modality,default_meal_limit,included_periods) values ('$($ids.plan)','Race plan $runTag',100000,'meal_count',10,array['lunch']);
insert into public.pension_memberships (id,profile_id,plan_id,branch_id,status,modality,public_price_snapshot,request_idempotency_key) values ('$($ids.membership)','$($ids.customer)','$($ids.plan)','$($ids.branch)','pending','meal_count',100000,'$requestKey');
insert into public.pension_menus (id,branch_id,service_date,period,status,published_at,published_by) values ('$($ids.menu)','$($ids.branch)',current_date,'lunch','published',now(),'$($ids.owner)');
insert into public.pension_menu_categories (id,menu_id,category,label,is_required) values ('$($ids.menuCat)','$($ids.menu)','main','Principal',true);
insert into public.pension_menu_items (id,menu_category_id,menu_item_id,is_included) values ('$($ids.menuItem)','$($ids.menuCat)','$product1',true);
insert into public.coupons (code, type, value, active, max_redemptions, redeemed_count)
values ('$couponLast', 'fixed', 100, true, 1, 0);
"@
Invoke-DatabaseSql $setup

$cashier = "select set_config('request.jwt.claim.sub','$($ids.cashier)',false); set role authenticated;"
$owner = "select set_config('request.jwt.claim.sub','$($ids.owner)',false); set role authenticated;"
$customer = "select set_config('request.jwt.claim.sub','$($ids.customer)',false); set role authenticated;"

Invoke-SqlPair "$cashier begin; update public.orders set status='delivered' where id='$($ids.order1)'; select pg_sleep(1); commit;" "$cashier update public.orders set status='delivered' where id='$($ids.order2)';" 1 'stock race'
Invoke-SqlPair "$cashier begin; update public.orders set status='delivered' where id='$($ids.order3)'; select pg_sleep(1); commit;" "$cashier update public.orders set status='delivered' where id='$($ids.order3)';" 1 'duplicate delivery'
Invoke-SqlPair "$owner begin; select public.activate_pension_membership('$($ids.membership)',90000,'cash',null,current_date,current_date,null,10,false,'race','$activateKey'); select pg_sleep(1); commit;" "$owner select public.activate_pension_membership('$($ids.membership)',90000,'cash',null,current_date,current_date,null,10,false,'race','$activateKey');" 0 'duplicate activation'
Invoke-SqlPair "$customer begin; select public.consume_pension_benefit('$($ids.membership)','$($ids.menu)',array['$($ids.menuItem)']::uuid[],null,'$benefitKey'); select pg_sleep(1); commit;" "$customer select public.consume_pension_benefit('$($ids.membership)','$($ids.menu)',array['$($ids.menuItem)']::uuid[],null,'$benefitKey');" 0 'duplicate benefit'
Invoke-DatabaseSql "$cashier update public.orders set status='delivered' where id='$($ids.order4)';"
$movement = "(select id from public.inventory_movements where order_id='$($ids.order4)' and movement_type='consumption')"
Invoke-SqlPair "$owner begin; select public.reverse_inventory_consumption($movement,'race reversal','$reversalKey'); select pg_sleep(1); commit;" "$owner select public.reverse_inventory_consumption($movement,'race reversal','$reversalKey');" 0 'duplicate reversal'
Invoke-SqlPair "set role service_role; begin; select public.process_stripe_payment_event('$webhookEvent','payment_intent.succeeded','$($ids.order3)','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'); select pg_sleep(1); commit;" "set role service_role; select public.process_stripe_payment_event('$webhookEvent','payment_intent.succeeded','$($ids.order3)','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');" 0 'duplicate webhook'

$assertions = @"
do `$`$ begin
  if (select current_quantity from public.inventory_items where id='$($ids.inv1)') <> 40 then raise exception 'stock race failed'; end if;
  if (select count(*) from public.orders where id in ('$($ids.order1)','$($ids.order2)') and status='delivered') <> 1 then raise exception 'race delivered count failed'; end if;
  if (select count(*) from public.inventory_movements where order_id in ('$($ids.order1)','$($ids.order2)') and movement_type='consumption') <> 1 then raise exception 'race movement count failed'; end if;
  if (select current_quantity from public.inventory_items where id='$($ids.inv2)') <> 40 then raise exception 'duplicate delivery stock failed'; end if;
  if (select count(*) from public.inventory_movements where order_id='$($ids.order3)' and movement_type='consumption') <> 1 then raise exception 'duplicate delivery movement failed'; end if;
  if (select count(*) from public.pension_membership_cycles where membership_id='$($ids.membership)') <> 1 then raise exception 'activation idempotency failed'; end if;
  if (select meals_consumed from public.pension_memberships where id='$($ids.membership)') <> 1 then raise exception 'benefit idempotency failed'; end if;
  if (select current_quantity from public.inventory_items where id='$($ids.inv3)') <> 100 then raise exception 'reversal stock failed'; end if;
  if (select count(*) from public.inventory_movements where inventory_item_id='$($ids.inv3)' and movement_type='reversal') <> 1 then raise exception 'reversal idempotency failed'; end if;
  if (select count(*) from public.payment_webhook_events where provider_event_id='$webhookEvent') <> 1 then raise exception 'webhook idempotency failed'; end if;
end `$`$;
"@
Invoke-DatabaseSql $assertions

# --- 11B-2A: create_customer_order concurrency ---
$orderSetup = @"
insert into public.branch_menu_items (branch_id, menu_item_id, price, available) values
('$($ids.branch)', '$product1', 10000, true),
('$($ids.branch)', '$product2', 10000, true)
on conflict do nothing;
update public.restaurants set checkout_tax_rate = 0.0800, service_fee_rate = 0, max_line_quantity = 20, order_number_prefix = 'CB'
where id = '$($ids.restaurant)';
"@
Invoke-DatabaseSql $orderSetup

$orderPayload = @"
select * from public.create_customer_order(
  '$($ids.keySame)'::uuid,
  '$($ids.branch)'::uuid,
  'pickup',
  'Race Customer',
  '3001234567',
  'race-order-$runId@test.local',
  '[{"menu_item_id":"$product1","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null
);
"@

$orderPayloadB = @"
select * from public.create_customer_order(
  '$($ids.keyDiffA)'::uuid,
  '$($ids.branch)'::uuid,
  'pickup',
  'Race Customer',
  '3001234567',
  'race-order-$runId@test.local',
  '[{"menu_item_id":"$product1","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null
);
"@

$customer1 = "select set_config('request.jwt.claim.sub','$($ids.customer)',false); set role authenticated;"

# A: same key + same intention concurrent → exactly one order (both succeed via create/replay)
Invoke-SqlPair "$customer1 begin; $orderPayload select pg_sleep(0.5); commit;" "$customer1 $orderPayload" 0 'order same-key same-intent'

# B: same key + different intention concurrent → one creates, one conflicts
$conflictA = @"
select set_config('request.jwt.claim.sub','$($ids.customer)',false);
set role authenticated;
begin;
select public.create_customer_order(
  '$($ids.keyConflict)'::uuid,
  '$($ids.branch)'::uuid,
  'pickup','Race Customer','3001234567','race-order-$runId@test.local',
  '[{"menu_item_id":"$product1","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null,null,0,null);
select pg_sleep(0.8);
commit;
"@
$conflictB = @"
select set_config('request.jwt.claim.sub','$($ids.customer)',false);
set role authenticated;
select public.create_customer_order(
  '$($ids.keyConflict)'::uuid,
  '$($ids.branch)'::uuid,
  'pickup','Race Customer','3001234567','race-order-$runId@test.local',
  '[{"menu_item_id":"$product2","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null,null,0,null);
"@
Invoke-SqlPair $conflictA $conflictB 1 'order same-key different-intent'

# C: different keys → 2 orders
Invoke-SqlPair "$customer1 begin; $orderPayloadB select pg_sleep(0.3); commit;" "$customer1 select * from public.create_customer_order('$($ids.keyDiffB)'::uuid,'$($ids.branch)'::uuid,'pickup','Race Customer','3001234567','race-order-$runId@test.local','[{""menu_item_id"":""$product1"",""quantity"":1,""notes"":"""",""modifier_option_ids"":[]}]'::jsonb,null,null,0,null);" 0 'order different keys'

# D: two users same key UUID → 2 orders (scopes differ)
$sharedKeyA = @"
select set_config('request.jwt.claim.sub','$($ids.customer)',false);
set role authenticated;
select public.create_customer_order(
  '$($ids.keyShared)'::uuid,
  '$($ids.branch)'::uuid,
  'pickup','Race Customer','3001234567','race-order-$runId@test.local',
  '[{"menu_item_id":"$product1","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null,null,0,null);
"@
$sharedKeyB = @"
select set_config('request.jwt.claim.sub','$($ids.owner)',false);
set role authenticated;
select public.create_customer_order(
  '$($ids.keyShared)'::uuid,
  '$($ids.branch)'::uuid,
  'pickup','Race Owner','3001234567','race-owner-order-$runId@test.local',
  '[{"menu_item_id":"$product1","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null,null,0,null);
"@
Invoke-SqlPair $sharedKeyA $sharedKeyB 0 'order same-key different-users'

# E: replay after catalog change → historical order
$catalogCreate = @"
select set_config('request.jwt.claim.sub','$($ids.customer)',false);
set role authenticated;
select public.create_customer_order(
  '$($ids.keyCatalog)'::uuid,
  '$($ids.branch)'::uuid,
  'pickup','Catalog Replay','3001234567','catalog-$runId@test.local',
  '[{"menu_item_id":"$product1","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null,null,0,null);
"@
Invoke-DatabaseSql $catalogCreate
Invoke-DatabaseSql "update public.menu_items set available = false where id = '$product1'; update public.branch_menu_items set available = false, price = 1 where branch_id = '$($ids.branch)' and menu_item_id = '$product1';"
$catalogReplay = @"
select set_config('request.jwt.claim.sub','$($ids.customer)',false);
set role authenticated;
select public.create_customer_order(
  '$($ids.keyCatalog)'::uuid,
  '$($ids.branch)'::uuid,
  'pickup','Catalog Replay','3001234567','catalog-$runId@test.local',
  '[{"menu_item_id":"$product1","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null,null,0,null);
"@
Invoke-DatabaseSql $catalogReplay
Invoke-DatabaseSql "update public.menu_items set available = true where id = '$product1'; update public.branch_menu_items set available = true, price = 10000 where branch_id = '$($ids.branch)' and menu_item_id = '$product1';"

# F: last coupon redemption concurrency → at most one success
$couponA = @"
select set_config('request.jwt.claim.sub','$($ids.customer)',false);
set role authenticated;
select public.create_customer_order(
  '$($ids.keyCouponA)'::uuid,
  '$($ids.branch)'::uuid,
  'pickup','Coupon A','3001234567','coupon-a-$runId@test.local',
  '[{"menu_item_id":"$product2","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null,null,0,'$couponLast');
"@
$couponB = @"
select set_config('request.jwt.claim.sub','$($ids.owner)',false);
set role authenticated;
select public.create_customer_order(
  '$($ids.keyCouponB)'::uuid,
  '$($ids.branch)'::uuid,
  'pickup','Coupon B','3001234567','coupon-b-$runId@test.local',
  '[{"menu_item_id":"$product2","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null,null,0,'$couponLast');
"@
Invoke-SqlPair $couponA $couponB 1 'order last-coupon concurrency'

$orderAssertions = @"
do `$`$ begin
  if (select count(*) from public.orders where idempotency_key = '$($ids.keySame)') <> 1 then
    raise exception 'same-key same-intent concurrency created % orders',
      (select count(*) from public.orders where idempotency_key = '$($ids.keySame)');
  end if;
  if (select count(*) from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where o.idempotency_key = '$($ids.keySame)') <> 1 then
    raise exception 'same-key same-intent concurrency duplicated items';
  end if;
  if (select count(*) from public.orders where idempotency_key = '$($ids.keyConflict)') <> 1 then
    raise exception 'same-key different-intent created more than one order';
  end if;
  if (select count(*) from public.orders where idempotency_key in (
        '$($ids.keyDiffA)',
        '$($ids.keyDiffB)'
      )) <> 2 then
    raise exception 'different keys did not create two orders';
  end if;
  if (select count(*) from public.orders where idempotency_key = '$($ids.keyShared)') <> 2 then
    raise exception 'shared key across users did not isolate by scope';
  end if;
  if (select count(*) from public.orders where idempotency_key = '$($ids.keyCatalog)') <> 1 then
    raise exception 'catalog-changed replay did not keep one order';
  end if;
  if (select redeemed_count from public.coupons where code = '$couponLast') <> 1 then
    raise exception 'last coupon concurrency redeemed_count=%',
      (select redeemed_count from public.coupons where code = '$couponLast');
  end if;
  if (select count(*) from public.orders where coupon_code = '$couponLast') <> 1 then
    raise exception 'last coupon concurrency created % coupon orders',
      (select count(*) from public.orders where coupon_code = '$couponLast');
  end if;
  if exists (
    select 1 from public.inventory_movements m
    join public.orders o on o.id = m.order_id
    where o.idempotency_key is not null
      and o.branch_id = '$($ids.branch)'
      and m.movement_type = 'consumption'
      and o.status = 'pending'
  ) then
    raise exception 'order create consumed inventory';
  end if;
end `$`$;
"@
Invoke-DatabaseSql $orderAssertions
Write-Output "CONCURRENCY_TESTS_PASS scenarios=12 assertions=19 run=$runId"
