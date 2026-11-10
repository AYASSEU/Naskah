[CmdletBinding()]
param(
  [ValidateSet('mock','live')][string]$Mode='live',
  [switch]$SkipN8n,
  [switch]$WithDatabase,
  [string]$N8nDirectory=(Join-Path $env:LOCALAPPDATA 'n8n-docker')
)
$ErrorActionPreference='Stop'
$repoPath=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repoPath
$nodeCommand=Get-Command node.exe -ErrorAction SilentlyContinue
if($nodeCommand){$nodePath=$nodeCommand.Source}else{
  # Resolve the installed first-party runtime rather than a versioned user path.
  $runtimePackage=Get-AppxPackage -Name 'OpenAI.CodexPrimaryRuntime*'|
    Sort-Object Version -Descending|Select-Object -First 1
  if(-not $runtimePackage){throw 'Node.js tidak ditemukan. Jalankan dari terminal Codex atau pasang Node.js yang didukung proyek.'}
  $nodePath=Join-Path $runtimePackage.InstallLocation 'dependencies\node\bin\node.exe'
}
if(-not (Test-Path -LiteralPath $nodePath)){throw 'Executable Node.js tidak tersedia.'}
$pnpmCli=Join-Path (Split-Path $nodePath -Parent) '..\node_modules\pnpm\bin\pnpm.mjs'
if(-not (Test-Path -LiteralPath 'apps\web\node_modules\next\dist\bin\next')){
  if(-not (Test-Path -LiteralPath $pnpmCli)){throw 'Pasang dependency proyek dengan pnpm 11.25.0 terlebih dahulu.'}
  & $nodePath $pnpmCli install --frozen-lockfile
  if($LASTEXITCODE -ne 0){throw 'Pemasangan dependency gagal.'}
}
if(-not $SkipN8n){
  & docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
  if($LASTEXITCODE -ne 0){
    & docker desktop start --timeout 45
    & docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
    if($LASTEXITCODE -ne 0){& docker desktop restart --timeout 60}
    if($LASTEXITCODE -ne 0){throw 'Engine Docker Desktop belum siap. Periksa Docker Desktop.'}
  }
  $composePath=Join-Path $N8nDirectory 'compose.yaml'
  if(Test-Path -LiteralPath $composePath){
    & docker compose --project-directory $N8nDirectory -f $composePath up -d --wait --wait-timeout 180
    if($LASTEXITCODE -ne 0){throw 'n8n lokal belum siap. Periksa Docker Desktop.'}
  }else{
    # A relocated laptop may retain the existing containers but not the private Compose file.
    # Restart those containers without recreating volumes or changing their encryption key.
    if($N8nDirectory -ne (Join-Path $env:LOCALAPPDATA 'n8n-docker')){throw 'Compose tidak ditemukan pada -N8nDirectory yang ditentukan.'}
    foreach($containerName in @('n8n-local','n8n-local-runners','naskah-mock-llm')){
      $running=& docker inspect --format '{{.State.Running}}' $containerName 2>$null
      if($LASTEXITCODE -ne 0){throw "Container existing $containerName tidak ditemukan; pulihkan konfigurasi Compose lokal."}
      if($running -ne 'true'){& docker start $containerName;if($LASTEXITCODE -ne 0){throw "Container $containerName gagal dimulai."}}
    }
    $servicesReady=$false
    for($attempt=0;$attempt -lt 30;$attempt++){
      try{
        $n8nHealth=Invoke-WebRequest 'http://127.0.0.1:5678/healthz/readiness' -TimeoutSec 5
        $mockHealth=Invoke-WebRequest 'http://127.0.0.1:4010/health' -TimeoutSec 5
        if($n8nHealth.StatusCode -eq 200 -and $mockHealth.StatusCode -eq 200){$servicesReady=$true;break}
      }catch{}
      Start-Sleep -Milliseconds 500
    }
    if(-not $servicesReady){throw 'n8n atau mock provider belum siap. Periksa health container existing.'}
  }
}
if($WithDatabase -or $Mode -eq 'live'){
  & $nodePath 'scripts/local-database.mjs' start
  if($LASTEXITCODE -ne 0){throw 'Supabase lokal gagal dijalankan.'}
}
if($Mode -eq 'live' -and -not (Test-Path -LiteralPath 'apps\web\.env.local')){
  throw 'Mode live membutuhkan konfigurasi lokal. Lihat docs/local-laptop-setup.md.'
}
$listener=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if($listener){
  Write-Host 'Port 3000 sudah dipakai. Buka http://127.0.0.1:3000; hentikan server sebelumnya sebelum mengganti mode.'
  return
}
$env:NEXT_PUBLIC_DATA_MODE=$Mode
Write-Host "Naskah ($Mode): http://127.0.0.1:3000. Ctrl+C menghentikan webapp; container tetap berjalan."
Push-Location -LiteralPath (Join-Path $repoPath 'apps\web')
try{& $nodePath 'node_modules/next/dist/bin/next' dev --hostname 127.0.0.1}
finally{Pop-Location}
