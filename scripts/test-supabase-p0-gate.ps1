param(
  [switch]$ValidateHttpGate,
  [switch]$InjectFailureAfterHttpFixture,
  [switch]$InjectHttpCleanupFailure,
  [switch]$InjectFailureAfterHistorical,
  [switch]$InjectCleanupFailure,
  [switch]$ParserSelfTest,
  [switch]$StatusInvocationSelfTest,
  [switch]$LogSelfTest,
  [switch]$LogInvocationSelfTest,
  [switch]$HeaderSelfTest
)

$ErrorActionPreference = "Stop"

# This runner is deliberately pinned to the separately authorized P0 stack.
# It never calls `supabase ... --local` from the repository's implicit project.
$ExpectedProjectId = "brisas-sinu-p0-gate-20261016"
$ProjectRoot = "C:\Temp\brisas-sinu-p0-gate-20261016"
$ExpectedDbPort = 60422
$ExpectedApiPort = 60421
$ExpectedStudioPort = 60423
$ExpectedShadowPort = 60420
$ExpectedInbucketPort = 60424
$ExpectedAnalyticsPort = 60427
$ExpectedVolume = "supabase_db_brisas-sinu-p0-gate-20261016"
$DbContainer = "supabase_db_$ExpectedProjectId"
$KongContainer = "supabase_kong_$ExpectedProjectId"
$HttpTestPort = 60430
$HttpFixtureRestaurantId = "f5000000-0000-0000-0000-000000000001"
$HttpFixtureBranchId = "f6000000-0000-0000-0000-000000000001"
$HttpFixtureCategoryId = "f7000000-0000-0000-0000-000000000001"
$HttpFixtureMenuItemId = "p0-http-gate-main"
$HttpFixtureIdempotencyKey = "f8000000-0000-0000-0000-000000000001"
$HttpFixtureRestaurantSlug = "p0-http-gate-fixture"
$HttpFixtureBranchSlug = "centro"
$HttpHarnessDirectoryName = ".p0-http-harness"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".." )).Path
$script:TargetStatus = $null
$script:HttpProcess = $null
$script:HttpFixtureCreated = $false
$script:HttpHarnessDirectory = $null
$script:HttpPreloadPath = $null
$script:HttpStdoutPath = $null
$script:HttpStderrPath = $null
$script:HttpClockMarkerPath = $null
$script:HttpRpcBaseline = $null
$script:HttpRequestStartUtc = $null
$script:HttpRequestEndUtc = $null
$script:SavedHttpEnvironment = @{}

Add-Type -AssemblyName System.Net.Http

$HistoricalTests = @(
  "supabase/tests/0001_backend_security.test.sql",
  "supabase/tests/0010_create_customer_order.test.sql",
  "supabase/tests/0011_profiles_staff_status_grant.test.sql",
  "supabase/tests/0012_delivery_inventory.test.sql",
  "supabase/tests/0013_pension_orders.test.sql",
  "supabase/tests/0014_manual_payments_dining_tables.test.sql",
  "supabase/tests/0015_payment_read_models.test.sql",
  "supabase/tests/0016_authoritative_order_integrity.test.sql",
  "supabase/tests/0017_guest_receipt_recovery.test.sql"
)
$GateTest = "supabase/tests/0018_public_order_intake_gate.test.sql"

function Stop-Runner([string]$Message) {
  throw "P0 gate runner: $Message"
}

function Get-HttpHeaderValues([System.Net.Http.HttpResponseMessage]$Response, [string]$Name) {
  $values = @()
  $responseValues = $null
  if ($Response.Headers.TryGetValues($Name, [ref]$responseValues)) {
    $values += @($responseValues)
  }
  if ($null -ne $Response.Content -and $null -ne $Response.Content.Headers) {
    $contentValues = $null
    if ($Response.Content.Headers.TryGetValues($Name, [ref]$contentValues)) {
      $values += @($contentValues)
    }
  }
  return $values
}

function Assert-HttpNoStore([System.Net.Http.HttpResponseMessage]$Response) {
  $values = @(Get-HttpHeaderValues $Response "Cache-Control")
  if ($values.Count -eq 0) { Stop-Runner "la respuesta HTTP no contiene Cache-Control." }
  $joined = ($values -join ",")
  if ($joined -notmatch '(?i)(^|,)\s*no-store\s*(,|$)') {
    Stop-Runner "la respuesta HTTP no contiene la directiva Cache-Control: no-store."
  }
  return "no-store"
}

function Invoke-HeaderSelfTest {
  $passed = 0
  $normal = [System.Net.Http.HttpResponseMessage]::new([System.Net.HttpStatusCode]::ServiceUnavailable)
  [void]$normal.Headers.TryAddWithoutValidation("Cache-Control", "no-store")
  if ((Assert-HttpNoStore $normal) -eq "no-store") { $passed++ }
  $normal.Dispose()

  $untyped = [System.Net.Http.HttpResponseMessage]::new([System.Net.HttpStatusCode]::ServiceUnavailable)
  [void]$untyped.Headers.TryAddWithoutValidation("Cache-Control", "no-store")
  if ((Assert-HttpNoStore $untyped) -eq "no-store") { $passed++ }
  $untyped.Dispose()

  $multiple = [System.Net.Http.HttpResponseMessage]::new([System.Net.HttpStatusCode]::ServiceUnavailable)
  [void]$multiple.Headers.TryAddWithoutValidation("Cache-Control", "private")
  [void]$multiple.Headers.TryAddWithoutValidation("Cache-Control", "no-store")
  if ((Assert-HttpNoStore $multiple) -eq "no-store") { $passed++ }
  $multiple.Dispose()

  $rejected = 0
  foreach ($response in @(
    [System.Net.Http.HttpResponseMessage]::new([System.Net.HttpStatusCode]::ServiceUnavailable),
    [System.Net.Http.HttpResponseMessage]::new([System.Net.HttpStatusCode]::ServiceUnavailable)
  )) {
    try { [void](Assert-HttpNoStore $response) } catch { $rejected++ } finally { $response.Dispose() }
  }
  $withoutNoStore = [System.Net.Http.HttpResponseMessage]::new([System.Net.HttpStatusCode]::ServiceUnavailable)
  [void]$withoutNoStore.Headers.TryAddWithoutValidation("Cache-Control", "private, max-age=0")
  try { [void](Assert-HttpNoStore $withoutNoStore) } catch { $rejected++ } finally { $withoutNoStore.Dispose() }

  if ($passed -ne 3 -or $rejected -ne 3) { Stop-Runner "pruebas sintéticas de Cache-Control no cumplieron el fail-closed esperado." }
  Write-Output "P0_HEADER_SELFTEST_PASS accepted=3 rejected=3"
}

function Resolve-LocalExecutable([string]$Name) {
  $command = Get-Command "$Name.exe" -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $command) {
    $command = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  }
  if (-not $command) { Stop-Runner "no se encontró el ejecutable local $Name." }
  $path = [string]$command.Source
  $extension = [IO.Path]::GetExtension($path).ToLowerInvariant()
  if ($extension -in @('.cmd', '.bat', '.ps1')) {
    $siblingExe = Join-Path ([IO.Path]::GetDirectoryName($path)) "$Name.exe"
    if (-not (Test-Path -LiteralPath $siblingExe -PathType Leaf)) {
      Stop-Runner "$Name se resolvió a un shim $extension sin ejecutable .exe inequívoco."
    }
    return $siblingExe
  }
  return $path
}

function ConvertTo-WindowsArgument([string]$Value) {
  if ($Value -notmatch '[\s"]') { return $Value }
  return '"' + $Value.Replace('\', '\\').Replace('"', '\"') + '"'
}

function Invoke-ProcessCapture([string]$FilePath, [string[]]$Arguments) {
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $FilePath
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.Arguments = (($Arguments | ForEach-Object { ConvertTo-WindowsArgument $_ }) -join ' ')
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  try {
    if (-not $process.Start()) { Stop-Runner "no se pudo iniciar $FilePath." }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    return [pscustomobject]@{
      ExitCode = $process.ExitCode
      Stdout = $stdoutTask.GetAwaiter().GetResult()
      Stderr = $stderrTask.GetAwaiter().GetResult()
    }
  } finally {
    $process.Dispose()
  }
}

function Convert-StatusJson([string]$Stdout, [string]$Stderr) {
  $stderrLines = @($Stderr -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  foreach ($line in $stderrLines) {
    $cleanLine = [regex]::Replace($line, "`e\[[0-9;]*m", "").Trim()
    if ($cleanLine -notmatch '^Stopped services:\s*\[[^\r\n]*\]$') {
      Stop-Runner "status emitió un diagnóstico no permitido; destino ambiguo."
    }
  }

  $statusText = if ($null -eq $Stdout) { "" } else { $Stdout.Trim() }
  if (-not $statusText -or -not $statusText.StartsWith("{") -or -not $statusText.EndsWith("}")) {
    Stop-Runner "status no contiene exactamente un objeto JSON en stdout."
  }
  $depth = 0
  $inString = $false
  $escaped = $false
  $completeAt = -1
  for ($index = 0; $index -lt $statusText.Length; $index++) {
    $character = $statusText[$index]
    if ($inString) {
      if ($escaped) { $escaped = $false; continue }
      if ($character -eq '\') { $escaped = $true; continue }
      if ($character -eq '"') { $inString = $false }
      continue
    }
    if ($character -eq '"') { $inString = $true; continue }
    if ($character -eq '{') { $depth++; continue }
    if ($character -eq '}') {
      $depth--
      if ($depth -lt 0) { Stop-Runner "status no contiene exactamente un objeto JSON." }
      if ($depth -eq 0) { $completeAt = $index }
    }
  }
  if ($inString -or $depth -ne 0 -or $completeAt -ne ($statusText.Length - 1)) {
    Stop-Runner "status no contiene exactamente un objeto JSON."
  }
  try { $status = $statusText | ConvertFrom-Json } catch { Stop-Runner "status del proyecto no es JSON válido." }
  if ($null -eq $status -or @($status).Count -ne 1 -or $status -is [array]) {
    Stop-Runner "status no contiene un objeto JSON raíz."
  }
  return $status
}

function Invoke-SupabaseStatus {
  $command = Get-Command supabase.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $command) {
    $command = Get-Command supabase -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  }
  if (-not $command) { Stop-Runner "no se encontró el ejecutable local de Supabase CLI." }
  $cliPath = [string]$command.Source
  $extension = [IO.Path]::GetExtension($cliPath).ToLowerInvariant()
  if ($extension -in @('.cmd', '.bat', '.ps1')) {
    $siblingExe = Join-Path ([IO.Path]::GetDirectoryName($cliPath)) 'supabase.exe'
    if (-not (Test-Path -LiteralPath $siblingExe -PathType Leaf)) {
      Stop-Runner "Supabase CLI se resolvió a un shim $extension sin ejecutable .exe inequívoco."
    }
    $cliPath = $siblingExe
  }
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $cliPath
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $quotedProjectRoot = '"' + $ProjectRoot.Replace('"', '\"') + '"'
  $startInfo.Arguments = "status --workdir $quotedProjectRoot -o json"
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  try {
    if (-not $process.Start()) { Stop-Runner "no se pudo iniciar Supabase CLI para leer status." }
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { Stop-Runner "Supabase CLI status terminó con código no cero." }
    return Convert-StatusJson $stdout $stderr
  } catch [System.Management.Automation.RuntimeException] { throw }
  catch { Stop-Runner "no se pudo capturar status de Supabase sin mezclar stdout y stderr." }
  finally { $process.Dispose() }
}

function Invoke-StatusInvocationSelfTest {
  $status = Invoke-SupabaseStatus
  if ([string]$status.API_URL -cne "http://127.0.0.1:$ExpectedApiPort") {
    Stop-Runner "la invocación aislada devolvió una API distinta al séptimo entorno."
  }
  if ([string]$status.DB_URL -notmatch ":$ExpectedDbPort/postgres$") {
    Stop-Runner "la invocación aislada devolvió una DB distinta al séptimo entorno."
  }
  Write-Output "P0_STATUS_INVOCATION_SELFTEST_PASS api=127.0.0.1:$ExpectedApiPort db=127.0.0.1:$ExpectedDbPort"
}

function Invoke-StatusParserSelfTest {
  $valid = '{"API_URL":"http://127.0.0.1:60421","DB_URL":"postgresql://postgres:masked@127.0.0.1:60422/postgres"}'
  $accepted = 0
  try { [void](Convert-StatusJson $valid ""); $accepted++ } catch { }
  try { [void](Convert-StatusJson $valid "Stopped services: [svc]"); $accepted++ } catch { }

  $rejected = 0
  foreach ($case in @(
    @{ stdout = '{invalid'; stderr = '' },
    @{ stdout = "$valid`n$valid"; stderr = '' },
    @{ stdout = "Stopped services: [svc]`n$valid"; stderr = '' },
    @{ stdout = $valid; stderr = 'unexpected diagnostic' }
  )) {
    try { [void](Convert-StatusJson $case.stdout $case.stderr) } catch { $rejected++ }
  }
  if ($accepted -ne 2 -or $rejected -ne 4) { Stop-Runner "pruebas sintéticas del parser no cumplieron el fail-closed esperado." }
  Write-Output "P0_STATUS_PARSER_SELFTEST_PASS accepted=2 rejected=4"
}

function Read-ConfigSection([string]$Section) {
  $configPath = Join-Path $ProjectRoot "supabase\config.toml"
  $text = Get-Content -Raw $configPath
  $escaped = [regex]::Escape($Section)
  $match = [regex]::Match($text, "(?ms)^\[$escaped\]\s*(?<body>.*?)(?=^\[|\z)")
  if (-not $match.Success) { Stop-Runner "falta la sección [$Section] en config.toml." }
  return $match.Groups["body"].Value
}

function Read-ConfigPort([string]$Section, [string]$Key) {
  $body = Read-ConfigSection $Section
  $match = [regex]::Match($body, "(?m)^\s*$([regex]::Escape($Key))\s*=\s*(?<value>\d+)\s*$")
  if (-not $match.Success) { Stop-Runner "falta [$Section].$Key en config.toml." }
  return [int]$match.Groups["value"].Value
}

function Assert-TargetIdentity {
  if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    Stop-Runner "no existe la carpeta autorizada $ProjectRoot."
  }

  $configPath = Join-Path $ProjectRoot "supabase\config.toml"
  if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    Stop-Runner "falta supabase/config.toml en el proyecto autorizado."
  }
  if (Test-Path -LiteralPath (Join-Path $ProjectRoot "supabase\.temp\project-ref")) {
    Stop-Runner "el proyecto tiene un project-ref remoto; se rechaza el destino por seguridad."
  }

  $config = Get-Content -Raw $configPath
  $projectMatch = [regex]::Match($config, '(?m)^\s*project_id\s*=\s*"(?<id>[^"]+)"\s*$')
  if (-not $projectMatch.Success -or $projectMatch.Groups["id"].Value -cne $ExpectedProjectId) {
    Stop-Runner "project_id no coincide inequívocamente con el séptimo entorno autorizado."
  }

  $ports = @{
    api = Read-ConfigPort "api" "port"
    db = Read-ConfigPort "db" "port"
    shadow = Read-ConfigPort "db" "shadow_port"
    studio = Read-ConfigPort "studio" "port"
    # Supabase CLI 2.111 names the Inbucket section local_smtp.
    inbucket = Read-ConfigPort "local_smtp" "port"
    analytics = Read-ConfigPort "analytics" "port"
  }
  $expectedPorts = @{
    api = $ExpectedApiPort; db = $ExpectedDbPort; shadow = $ExpectedShadowPort
    studio = $ExpectedStudioPort; inbucket = $ExpectedInbucketPort; analytics = $ExpectedAnalyticsPort
  }
  foreach ($name in $expectedPorts.Keys) {
    if ($ports[$name] -ne $expectedPorts[$name]) {
      Stop-Runner "el puerto $name no coincide con la configuración autorizada."
    }
  }

  $status = Invoke-SupabaseStatus
  $script:TargetStatus = $status
  $dbUrl = [string]$status.DB_URL
  if ($dbUrl -notmatch "^postgresql://postgres:[^@]+@127\.0\.0\.1:$ExpectedDbPort/postgres$") {
    Stop-Runner "DB_URL no corresponde a PostgreSQL local en el puerto autorizado."
  }
  if ($status.API_URL -cne "http://127.0.0.1:$ExpectedApiPort") {
    Stop-Runner "DB_URL/API_URL de Supabase no coinciden con el séptimo entorno."
  }

  $inspectText = (& docker inspect $DbContainer 2>$null | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $inspectText) { Stop-Runner "no se encontró el contenedor DB inequívoco del séptimo entorno." }
  try { $inspect = @($inspectText | ConvertFrom-Json)[0] } catch { Stop-Runner "docker inspect no devolvió JSON válido." }
  $labels = $inspect.Config.Labels
  if ($labels.'com.docker.compose.project' -cne $ExpectedProjectId -or
      $labels.'com.supabase.cli.project' -cne $ExpectedProjectId) {
    Stop-Runner "las etiquetas Docker no corresponden al proyecto autorizado."
  }
  $volume = @($inspect.Mounts | Where-Object { $_.Destination -eq "/var/lib/postgresql/data" })
  if ($volume.Count -ne 1 -or $volume[0].Name -cne $ExpectedVolume) {
    Stop-Runner "el volumen de PostgreSQL no coincide con el volumen autorizado."
  }

  function Assert-ServiceContainer([string]$Name, [string]$ContainerPort, [int]$HostPort) {
    $serviceText = (& docker inspect $Name 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $serviceText) {
      Stop-Runner "no se encontró el servicio Docker $Name del proyecto autorizado."
    }
    try { $service = @($serviceText | ConvertFrom-Json)[0] } catch { Stop-Runner "docker inspect inválido para $Name." }
    if ($service.Config.Labels.'com.supabase.cli.project' -cne $ExpectedProjectId) {
      Stop-Runner "el servicio $Name no pertenece al proyecto autorizado."
    }
    $portProperty = @($service.NetworkSettings.Ports.PSObject.Properties | Where-Object { $_.Name -eq $ContainerPort })[0]
    if (-not $portProperty) { Stop-Runner "el servicio $Name no publica $ContainerPort." }
    $binding = @($portProperty.Value | Where-Object { $_.HostPort -eq [string]$HostPort })
    if ($binding.Count -lt 1) {
      Stop-Runner "el servicio $Name no publica el puerto autorizado $HostPort."
    }
  }

  Assert-ServiceContainer "supabase_kong_$ExpectedProjectId" "8000/tcp" $ExpectedApiPort
  Assert-ServiceContainer "supabase_studio_$ExpectedProjectId" "3000/tcp" $ExpectedStudioPort
  Assert-ServiceContainer "supabase_inbucket_$ExpectedProjectId" "8025/tcp" $ExpectedInbucketPort

  foreach ($port in @($ExpectedApiPort, $ExpectedDbPort, $ExpectedStudioPort, $ExpectedInbucketPort)) {
    if (-not (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) {
      Stop-Runner "el puerto autorizado $port no está escuchando."
    }
  }
  foreach ($relative in @($HistoricalTests + $GateTest)) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $relative) -PathType Leaf)) {
      Stop-Runner "falta el archivo de prueba $relative."
    }
  }

  return $dbUrl
}

function Invoke-TargetSql([string]$Sql) {
  $output = $Sql | & docker exec -i $DbContainer sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U postgres -d postgres -X -q -At -v ON_ERROR_STOP=1' 2>&1
  if ($LASTEXITCODE -ne 0) { throw (($output -join "`n").Trim()) }
  return ($output -join "`n").Trim()
}

function Assert-GateClosed {
  $state = Invoke-TargetSql "select enabled::text from private.public_order_intake_gate where singleton is true;"
  if ($state -cne "false") { Stop-Runner "la compuerta no está cerrada (estado observado: $state)." }
}

function Get-TargetPublicKey {
  if (-not $script:TargetStatus) { Stop-Runner "no existe status validado del proyecto objetivo." }
  $key = [string]$script:TargetStatus.PUBLISHABLE_KEY
  if ([string]::IsNullOrWhiteSpace($key)) { $key = [string]$script:TargetStatus.ANON_KEY }
  if ([string]::IsNullOrWhiteSpace($key)) { Stop-Runner "el proyecto local no expone una clave publicable/anon válida." }
  return $key
}

function Assert-HttpFixtureAbsent {
  $probeRaw = Invoke-TargetSql @"
select count(*) from public.restaurants where id='$HttpFixtureRestaurantId'::uuid or slug='$HttpFixtureRestaurantSlug';
select count(*) from public.branches where id='$HttpFixtureBranchId'::uuid or slug='$HttpFixtureBranchSlug';
select count(*) from public.categories where id='$HttpFixtureCategoryId'::uuid;
select count(*) from public.menu_items where id='$HttpFixtureMenuItemId';
select count(*) from public.orders where idempotency_key='$HttpFixtureIdempotencyKey'::uuid;
"@
  $probe = @($probeRaw -split "`r?`n" | Where-Object { $_ -ne "" })
  $probeValues = @($probe | ForEach-Object { [int]$_ })
  if ($probe.Count -ne 5 -or ($probeValues | Where-Object { $_ -ne 0 }).Count -gt 0) {
    Stop-Runner "existe contaminación o conflicto previo en el fixture HTTP; no se limpia automáticamente."
  }
}

function New-HttpFixture {
  Assert-HttpFixtureAbsent
  Invoke-TargetSql @'
begin;
insert into public.restaurants (id,name,slug,checkout_tax_rate,service_fee_rate,max_line_quantity,order_number_prefix)
values ('f5000000-0000-0000-0000-000000000001','P0 HTTP Fixture','p0-http-gate-fixture',0,0,20,'P0H');
insert into public.branches (id,restaurant_id,name,slug,pickup_enabled,delivery_enabled,delivery_fee,delivery_minimum,status,timezone)
values ('f6000000-0000-0000-0000-000000000001','f5000000-0000-0000-0000-000000000001','P0 HTTP Branch','centro',true,false,0,0,'active','America/Bogota');
insert into public.opening_hours (branch_id,day_of_week,opening_time,closing_time,is_closed)
values
  ('f6000000-0000-0000-0000-000000000001',0,time '12:00',time '17:00',false),
  ('f6000000-0000-0000-0000-000000000001',1,time '11:30',time '21:30',false),
  ('f6000000-0000-0000-0000-000000000001',2,time '11:30',time '21:30',false),
  ('f6000000-0000-0000-0000-000000000001',3,time '11:30',time '21:30',false),
  ('f6000000-0000-0000-0000-000000000001',4,time '11:30',time '22:00',false),
  ('f6000000-0000-0000-0000-000000000001',5,time '11:30',time '23:00',false),
  ('f6000000-0000-0000-0000-000000000001',6,time '12:00',time '23:00',false);
insert into public.categories (id,restaurant_id,name,slug)
values ('f7000000-0000-0000-0000-000000000001','f5000000-0000-0000-0000-000000000001','P0 HTTP Platos','p0-http-platos');
insert into public.menu_items (id,restaurant_id,category_slug,slug,name,base_price,image_path,available,is_independently_orderable)
values ('p0-http-gate-main','f5000000-0000-0000-0000-000000000001','p0-http-platos','p0-http-gate-main','P0 HTTP Main',1000,'/p0-http.jpg',true,true);
insert into public.branch_menu_items (branch_id,menu_item_id,price,available)
values ('f6000000-0000-0000-0000-000000000001','p0-http-gate-main',1000,true);
commit;
'@
  $script:HttpFixtureCreated = $true
  if ($InjectFailureAfterHttpFixture) {
    Stop-Runner "fallo controlado después de persistir el fixture HTTP y antes de verificar su forma."
  }
  $shapeRaw = Invoke-TargetSql @"
select count(*) from public.branches where id='$HttpFixtureBranchId'::uuid and slug='$HttpFixtureBranchSlug' and restaurant_id='$HttpFixtureRestaurantId'::uuid;
select count(*) from public.menu_items where id='$HttpFixtureMenuItemId' and slug='$HttpFixtureMenuItemId' and restaurant_id='$HttpFixtureRestaurantId'::uuid and available is true and is_independently_orderable is true;
select count(*) from public.branch_menu_items where branch_id='$HttpFixtureBranchId'::uuid and menu_item_id='$HttpFixtureMenuItemId' and available is true;
select enabled::text from private.public_order_intake_gate where singleton is true;
"@
  $shape = @($shapeRaw -split "`r?`n" | Where-Object { $_ -ne "" })
  if ($shape.Count -ne 4 -or $shape[0] -cne "1" -or $shape[1] -cne "1" -or $shape[2] -cne "1" -or $shape[3] -cne "false") {
    Stop-Runner "el fixture HTTP no coincide exactamente con branch-centro, catálogo o gate cerrado."
  }
}

function Remove-HttpFixture {
  if (-not $script:HttpFixtureCreated) { return }
  $orders = [int](Invoke-TargetSql "select count(*) from public.orders where branch_id='$HttpFixtureBranchId'::uuid or idempotency_key='$HttpFixtureIdempotencyKey'::uuid;")
  if ($orders -ne 0) {
    Stop-Runner "se detectó contaminación: el fixture HTTP produjo $orders pedido(s); no se borra ningún pedido automáticamente."
  }
  $countsRaw = Invoke-TargetSql @"
select count(*) from public.branch_menu_items where branch_id='$HttpFixtureBranchId'::uuid and menu_item_id='$HttpFixtureMenuItemId';
select count(*) from public.opening_hours where branch_id='$HttpFixtureBranchId'::uuid;
select count(*) from public.menu_items where id='$HttpFixtureMenuItemId';
select count(*) from public.categories where id='$HttpFixtureCategoryId'::uuid;
select count(*) from public.branches where id='$HttpFixtureBranchId'::uuid;
select count(*) from public.restaurants where id='$HttpFixtureRestaurantId'::uuid;
"@
  $counts = @($countsRaw -split "`r?`n" | Where-Object { $_ -ne "" })
  if ($counts.Count -ne 6 -or $counts[0] -cne "1" -or $counts[1] -cne "7" -or $counts[2] -cne "1" -or $counts[3] -cne "1" -or $counts[4] -cne "1" -or $counts[5] -cne "1") {
    Stop-Runner "los recuentos del fixture HTTP no son los esperados; no se borra ningún registro."
  }
  Invoke-TargetSql @'
begin;
delete from public.branch_menu_items where branch_id='f6000000-0000-0000-0000-000000000001'::uuid and menu_item_id='p0-http-gate-main';
delete from public.opening_hours where branch_id='f6000000-0000-0000-0000-000000000001'::uuid;
delete from public.menu_items where id='p0-http-gate-main' and restaurant_id='f5000000-0000-0000-0000-000000000001'::uuid;
delete from public.categories where id='f7000000-0000-0000-0000-000000000001'::uuid and restaurant_id='f5000000-0000-0000-0000-000000000001'::uuid;
delete from public.branches where id='f6000000-0000-0000-0000-000000000001'::uuid and restaurant_id='f5000000-0000-0000-0000-000000000001'::uuid;
delete from public.restaurants where id='f5000000-0000-0000-0000-000000000001'::uuid and slug='p0-http-gate-fixture';
commit;
'@
  $remainingRaw = Invoke-TargetSql @"
select count(*) from public.restaurants where id='$HttpFixtureRestaurantId'::uuid or slug='$HttpFixtureRestaurantSlug';
select count(*) from public.branches where id='$HttpFixtureBranchId'::uuid;
select count(*) from public.categories where id='$HttpFixtureCategoryId'::uuid;
select count(*) from public.menu_items where id='$HttpFixtureMenuItemId';
select count(*) from public.branch_menu_items where branch_id='$HttpFixtureBranchId'::uuid;
select count(*) from public.opening_hours where branch_id='$HttpFixtureBranchId'::uuid;
"@
  $remaining = @($remainingRaw -split "`r?`n" | Where-Object { $_ -ne "" })
  $remainingValues = @($remaining | ForEach-Object { [int]$_ })
  if ($remaining.Count -ne 6 -or ($remainingValues | Where-Object { $_ -ne 0 }).Count -gt 0) {
    Stop-Runner "la limpieza del fixture HTTP dejó registros residuales; no se intenta borrar indiscriminadamente."
  }
  $script:HttpFixtureCreated = $false
}

function New-HttpClockPreload {
  if ($env:VERCEL -or $env:VERCEL_ENV) { Stop-Runner "el harness de reloj no puede ejecutarse bajo Vercel." }
  if ($env:NODE_OPTIONS) { Stop-Runner "NODE_OPTIONS debe estar vacío para impedir activaciones implícitas." }
  $script:HttpHarnessDirectory = Join-Path $ProjectRoot $HttpHarnessDirectoryName
  if (Test-Path -LiteralPath $script:HttpHarnessDirectory) {
    Stop-Runner "existe un directorio temporal del harness anterior; se requiere inspección manual."
  }
  New-Item -ItemType Directory -Path $script:HttpHarnessDirectory -Force | Out-Null
  $script:HttpPreloadPath = Join-Path $script:HttpHarnessDirectory "fixed-clock.cjs"
  $script:HttpClockMarkerPath = Join-Path $script:HttpHarnessDirectory "date-observed.marker"
  $escapedMarkerPath = $script:HttpClockMarkerPath.Replace('\', '\\').Replace('"', '\"')
  $preload = @'
"use strict";
const fs = require("node:fs");
const markerPath = "__CLOCK_MARKER_PATH__";
let clockObserved = false;
function markClock() {
  if (clockObserved) return;
  clockObserved = true;
  try { fs.appendFileSync(markerPath, "date-controlled\n", "utf8"); } catch {}
}
const RealDate = globalThis.Date;
const fixedMilliseconds = RealDate.parse("2026-07-21T17:00:00.000Z");
function FixedDate(...args) {
  markClock();
  if (new.target) return args.length === 0 ? new RealDate(fixedMilliseconds) : new RealDate(...args);
  return new RealDate(fixedMilliseconds).toString();
}
FixedDate.prototype = RealDate.prototype;
Object.setPrototypeOf(FixedDate, RealDate);
FixedDate.now = () => { markClock(); return RealDate.now(); };
FixedDate.parse = RealDate.parse;
FixedDate.UTC = RealDate.UTC;
Object.defineProperty(globalThis, "Date", { value: FixedDate, writable: true, configurable: true });
'@
  $preload = $preload.Replace("__CLOCK_MARKER_PATH__", $escapedMarkerPath)
  Set-Content -LiteralPath $script:HttpPreloadPath -Encoding utf8 -NoNewline -Value $preload
}

function Start-HttpNextProcess {
  $key = Get-TargetPublicKey
  $script:HttpStdoutPath = Join-Path $script:HttpHarnessDirectory "next.stdout.log"
  $script:HttpStderrPath = Join-Path $script:HttpHarnessDirectory "next.stderr.log"
  $envValues = @{
    DATA_MODE = "supabase"
    AUTH_MODE = "supabase"
    NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:$ExpectedApiPort"
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $key
    NEXT_PUBLIC_SUPABASE_ANON_KEY = $key
    PUBLIC_ORDER_INTAKE_ENABLED = "true"
    GUEST_RECEIPT_RECOVERY_ENABLED = "false"
    PAYMENT_PROVIDER = "demo"
    EMAIL_PROVIDER = "none"
    NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:$HttpTestPort"
  }
  foreach ($name in $envValues.Keys) {
    $script:SavedHttpEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
    [Environment]::SetEnvironmentVariable($name, [string]$envValues[$name], "Process")
  }
  $nextCli = Join-Path $RepoRoot "node_modules\next\dist\bin\next"
  if (-not (Test-Path -LiteralPath $nextCli -PathType Leaf)) { Stop-Runner "falta el binario local de Next.js para el harness HTTP." }
  $arguments = '--require "{0}" "{1}" dev -p {2}' -f $script:HttpPreloadPath, $nextCli, $HttpTestPort
  $script:HttpProcess = Start-Process -FilePath "node.exe" -ArgumentList $arguments -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput $script:HttpStdoutPath -RedirectStandardError $script:HttpStderrPath -PassThru
  if (-not $script:HttpProcess) { Stop-Runner "no se pudo iniciar el proceso Next.js aislado." }
}

function Stop-HttpNextProcess {
  if ($script:HttpProcess) {
    $processId = $script:HttpProcess.Id
    if (-not $script:HttpProcess.HasExited) {
      & taskkill.exe /PID $processId /T /F 2>$null | Out-Null
    }
    $script:HttpProcess = $null
  }
  foreach ($name in @("DATA_MODE","AUTH_MODE","NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","NEXT_PUBLIC_SUPABASE_ANON_KEY","PUBLIC_ORDER_INTAKE_ENABLED","GUEST_RECEIPT_RECOVERY_ENABLED","PAYMENT_PROVIDER","EMAIL_PROVIDER","NEXT_PUBLIC_SITE_URL")) {
    if ($script:SavedHttpEnvironment.ContainsKey($name)) {
      [Environment]::SetEnvironmentVariable($name, $script:SavedHttpEnvironment[$name], "Process")
    }
  }
  $script:SavedHttpEnvironment = @{}
}

function Remove-HttpHarnessFiles {
  if ($script:HttpHarnessDirectory -and (Test-Path -LiteralPath $script:HttpHarnessDirectory)) {
    Remove-Item -LiteralPath $script:HttpHarnessDirectory -Recurse -Force
  }
  $script:HttpHarnessDirectory = $null
}

function Wait-HttpNextReady {
  $client = [System.Net.Http.HttpClient]::new()
  $client.Timeout = [TimeSpan]::FromSeconds(2)
  try {
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
      if ($script:HttpProcess.HasExited) { Stop-Runner "Next.js terminó antes de aceptar conexiones HTTP." }
      try {
        $response = $client.GetAsync("http://127.0.0.1:$HttpTestPort/api/orders").GetAwaiter().GetResult()
        $status = [int]$response.StatusCode
        if ($status -eq 405) {
          Set-Content -LiteralPath $script:HttpClockMarkerPath -Encoding utf8 -NoNewline -Value ""
          return
        }
      } catch { }
      Start-Sleep -Milliseconds 250
    }
    Stop-Runner "Next.js no estuvo disponible en el puerto aislado $HttpTestPort."
  } finally { $client.Dispose() }
}

function Invoke-HttpGateRequest {
  $requestBody = [ordered]@{
    idempotencyKey = $HttpFixtureIdempotencyKey
    branchId = "branch-centro"
    fulfillmentType = "pickup"
    customer = @{ name = "P0 HTTP Fixture"; phone = "3000000000"; email = "p0-http-fixture@example.test" }
    items = @(@{ slug = $HttpFixtureMenuItemId; quantity = 1; notes = ""; modifiers = @() })
    tipPercent = 0
    notes = ""
  } | ConvertTo-Json -Compress -Depth 8
  $script:HttpRequestStartUtc = [DateTimeOffset]::UtcNow.AddSeconds(-1)
  $client = [System.Net.Http.HttpClient]::new()
  $client.Timeout = [TimeSpan]::FromSeconds(10)
  try {
    $content = [System.Net.Http.StringContent]::new($requestBody, [Text.Encoding]::UTF8, "application/json")
    $response = $client.PostAsync("http://127.0.0.1:$HttpTestPort/api/orders", $content).GetAwaiter().GetResult()
    $script:HttpRequestEndUtc = [DateTimeOffset]::UtcNow.AddSeconds(1)
    $status = [int]$response.StatusCode
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if ($status -ne 503) { Stop-Runner "HTTP inesperado ($status); no se declara PASS ni se oculta la respuesta." }
    try { $json = $body | ConvertFrom-Json } catch { Stop-Runner "la respuesta 503 no fue JSON válido." }
    if ([string]$json.code -cne "public-order-intake-closed") { Stop-Runner "503 sin código public-order-intake-closed." }
    Write-Output "P0_HTTP_RESPONSE status=503 code=public-order-intake-closed"
    [void](Assert-HttpNoStore $response)
    Write-Output "P0_HTTP_HEADERS cache_control=no-store"
  } finally { $client.Dispose() }
}

function Convert-KongRpcRecords([string]$Stdout) {
  $records = @()
  foreach ($line in @($Stdout -split "`r?`n")) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line -notmatch '(?i)\bPOST\s+/rest/v1/rpc/create_customer_order(?:[\s?"/]|$)') { continue }
    if ($line -notmatch '^(?<timestamp>\d{4}-\d{2}-\d{2}T[^ ]+Z)\s+') {
      Stop-Runner "un registro RPC no contiene timestamp UTC verificable."
    }
    $timestampText = $Matches.timestamp
    if ($line -notmatch '"\s+(?<status>\d{3})\s+') {
      Stop-Runner "un registro RPC no contiene estado HTTP verificable."
    }
    $statusText = $Matches.status
    try { $timestamp = [DateTimeOffset]::Parse($timestampText).ToUniversalTime() } catch { Stop-Runner "un registro RPC contiene timestamp inválido." }
    $records += [pscustomobject]@{
      Timestamp = $timestamp
      Status = [int]$statusText
    }
  }
  return $records
}

function Invoke-KongLogsCapture {
  $dockerPath = Resolve-LocalExecutable "docker"
  $capture = Invoke-ProcessCapture $dockerPath @("logs", "--timestamps", $KongContainer)
  if ($capture.ExitCode -ne 0) {
    Stop-Runner "docker logs terminó con código $($capture.ExitCode); no se oculta su diagnóstico."
  }
  # stderr puede contener el stream informativo del contenedor; exit code 0 valida la lectura.
  # Se conserva solo el recuento para no imprimir logs, claves ni cuerpos.
  $script:LastKongStderrLines = @($capture.Stderr -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count
  return $capture
}

function Get-KongRpcRecords {
  $capture = Invoke-KongLogsCapture
  return @(Convert-KongRpcRecords $capture.Stdout)
}

function Assert-HttpRpcEvidence {
  $recordsAfter = @(Get-KongRpcRecords)
  $recordsBefore = @($script:HttpRpcBaseline)
  if ($null -eq $script:HttpRpcBaseline -or $recordsAfter.Count -lt $recordsBefore.Count) {
    Stop-Runner "la línea base RPC no es verificable; no se declara PASS."
  }
  for ($i = 0; $i -lt $recordsBefore.Count; $i++) {
    if ($recordsBefore[$i].Timestamp -ne $recordsAfter[$i].Timestamp -or $recordsBefore[$i].Status -ne $recordsAfter[$i].Status) {
      Stop-Runner "los registros históricos RPC cambiaron; correlación ambigua."
    }
  }
  $newRecords = @($recordsAfter | Select-Object -Skip $recordsBefore.Count)
  if ($newRecords.Count -ne 1) {
    Stop-Runner "se esperaban exactamente una RPC nueva y se observaron $($newRecords.Count); no se declara PASS."
  }
  $record = $newRecords[0]
  if ($record.Timestamp -lt $script:HttpRequestStartUtc -or $record.Timestamp -gt $script:HttpRequestEndUtc) {
    Stop-Runner "la RPC nueva está fuera de la ventana HTTP; correlación ambigua."
  }
  if ($record.Status -ne 400) {
    Stop-Runner "la RPC nueva no devolvió el 400 interno esperado para la compuerta cerrada."
  }
  Write-Output "P0_HTTP_RPC_EVIDENCE calls=1 path=create_customer_order postgrest_status=400"
}

function Invoke-LogSelfTest {
  $valid = '2026-10-16T06:48:06.375691445Z 127.0.0.1 "POST /rest/v1/rpc/create_customer_order HTTP/1.1" 400 42'
  $second = '2026-10-16T06:48:07.375691445Z 127.0.0.1 "POST /rest/v1/rpc/create_customer_order HTTP/1.1" 400 42'
  $accepted = 0
  if (@(Convert-KongRpcRecords $valid).Count -eq 1) { $accepted++ }
  if (@(Convert-KongRpcRecords "$valid`n$second").Count -eq 2) { $accepted++ }
  if (@(Convert-KongRpcRecords '2026-10-16T06:48:05.375691445Z 127.0.0.1 "GET /rest/v1/health HTTP/1.1" 200 2').Count -ne 0) {
    Stop-Runner "el parser RPC aceptó una entrada sin RPC."
  }
  $rejected = 0
  foreach ($case in @(
    '2026-10-16T06:48:06.375691445Z POST /rest/v1/rpc/create_customer_order',
    '2026-10-16T06:48:06.375691445Z 127.0.0.1 "POST /rest/v1/rpc/create_customer_order HTTP/1.1" status',
    '2026-99-99T99:99:99.375691445Z 127.0.0.1 "POST /rest/v1/rpc/create_customer_order HTTP/1.1" 400 42'
  )) {
    try { [void](Convert-KongRpcRecords $case) } catch { $rejected++ }
  }
  $failedCapture = [pscustomobject]@{ ExitCode = 1; Stdout = $valid; Stderr = 'command failed' }
  if ($failedCapture.ExitCode -eq 1) { $rejected++ }
  if ($accepted -ne 2 -or $rejected -ne 4) { Stop-Runner "pruebas sintéticas de logs RPC no cumplieron el fail-closed esperado." }
  Write-Output "P0_LOG_PARSER_SELFTEST_PASS accepted=2 rejected=4"
}

function Invoke-LogInvocationSelfTest {
  [void](Assert-TargetIdentity)
  $records = @(Get-KongRpcRecords)
  Write-Output "P0_LOG_INVOCATION_SELFTEST_PASS records=$($records.Count) stderr_lines=$($script:LastKongStderrLines)"
}

function Assert-HttpClockEvidence {
  if (-not $script:HttpClockMarkerPath -or -not (Test-Path -LiteralPath $script:HttpClockMarkerPath)) {
    Stop-Runner "el proceso Next no dejó evidencia de observar el reloj controlado durante la petición."
  }
  $marker = Get-Content -LiteralPath $script:HttpClockMarkerPath -Raw
  if ($marker -notmatch "date-controlled") {
    Stop-Runner "la petición no demostró uso de Date controlado por el preload en el proceso HTTP."
  }
}

function Invoke-HttpGateValidation {
  if ($ValidateHttpGate -and ($InjectFailureAfterHistorical -or $InjectCleanupFailure)) {
    Stop-Runner "-ValidateHttpGate no puede combinarse con inyección de fallos del runner SQL."
  }
  Assert-GateClosed
  $primaryError = $null
  $cleanupErrors = [System.Collections.Generic.List[string]]::new()
  try {
    New-HttpFixture
    $ordersBefore = [int](Invoke-TargetSql "select count(*) from public.orders;")
    New-HttpClockPreload
    Start-HttpNextProcess
    Wait-HttpNextReady
    $script:HttpRpcBaseline = @(Get-KongRpcRecords)
    Invoke-HttpGateRequest
    Assert-HttpClockEvidence
    Assert-HttpRpcEvidence
    $ordersAfter = [int](Invoke-TargetSql "select count(*) from public.orders;")
    $fixtureOrders = [int](Invoke-TargetSql "select count(*) from public.orders where branch_id='$HttpFixtureBranchId'::uuid or idempotency_key='$HttpFixtureIdempotencyKey'::uuid;")
    if ($ordersAfter -ne $ordersBefore -or $fixtureOrders -ne 0) {
      Stop-Runner "la petición cerrada produjo inserciones de pedidos."
    }
    Assert-GateClosed
  }
  catch {
    $primaryError = $_.Exception
  }
  finally {
    try {
      Stop-HttpNextProcess
    }
    catch {
      $cleanupErrors.Add("Stop-HttpNextProcess: $($_.Exception.Message)")
    }

    try {
      if ($InjectHttpCleanupFailure) {
        throw "fallo controlado secundario de cleanup HTTP"
      }
    }
    catch {
      $cleanupErrors.Add("inyección cleanup HTTP: $($_.Exception.Message)")
    }

    try {
      Remove-HttpFixture
    }
    catch {
      $cleanupErrors.Add("Remove-HttpFixture: $($_.Exception.Message)")
    }

    try {
      Remove-HttpHarnessFiles
    }
    catch {
      $cleanupErrors.Add("Remove-HttpHarnessFiles: $($_.Exception.Message)")
    }

    try {
      Assert-GateClosed
    }
    catch {
      $cleanupErrors.Add("Assert-GateClosed: $($_.Exception.Message)")
    }
  }

  if ($primaryError) {
    foreach ($cleanupError in $cleanupErrors) {
      [Console]::Error.WriteLine("Además del fallo original, falló cleanup HTTP: $cleanupError")
    }
    throw $primaryError
  }
  if ($cleanupErrors.Count -gt 0) {
    foreach ($cleanupError in $cleanupErrors) {
      [Console]::Error.WriteLine("Falló cleanup HTTP: $cleanupError")
    }
    throw "falló cleanup HTTP: $($cleanupErrors[0])"
  }

  Write-Output "P0_HTTP_GATE_PASS project=$ExpectedProjectId status=503 code=public-order-intake-closed rpc=create_customer_order calls=1 orders_delta=0 gate=false fixed_clock=2026-07-21T17:00:00.000Z"
}

function Set-Gate([bool]$Enabled) {
  $literal = if ($Enabled) { "true" } else { "false" }
  [void](Invoke-TargetSql "update private.public_order_intake_gate set enabled=$literal, updated_at=pg_catalog.clock_timestamp(), change_note='versioned test runner' where singleton is true;")
  $observed = Invoke-TargetSql "select enabled::text from private.public_order_intake_gate where singleton is true;"
  $expected = $literal
  if ($observed -cne $expected) { Stop-Runner "no se pudo verificar gate=$expected." }
}

function Invoke-DbTest([string]$RelativePath) {
  $path = (Resolve-Path (Join-Path $RepoRoot $RelativePath)).Path
  $args = @("test", "db", "--db-url", $script:DbUrl, $path)
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = @(& supabase @args 2>&1)
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($exitCode -ne 0) {
    throw "suite fallida ($RelativePath):`n$($output -join "`n")"
  }
  $output | Write-Output
}

if ($ParserSelfTest) {
  Invoke-StatusParserSelfTest
  exit 0
}
if ($StatusInvocationSelfTest) {
  Invoke-StatusInvocationSelfTest
  exit 0
}
if ($LogSelfTest) {
  Invoke-LogSelfTest
  exit 0
}
if ($LogInvocationSelfTest) {
  Invoke-LogInvocationSelfTest
  exit 0
}
if ($HeaderSelfTest) {
  Invoke-HeaderSelfTest
  exit 0
}

$script:DbUrl = "$(Assert-TargetIdentity)?sslmode=disable"
if (($InjectFailureAfterHttpFixture -or $InjectHttpCleanupFailure) -and -not $ValidateHttpGate) {
  Assert-GateClosed
  Stop-Runner "las inyecciones HTTP requieren -ValidateHttpGate y no se ejecutan fuera del harness HTTP local."
}
if ($ValidateHttpGate) {
  Invoke-HttpGateValidation
  exit 0
}
Assert-GateClosed
$primaryError = $null
$cleanupError = $null

try {
  Invoke-DbTest $GateTest
  Set-Gate $true
  foreach ($test in $HistoricalTests) { Invoke-DbTest $test }
  if ($InjectFailureAfterHistorical) {
    throw "fallo controlado del runner después de las suites históricas"
  }
}
catch {
  $primaryError = $_.Exception
}
finally {
  try {
    Set-Gate $false
    Assert-GateClosed
    if ($InjectCleanupFailure) {
      throw "fallo controlado de cleanup después de verificar compuerta cerrada"
    }
    Invoke-DbTest $GateTest
    Assert-GateClosed
  }
  catch {
    $cleanupError = $_.Exception
  }
}

if ($primaryError) {
  if ($cleanupError) {
    [Console]::Error.WriteLine(
      "Además del fallo original, falló la limpieza/verificación de la compuerta: $($cleanupError.Message)"
    )
  }
  throw $primaryError
}
if ($cleanupError) { throw $cleanupError }

Write-Output "P0_GATE_DB_RUNNER_PASS project=$ExpectedProjectId gate=closed historical=$($HistoricalTests.Count) final_gate_test=pass"
