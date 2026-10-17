# Envoie le code du serveur sur le VPS et redémarre le service.
# Usage (depuis le dossier server) : powershell -File deploy\deploy.ps1
param(
  # Adresse SSH du serveur : paramètre -Host_, variable TLI_DEPLOY_HOST ou fichier deploy\host.txt (non publié).
  [string]$Host_ = $env:TLI_DEPLOY_HOST,
  [string]$Key = "$env:USERPROFILE\.ssh\tli_deploy"
)
$ErrorActionPreference = "Stop"
if (-not $Host_) { $hostFile = Join-Path $PSScriptRoot "host.txt"; if (Test-Path $hostFile) { $Host_ = (Get-Content $hostFile -Raw).Trim() } }
if (-not $Host_) { throw "Adresse du serveur inconnue : cree server\deploy\host.txt (ex. root@1.2.3.4) ou definis TLI_DEPLOY_HOST." }
$root = Split-Path $PSScriptRoot -Parent
$ssh = @("-i", $Key, "-o", "IdentitiesOnly=yes")

$tmp = Join-Path $env:TEMP "tli-server.tgz"
tar -czf $tmp -C $root server.js db.js sanitize.js ai.js titrack.js package.json public
scp @ssh $tmp "${Host_}:/tmp/tli-server.tgz"
ssh @ssh $Host_ "tar -xzf /tmp/tli-server.tgz -C /opt/tli-server && rm /tmp/tli-server.tgz && systemctl restart tli-server && sleep 1 && systemctl is-active tli-server && curl -s http://127.0.0.1:8080/api/health"
