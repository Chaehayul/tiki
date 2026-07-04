$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

Start-Process -FilePath (Join-Path $backend ".venv\Scripts\python.exe") `
  -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8013") `
  -WorkingDirectory $backend `
  -WindowStyle Hidden

Start-Process -FilePath "npm.cmd" `
  -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "5173") `
  -WorkingDirectory $frontend `
  -WindowStyle Hidden
