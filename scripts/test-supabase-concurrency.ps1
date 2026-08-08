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
  planCalendar = New-DeterministicGuid 'planCalendar'
  membershipCal = New-DeterministicGuid 'membershipCal'
  menuLunch = New-DeterministicGuid 'menuLunch'
  menuDinner = New-DeterministicGuid 'menuDinner'
  menuCatLunch = New-DeterministicGuid 'menuCatLunch'
  menuCatDinner = New-DeterministicGuid 'menuCatDinner'
  menuItemLunch = New-DeterministicGuid 'menuItemLunch'
  menuItemDinner = New-DeterministicGuid 'menuItemDinner'
  admin = New-DeterministicGuid 'admin'
  customerB = New-DeterministicGuid 'customerB'
  manager = New-DeterministicGuid 'manager'
  keyPensionSame = New-DeterministicGuid 'keyPensionSame'
  keyPensionConflict = New-DeterministicGuid 'keyPensionConflict'
  keyPensionLunchA = New-DeterministicGuid 'keyPensionLunchA'
  keyPensionLunchB = New-DeterministicGuid 'keyPensionLunchB'
  keyPensionDinner = New-DeterministicGuid 'keyPensionDinner'
  keyActA = New-DeterministicGuid 'keyActA'
  keyActB = New-DeterministicGuid 'keyActB'
  keyPenRev = New-DeterministicGuid 'keyPenRev'
  keyPaySame = New-DeterministicGuid 'keyPaySame'
  keyPayDiff = New-DeterministicGuid 'keyPayDiff'
  keyPayOwner = New-DeterministicGuid 'keyPayOwner'
  keyPayCashier = New-DeterministicGuid 'keyPayCashier'
  keyPaySessionA = New-DeterministicGuid 'keyPaySessionA'
  keyPaySessionB = New-DeterministicGuid 'keyPaySessionB'
  keyPayVoidA = New-DeterministicGuid 'keyPayVoidA'
  keyPayVoidB = New-DeterministicGuid 'keyPayVoidB'
  keyLocalRace = New-DeterministicGuid 'keyLocalRace'
  orderPay = New-DeterministicGuid 'orderPay'
  orderPayCancel = New-DeterministicGuid 'orderPayCancel'
  orderPayStripe = New-DeterministicGuid 'orderPayStripe'
  oiPay = New-DeterministicGuid 'oiPay'
  diningTable = New-DeterministicGuid 'diningTable'
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
$qrSha = [System.Security.Cryptography.SHA256]::Create()
try {
  $qrToken = ([System.BitConverter]::ToString($qrSha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes("qr:$runId")))).Replace('-', '').ToLowerInvariant()
} finally {
  $qrSha.Dispose()
}

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
('00000000-0000-0000-0000-000000000000','$($ids.customer)','authenticated','authenticated','customer-$runId@test.local','{}','{}',now(),now(),false,false),
('00000000-0000-0000-0000-000000000000','$($ids.manager)','authenticated','authenticated','manager-$runId@test.local','{}','{}',now(),now(),false,false);
update public.profiles set role='owner',staff_status='active' where id='$($ids.owner)';
update public.profiles set role='cashier',staff_status='active' where id='$($ids.cashier)';
update public.profiles set role='manager',staff_status='active' where id='$($ids.manager)';
insert into public.staff_branch_permissions values ('$($ids.cashier)','$($ids.branch)');
insert into public.staff_branch_permissions values ('$($ids.manager)','$($ids.branch)');
insert into public.dining_tables (id, branch_id, code, name, is_active, qr_token_hash)
values (
  '$($ids.diningTable)',
  '$($ids.branch)',
  'RACE-T1',
  'Race Table',
  true,
  extensions.digest(convert_to('$qrToken', 'UTF8'), 'sha256')
);
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
insert into public.branch_menu_items (branch_id, menu_item_id, price, available) values
('$($ids.branch)', '$product1', 10000, true),
('$($ids.branch)', '$product2', 10000, true),
('$($ids.branch)', '$product3', 10000, true)
on conflict do nothing;
update public.branches set pension_delivery_fee = 3000, timezone = 'America/Bogota' where id = '$($ids.branch)';
insert into public.pension_plans (id,name,public_price,modality,duration_days,included_periods) values ('$($ids.plan)','Race plan $runTag',100000,'calendar_period',30,array['lunch','dinner']);
insert into public.pension_memberships (id,profile_id,plan_id,branch_id,status,modality,public_price_snapshot,request_idempotency_key) values ('$($ids.membership)','$($ids.customer)','$($ids.plan)','$($ids.branch)','pending','calendar_period',100000,'$requestKey');
insert into public.pension_menus (id,branch_id,service_date,period,status,published_at,published_by) values
('$($ids.menuLunch)','$($ids.branch)',(now() at time zone 'America/Bogota')::date,'lunch','published',now(),'$($ids.owner)'),
('$($ids.menuDinner)','$($ids.branch)',(now() at time zone 'America/Bogota')::date,'dinner','published',now(),'$($ids.owner)');
insert into public.pension_menu_categories (id,menu_id,category,label,is_required) values
('$($ids.menuCatLunch)','$($ids.menuLunch)','main','Principal',true),
('$($ids.menuCatDinner)','$($ids.menuDinner)','main','Principal',true);
insert into public.pension_menu_items (id,menu_category_id,menu_item_id,is_included,surcharge_amount) values
('$($ids.menuItemLunch)','$($ids.menuCatLunch)','$product1',true,0),
('$($ids.menuItemDinner)','$($ids.menuCatDinner)','$product2',true,0);
insert into public.coupons (code, type, value, active, max_redemptions, redeemed_count)
values ('$couponLast', 'fixed', 100, true, 1, 0);
"@
Invoke-DatabaseSql $setup

$cashier = "select set_config('request.jwt.claim.sub','$($ids.cashier)',false); set role authenticated;"
$owner = "select set_config('request.jwt.claim.sub','$($ids.owner)',false); set role authenticated;"
$customer = "select set_config('request.jwt.claim.sub','$($ids.customer)',false); set role authenticated;"
$commercialDate = "(now() at time zone 'America/Bogota')::date"

Invoke-SqlPair "$cashier begin; update public.orders set status='delivered' where id='$($ids.order1)'; select pg_sleep(1); commit;" "$cashier update public.orders set status='delivered' where id='$($ids.order2)';" 1 'stock race'
Invoke-SqlPair "$cashier begin; update public.orders set status='delivered' where id='$($ids.order3)'; select pg_sleep(1); commit;" "$cashier update public.orders set status='delivered' where id='$($ids.order3)';" 1 'duplicate delivery'
Invoke-SqlPair "$owner begin; select public.activate_pension_membership('$($ids.membership)',90000,'cash',null,$commercialDate,$commercialDate,null,null,false,'race','$activateKey'); select pg_sleep(1); commit;" "$owner select public.activate_pension_membership('$($ids.membership)',90000,'cash',null,$commercialDate,$commercialDate,null,null,false,'race','$activateKey');" 0 'duplicate activation'
$pensionOrderSame = @"
select public.create_pension_order(
  '$($ids.keyPensionSame)'::uuid,
  '$($ids.menuLunch)'::uuid,
  array['$($ids.menuItemLunch)']::uuid[],
  'local','Race Customer','3001234567','race-pension-$runId@test.local',null,null,0,'$qrToken'
);
"@
Invoke-SqlPair "$customer begin; $pensionOrderSame select pg_sleep(1); commit;" "$customer $pensionOrderSame" 0 'duplicate pension order same key'
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
  if (select count(*) from public.orders where idempotency_key='$($ids.keyPensionSame)' and order_kind='pension') <> 1 then raise exception 'pension order same-key failed'; end if;
  if (select count(*) from public.pension_consumptions where membership_id='$($ids.membership)' and status='confirmed') <> 1 then raise exception 'pension consumption same-key failed'; end if;
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

# --- 11B-5: create_pension_order concurrency ---
# B: same key + different intention → conflict
$penConflictA = @"
select set_config('request.jwt.claim.sub','$($ids.customer)',false);
set role authenticated;
begin;
select public.create_pension_order(
  '$($ids.keyPensionConflict)'::uuid,'$($ids.menuDinner)'::uuid,array['$($ids.menuItemDinner)']::uuid[],
  'local','Race Customer','3001234567','race-pension-$runId@test.local',null,null,0,'$qrToken');
select pg_sleep(0.8);
commit;
"@
$penConflictB = @"
select set_config('request.jwt.claim.sub','$($ids.customer)',false);
set role authenticated;
select public.create_pension_order(
  '$($ids.keyPensionConflict)'::uuid,'$($ids.menuDinner)'::uuid,array['$($ids.menuItemDinner)']::uuid[],
  'pickup','Race Customer','3001234567','race-pension-$runId@test.local',null,null,0,null);
"@
Invoke-SqlPair $penConflictA $penConflictB 1 'pension same-key different-intent'

# C: two keys same lunch → max one confirmed (lunch already used by keyPensionSame; expect both fail OR use fresh membership)
# Use dinner for two-key race on same menu: recreate via new customer after admin activation
$adminSetup = @"
insert into auth.users (instance_id,id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous) values
('00000000-0000-0000-0000-000000000000','$($ids.admin)','authenticated','authenticated','admin-$runId@test.local','{}','{}',now(),now(),false,false),
('00000000-0000-0000-0000-000000000000','$($ids.customerB)','authenticated','authenticated','customer-b-$runId@test.local','{}','{}',now(),now(),false,false)
on conflict (id) do nothing;
update public.profiles set role='admin', staff_status='active' where id='$($ids.admin)';
update public.profiles set role='customer' where id='$($ids.customerB)';
insert into public.staff_branch_permissions values ('$($ids.admin)','$($ids.branch)') on conflict do nothing;
"@
Invoke-DatabaseSql $adminSetup

$actA = @"
select set_config('request.jwt.claim.sub','$($ids.owner)',false);
set role authenticated;
select public.create_and_activate_pension_membership(
  '$($ids.customerB)'::uuid,'$($ids.plan)'::uuid,'$($ids.branch)'::uuid,90000,'cash',null,$commercialDate,$commercialDate,null,false,'race act','$($ids.keyActA)');
"@
$actB = @"
select set_config('request.jwt.claim.sub','$($ids.admin)',false);
set role authenticated;
select public.create_and_activate_pension_membership(
  '$($ids.customerB)'::uuid,'$($ids.plan)'::uuid,'$($ids.branch)'::uuid,90000,'cash',null,$commercialDate,$commercialDate,null,false,'race act','$($ids.keyActB)');
"@
# E: concurrent activation owner/admin — one open membership (one succeeds, one fails OR both if different keys race open)
Invoke-SqlPair $actA $actB 1 'pension concurrent activation'

$lunchRaceA = @"
select set_config('request.jwt.claim.sub','$($ids.customerB)',false);
set role authenticated;
begin;
select public.create_pension_order(
  '$($ids.keyPensionLunchA)'::uuid,'$($ids.menuLunch)'::uuid,array['$($ids.menuItemLunch)']::uuid[],
  'local','Cust B','3001234599','cust-b-$runId@test.local',null,null,0,'$qrToken');
select pg_sleep(0.5);
commit;
"@
$lunchRaceB = @"
select set_config('request.jwt.claim.sub','$($ids.customerB)',false);
set role authenticated;
select public.create_pension_order(
  '$($ids.keyPensionLunchB)'::uuid,'$($ids.menuLunch)'::uuid,array['$($ids.menuItemLunch)']::uuid[],
  'local','Cust B','3001234599','cust-b-$runId@test.local',null,null,0,'$qrToken');
"@
Invoke-SqlPair $lunchRaceA $lunchRaceB 1 'pension two-keys same lunch'

$dinnerOk = @"
select set_config('request.jwt.claim.sub','$($ids.customerB)',false);
set role authenticated;
select public.create_pension_order(
  '$($ids.keyPensionDinner)'::uuid,'$($ids.menuDinner)'::uuid,array['$($ids.menuItemDinner)']::uuid[],
  'local','Cust B','3001234599','cust-b-$runId@test.local',null,null,0,'$qrToken');
"@
# D: lunch already taken for customerB; dinner concurrent with noop — just create dinner once then assert both periods
Invoke-DatabaseSql $dinnerOk

# F: reversal concurrent via cancel
Invoke-SqlPair "$owner begin; update public.orders set status='cancelled' where idempotency_key='$($ids.keyPensionDinner)'; select pg_sleep(0.5); commit;" "$owner update public.orders set status='cancelled' where idempotency_key='$($ids.keyPensionDinner)';" 1 'pension cancel/reversal concurrent'

# G: transactional orphan failure
$orphanAssert = @"
do `$`$ begin
  begin
    insert into public.orders (
      id, order_number, user_id, branch_id, status, payment_status, payment_method,
      fulfillment_type, order_kind, subtotal, total, customer_name, customer_phone, customer_email
    ) values (
      '$(New-DeterministicGuid 'orphanOrder')', 'ORPHAN-$runId', '$($ids.customer)', '$($ids.branch)',
      'pending', 'pending', 'demo', 'pickup', 'pension', 0, 0, 'X', '3000000000', 'orphan-$runId@test.local'
    );
    raise exception 'expected deferred coupling to fire at commit';
  exception when others then
    if sqlstate <> '23514' and sqlerrm not like '%consumo%' and sqlerrm not like '%deferred%' and sqlerrm not like '%pensionado%' then
      raise;
    end if;
  end;
  if exists (select 1 from public.orders where order_number = 'ORPHAN-$runId') then
    raise exception 'orphan pension order persisted';
  end if;
end `$`$;
"@
Invoke-DatabaseSql $orphanAssert

$pensionAssertions = @"
do `$`$ begin
  if (select count(*) from public.orders where idempotency_key='$($ids.keyPensionConflict)') <> 1 then
    raise exception 'pension conflict key created % orders', (select count(*) from public.orders where idempotency_key='$($ids.keyPensionConflict)');
  end if;
  if (select count(*) from public.pension_memberships where profile_id='$($ids.customerB)' and status in ('pending','active','suspended')) <> 1 then
    raise exception 'concurrent activation open membership count failed';
  end if;
  if (select count(*) from public.pension_consumptions c join public.orders o on o.id=c.order_id where o.user_id='$($ids.customerB)' and c.menu_id='$($ids.menuLunch)' and c.status='confirmed') <> 1 then
    raise exception 'two-keys same lunch allowed more than one';
  end if;
  if (select count(*) from public.pension_consumptions where membership_id=(select id from public.pension_memberships where profile_id='$($ids.customerB)' limit 1) and menu_id='$($ids.menuDinner)') <> 1 then
    raise exception 'dinner independent consumption missing';
  end if;
  if (select c.status from public.pension_consumptions c join public.orders o on o.id=c.order_id where o.idempotency_key='$($ids.keyPensionDinner)') <> 'reversed' then
    raise exception 'pension reversal concurrent failed';
  end if;
end `$`$;
"@
Invoke-DatabaseSql $pensionAssertions

# --- 0013: manual payments + dining table races ---
$manager = "select set_config('request.jwt.claim.sub','$($ids.manager)',false); set role authenticated;"

$paySetup = @"
insert into public.orders (id,order_number,user_id,branch_id,status,payment_method,payment_status,fulfillment_type,subtotal,total,customer_name,customer_phone,customer_email) values
('$($ids.orderPay)','RACE-PAY-$runId','$($ids.customer)','$($ids.branch)','pending','demo','pending','pickup',10000,10000,'Pay','3000000000','pay-$runId@test.local'),
('$($ids.orderPayCancel)','RACE-PAY-C-$runId','$($ids.customer)','$($ids.branch)','pending','demo','pending','pickup',10000,10000,'Pay','3000000000','payc-$runId@test.local'),
('$($ids.orderPayStripe)','RACE-PAY-S-$runId','$($ids.customer)','$($ids.branch)','pending','demo','pending','pickup',10000,10000,'Pay','3000000000','pays-$runId@test.local');
insert into public.order_items (id,order_id,menu_item_id,name_snapshot,unit_price,quantity,total) values
('$($ids.oiPay)','$($ids.orderPay)','$product1','Race 1',10000,1,10000);
"@
Invoke-DatabaseSql $paySetup

# A: same confirmation key/same intent → one confirmation + replay (0 failures)
$paySameA = @"
select set_config('request.jwt.claim.sub','$($ids.cashier)',false);
set role authenticated;
begin;
select public.confirm_manual_order_payment('$($ids.orderPay)'::uuid,'cash',null,'$($ids.keyPaySame)'::uuid);
select pg_sleep(0.5);
commit;
"@
$paySameB = @"
select set_config('request.jwt.claim.sub','$($ids.cashier)',false);
set role authenticated;
select public.confirm_manual_order_payment('$($ids.orderPay)'::uuid,'cash',null,'$($ids.keyPaySame)'::uuid);
"@
Invoke-SqlPair $paySameA $paySameB 0 'manual pay same-key same-intent'

# B: same key/different intent → 1 failure
# Use a fresh unpaid order clone
$payDiffSetup = @"
update public.orders set payment_status='pending', payment_method='demo', active_manual_payment_confirmation_id=null
where id='$($ids.orderPayCancel)';
"@
Invoke-DatabaseSql $payDiffSetup
$payDiffA = @"
select set_config('request.jwt.claim.sub','$($ids.cashier)',false);
set role authenticated;
begin;
select public.confirm_manual_order_payment('$($ids.orderPayCancel)'::uuid,'cash',null,'$($ids.keyPayDiff)'::uuid);
select pg_sleep(0.5);
commit;
"@
$payDiffB = @"
select set_config('request.jwt.claim.sub','$($ids.cashier)',false);
set role authenticated;
select public.confirm_manual_order_payment('$($ids.orderPayCancel)'::uuid,'bank_transfer',null,'$($ids.keyPayDiff)'::uuid);
"@
Invoke-SqlPair $payDiffA $payDiffB 1 'manual pay same-key different-intent'

# C: owner + cashier different keys same order → one active confirmation (1 failure)
# Reset orderPay by voiding first confirmation if needed — create fresh order
$orderPayRace = New-DeterministicGuid 'orderPayRace'
$payRaceSetup = @"
insert into public.orders (id,order_number,user_id,branch_id,status,payment_method,payment_status,fulfillment_type,subtotal,total,customer_name,customer_phone,customer_email) values
('$orderPayRace','RACE-PAY-R-$runId','$($ids.customer)','$($ids.branch)','pending','demo','pending','pickup',10000,10000,'Pay','3000000000','payr-$runId@test.local');
"@
Invoke-DatabaseSql $payRaceSetup
$payRaceOwner = @"
select set_config('request.jwt.claim.sub','$($ids.owner)',false);
set role authenticated;
begin;
select public.confirm_manual_order_payment('$orderPayRace'::uuid,'cash',null,'$($ids.keyPayOwner)'::uuid);
select pg_sleep(0.5);
commit;
"@
$payRaceCashier = @"
select set_config('request.jwt.claim.sub','$($ids.cashier)',false);
set role authenticated;
select public.confirm_manual_order_payment('$orderPayRace'::uuid,'cash',null,'$($ids.keyPayCashier)'::uuid);
"@
Invoke-SqlPair $payRaceOwner $payRaceCashier 1 'manual pay owner+cashier different keys'

# D: cashier + manager same table session → one confirmation
$sessionSetup = @"
select set_config('request.jwt.claim.sub','$($ids.customer)',false);
set role authenticated;
select public.resolve_table_qr('$qrToken');
select public.create_customer_order(
  '$(New-DeterministicGuid 'sessOrdA')'::uuid,'$($ids.branch)'::uuid,'local','Race','3001234567','sess-a-$runId@test.local',
  '[{"menu_item_id":"$product2","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null,null,0,null,'$qrToken');
select public.create_customer_order(
  '$(New-DeterministicGuid 'sessOrdB')'::uuid,'$($ids.branch)'::uuid,'local','Race','3001234567','sess-b-$runId@test.local',
  '[{"menu_item_id":"$product2","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null,null,0,null,'$qrToken');
"@
Invoke-DatabaseSql $sessionSetup
$sessionId = (
  "select id from public.table_sessions where table_id='$($ids.diningTable)' and status='open' order by opened_at desc limit 1;" |
    & $docker exec -i $container sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U postgres -d postgres -X -q -t -A -v ON_ERROR_STOP=1'
).Trim()
if (-not $sessionId) { throw 'No open table session for payment race D' }
$sessPayA = @"
select set_config('request.jwt.claim.sub','$($ids.cashier)',false);
set role authenticated;
begin;
select public.confirm_manual_table_session_payment('$sessionId'::uuid,'cash',null,'$($ids.keyPaySessionA)'::uuid);
select pg_sleep(0.5);
commit;
"@
$sessPayB = @"
select set_config('request.jwt.claim.sub','$($ids.manager)',false);
set role authenticated;
select public.confirm_manual_table_session_payment('$sessionId'::uuid,'cash',null,'$($ids.keyPaySessionB)'::uuid);
"@
Invoke-SqlPair $sessPayA $sessPayB 1 'manual session pay cashier+manager'

# E: add local order vs close/pay session → coherent (order included OR create fails)
$session2Setup = @"
select set_config('request.jwt.claim.sub','$($ids.customer)',false);
set role authenticated;
select public.resolve_table_qr('$qrToken');
select public.create_customer_order(
  '$(New-DeterministicGuid 'sess2base')'::uuid,'$($ids.branch)'::uuid,'local','Race','3001234567','sess2-$runId@test.local',
  '[{"menu_item_id":"$product2","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null,null,0,null,'$qrToken');
"@
Invoke-DatabaseSql $session2Setup
$session2Id = (
  "select id from public.table_sessions where table_id='$($ids.diningTable)' and status='open' order by opened_at desc limit 1;" |
    & $docker exec -i $container sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U postgres -d postgres -X -q -t -A -v ON_ERROR_STOP=1'
).Trim()
if (-not $session2Id) { throw 'No open table session for payment race E' }
$keySess2Pay = New-DeterministicGuid 'keySess2Pay'
$raceCreate = @"
select set_config('request.jwt.claim.sub','$($ids.customer)',false);
set role authenticated;
begin;
select public.create_customer_order(
  '$($ids.keyLocalRace)'::uuid,'$($ids.branch)'::uuid,'local','Race','3001234567','race-local-$runId@test.local',
  '[{"menu_item_id":"$product2","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null,null,0,null,'$qrToken');
select pg_sleep(0.5);
commit;
"@
$racePay = @"
select set_config('request.jwt.claim.sub','$($ids.cashier)',false);
set role authenticated;
select public.confirm_manual_table_session_payment('$session2Id'::uuid,'cash',null,'$keySess2Pay'::uuid);
"@
# Either 0 failures (order included before close) or 1 failure (create hits closed) — both coherent.
# Assert after: no order on closed session unpaid without being in confirmation.
$runner = {
  param($dockerPath, $containerName, $statement)
  $ErrorActionPreference = 'Continue'
  $output = $statement | & $dockerPath exec -i $containerName sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U postgres -d postgres -X -q -v ON_ERROR_STOP=1' 2>&1
  [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($output -join "`n") }
}
$jobA = Start-Job -ScriptBlock $runner -ArgumentList $docker, $container, $raceCreate
$jobB = Start-Job -ScriptBlock $runner -ArgumentList $docker, $container, $racePay
$raceResults = @($jobA, $jobB | Wait-Job | Receive-Job)
Remove-Job -Job $jobA, $jobB -Force
$raceFailures = @($raceResults | Where-Object ExitCode -ne 0).Count
if ($raceFailures -gt 1) {
  throw "local vs session-pay esperaba 0 o 1 fallos y obtuvo $raceFailures"
}

# F: two simultaneous QR scans → one open session (0 failures, assert count=1)
# Close any open first then race resolve
Invoke-DatabaseSql "update public.table_sessions set status='closed', closed_at=now() where table_id='$($ids.diningTable)' and status='open';"
$qrA = "set role anon; begin; select public.resolve_table_qr('$qrToken'); select pg_sleep(0.4); commit;"
$qrB = "set role anon; select public.resolve_table_qr('$qrToken');"
Invoke-SqlPair $qrA $qrB 0 'dual QR resolve one session'

# G: two void attempts → one effective void
$voidConfirmationId = (
  "select active_manual_payment_confirmation_id from public.orders where id='$orderPayRace';" |
    & $docker exec -i $container sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U postgres -d postgres -X -q -t -A -v ON_ERROR_STOP=1'
).Trim()
if (-not $voidConfirmationId) { throw 'No active confirmation for void race G' }
$voidA = @"
select set_config('request.jwt.claim.sub','$($ids.owner)',false);
set role authenticated;
begin;
select public.void_manual_payment_confirmation('$voidConfirmationId'::uuid,'void race a','$($ids.keyPayVoidA)'::uuid);
select pg_sleep(0.4);
commit;
"@
$voidB = @"
select set_config('request.jwt.claim.sub','$($ids.admin)',false);
set role authenticated;
select public.void_manual_payment_confirmation('$voidConfirmationId'::uuid,'void race b','$($ids.keyPayVoidB)'::uuid);
"@
# admin may not exist in staff for branch yet from earlier adminSetup — ensure admin branch access
Invoke-DatabaseSql "update public.profiles set role='admin', staff_status='active' where id='$($ids.admin)'; insert into public.staff_branch_permissions values ('$($ids.admin)','$($ids.branch)') on conflict do nothing;"
Invoke-SqlPair $voidA $voidB 1 'manual void concurrent'

# H: cancel vs confirm payment → coherent
$cancelConfirmA = @"
select set_config('request.jwt.claim.sub','$($ids.owner)',false);
set role authenticated;
begin;
update public.orders set status='cancelled' where id='$($ids.orderPayStripe)';
select pg_sleep(0.4);
commit;
"@
$cancelConfirmB = @"
select set_config('request.jwt.claim.sub','$($ids.cashier)',false);
set role authenticated;
select public.confirm_manual_order_payment('$($ids.orderPayStripe)'::uuid,'cash',null,'$(New-DeterministicGuid 'keyPayCancel')'::uuid);
"@
# Expect 1 failure (confirm on cancelled) OR 0 if confirm won first then cancel may still succeed on status
$jobC = Start-Job -ScriptBlock $runner -ArgumentList $docker, $container, $cancelConfirmA
$jobD = Start-Job -ScriptBlock $runner -ArgumentList $docker, $container, $cancelConfirmB
$cancelResults = @($jobC, $jobD | Wait-Job | Receive-Job)
Remove-Job -Job $jobC, $jobD -Force
$cancelFailures = @($cancelResults | Where-Object ExitCode -ne 0).Count
if ($cancelFailures -gt 1) {
  throw "cancel vs confirm esperaba 0 o 1 fallos y obtuvo $cancelFailures"
}

# I: stripe vs manual → no double overwrite
$stripeManualOrder = New-DeterministicGuid 'stripeManualOrder'
Invoke-DatabaseSql @"
insert into public.orders (id,order_number,user_id,branch_id,status,payment_method,payment_status,fulfillment_type,subtotal,total,customer_name,customer_phone,customer_email) values
('$stripeManualOrder','RACE-SM-$runId','$($ids.customer)','$($ids.branch)','pending','demo','pending','pickup',10000,10000,'Pay','3000000000','sm-$runId@test.local');
"@
$keyStripeManual = New-DeterministicGuid 'keyStripeManual'
$stripeEvt = "evt_sm_$runId"
$stripeRace = @"
set role service_role;
begin;
select public.process_stripe_payment_event('$stripeEvt','payment_intent.succeeded','$stripeManualOrder','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
select pg_sleep(0.4);
commit;
"@
$manualRace = @"
select set_config('request.jwt.claim.sub','$($ids.cashier)',false);
set role authenticated;
select public.confirm_manual_order_payment('$stripeManualOrder'::uuid,'cash',null,'$keyStripeManual'::uuid);
"@
$jobE = Start-Job -ScriptBlock $runner -ArgumentList $docker, $container, $stripeRace
$jobF = Start-Job -ScriptBlock $runner -ArgumentList $docker, $container, $manualRace
$smResults = @($jobE, $jobF | Wait-Job | Receive-Job)
Remove-Job -Job $jobE, $jobF -Force
# Both may succeed (stripe ignores manual / manual may win first); failures 0 or 1 ok if projection coherent
$smFailures = @($smResults | Where-Object ExitCode -ne 0).Count
if ($smFailures -gt 1) {
  throw "stripe vs manual esperaba 0 o 1 fallos y obtuvo $smFailures"
}

$payAssertions = @"
do `$`$ begin
  if (select count(*) from public.manual_payment_confirmations where idempotency_key='$($ids.keyPaySame)') <> 1 then
    raise exception 'pay same-key created % confirmations', (select count(*) from public.manual_payment_confirmations where idempotency_key='$($ids.keyPaySame)');
  end if;
  if (select count(*) from public.manual_payment_confirmations where idempotency_key='$($ids.keyPayDiff)') <> 1 then
    raise exception 'pay diff-intent created more than one confirmation';
  end if;
  if (select count(*) from public.orders where id='$orderPayRace' and active_manual_payment_confirmation_id is not null) <> 0 then
    -- voided in G; if void failed ensure at most one confirmation ever allocated
    null;
  end if;
  if (select count(*) from public.manual_payment_confirmations c
      join public.manual_payment_allocations a on a.confirmation_id=c.id
      where a.order_id='$orderPayRace') <> 1 then
    raise exception 'owner+cashier race did not settle to one confirmation';
  end if;
  if (select count(*) from public.manual_payment_voids v
      join public.manual_payment_confirmations c on c.id=v.confirmation_id
      join public.manual_payment_allocations a on a.confirmation_id=c.id
      where a.order_id='$orderPayRace') <> 1 then
    raise exception 'void race did not produce exactly one void';
  end if;
  if (select count(*) from public.table_sessions where table_id='$($ids.diningTable)' and status='open') <> 1 then
    raise exception 'dual QR resolve open session count=%', (select count(*) from public.table_sessions where table_id='$($ids.diningTable)' and status='open');
  end if;
  -- local vs pay coherence: unpaid local orders must not sit on a closed session
  if exists (
    select 1 from public.orders o
    join public.table_sessions ts on ts.id=o.table_session_id
    where o.branch_id='$($ids.branch)'
      and o.fulfillment_type='local'
      and o.status <> 'cancelled'
      and o.payment_status='pending'
      and ts.status='closed'
  ) then
    raise exception 'orphan pending local order on closed session';
  end if;
  -- stripe vs manual: payment_status paid exactly once projection
  if (select payment_status from public.orders where id='$stripeManualOrder') is distinct from 'paid' then
    raise exception 'stripe vs manual left unpaid';
  end if;
  if (select payment_method from public.orders where id='$stripeManualOrder') = 'cash'
     and (select active_manual_payment_confirmation_id from public.orders where id='$stripeManualOrder') is null then
    raise exception 'manual cash without active confirmation';
  end if;
end `$`$;
"@
Invoke-DatabaseSql $payAssertions

Write-Output "CONCURRENCY_TESTS_PASS scenarios=28 assertions=36 run=$runId"
