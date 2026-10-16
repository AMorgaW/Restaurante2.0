param(
  [switch]$InjectFailureAfterHistorical,
  [switch]$InjectCleanupFailure
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
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".." )).Path

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

  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $statusOutput = @(& supabase status --workdir $ProjectRoot -o json 2>&1)
    $statusExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  $jsonStart = -1
  for ($index = 0; $index -lt $statusOutput.Count; $index++) {
    if ($statusOutput[$index] -is [string] -and $statusOutput[$index].TrimStart().StartsWith("{")) {
      $jsonStart = $index
      break
    }
  }
  $statusText = if ($jsonStart -ge 0) { ($statusOutput[$jsonStart..($statusOutput.Count - 1)] -join "`n").Trim() } else { "" }
  if ($statusExitCode -ne 0 -or -not $statusText) { Stop-Runner "no se pudo obtener status explícito del proyecto autorizado." }
  try { $status = $statusText | ConvertFrom-Json } catch { Stop-Runner "status del proyecto no es JSON válido." }
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

$script:DbUrl = "$(Assert-TargetIdentity)?sslmode=disable"
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
