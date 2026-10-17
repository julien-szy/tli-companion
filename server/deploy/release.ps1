# Publie l'installateur sur tlicompanion.com/download (à lancer après « npm run dist »).
# Usage (depuis la racine du projet) : powershell -File server\deploy\release.ps1
param(
  # Adresse SSH du serveur : paramètre -Host_, variable TLI_DEPLOY_HOST ou fichier deploy\host.txt (non publié).
  [string]$Host_ = $env:TLI_DEPLOY_HOST,
  [string]$Key = "$env:USERPROFILE\.ssh\tli_deploy"
)
$ErrorActionPreference = "Stop"
if (-not $Host_) { $hostFile = Join-Path $PSScriptRoot "host.txt"; if (Test-Path $hostFile) { $Host_ = (Get-Content $hostFile -Raw).Trim() } }
if (-not $Host_) { throw "Adresse du serveur inconnue : cree server\deploy\host.txt (ex. root@1.2.3.4) ou definis TLI_DEPLOY_HOST." }
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$version = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).version
$exe = Join-Path $root "dist\TLI-Companion-Setup-$version.exe"
if (-not (Test-Path $exe)) { throw "Installateur introuvable : $exe (lance d'abord npm run dist)" }
$name = Split-Path $exe -Leaf
$size = (Get-Item $exe).Length
$sha = (Get-FileHash $exe -Algorithm SHA256).Hash.ToLower()
$latest = @{ version = $version; file = $name; size = $size; sha256 = $sha; date = (Get-Date).ToUniversalTime().ToString("o") } | ConvertTo-Json -Compress
$tmpJson = Join-Path $env:TEMP "tli-latest.json"
[IO.File]::WriteAllText($tmpJson, $latest)

$ssh = @("-i", $Key, "-o", "IdentitiesOnly=yes")
$dir = "/var/lib/tli-server/downloads"
ssh @ssh $Host_ "mkdir -p $dir"
scp @ssh $exe "${Host_}:$dir/$name"
# Mises à jour automatiques : latest.yml et le .blockmap générés par electron-builder.
$yml = Join-Path $root "dist\latest.yml"
$blockmap = "$exe.blockmap"
if (-not (Test-Path $yml)) { throw "latest.yml introuvable (vérifie la section publish de package.json)" }
if (Test-Path $blockmap) { scp @ssh $blockmap "${Host_}:$dir/$name.blockmap" }
scp @ssh $tmpJson "${Host_}:$dir/latest.json"
scp @ssh $yml "${Host_}:$dir/latest.yml"
# Garde seulement les 3 dernières versions.
ssh @ssh $Host_ "chown -R tli:tli $dir && cd $dir && ls -t TLI-Companion-Setup-*.exe | tail -n +4 | xargs -r -I{} rm -f {} {}.blockmap && curl -s http://127.0.0.1:8080/api/version"
Write-Output "`nPublié : $name ($([math]::Round($size / 1MB)) Mo)"
