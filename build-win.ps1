# ==============================================================================
# Script de Build do ContaMEI para Windows (PowerShell - Isolamento de Temp)
# ==============================================================================
# Evita bloqueios de arquivo e concorrência com o Dropbox compilando em $env:TEMP
# ==============================================================================

$ErrorActionPreference = "Stop"

$ProjectDir = $PSScriptRoot
$ExternalTempDir = Join-Path $env:TEMP "ContaMEI_Build"
$DistElectronDir = Join-Path $ProjectDir "dist-electron"

Write-Host ">>> [1/5] Preparando diretório de compilação isolado: $ExternalTempDir" -ForegroundColor Cyan
if (Test-Path $ExternalTempDir) {
    Remove-Item -Recurse -Force $ExternalTempDir -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $ExternalTempDir -Force | Out-Null

Write-Host ">>> [2/5] Copiando arquivos do projeto para o diretório temporário..." -ForegroundColor Cyan
Copy-Item -Path (Join-Path $ProjectDir "src") -Destination $ExternalTempDir -Recurse
Copy-Item -Path (Join-Path $ProjectDir "public") -Destination $ExternalTempDir -Recurse
Copy-Item -Path (Join-Path $ProjectDir "electron") -Destination $ExternalTempDir -Recurse
Copy-Item -Path (Join-Path $ProjectDir "package.json") -Destination $ExternalTempDir
Copy-Item -Path (Join-Path $ProjectDir "package-lock.json") -Destination $ExternalTempDir
Copy-Item -Path (Join-Path $ProjectDir "vite.config.js") -Destination $ExternalTempDir
Copy-Item -Path (Join-Path $ProjectDir "index.html") -Destination $ExternalTempDir

# Reaproveitar node_modules existente para não baixar novamente caso já exista no projeto
$SourceNodeModules = Join-Path $ProjectDir "node_modules"
$DestNodeModules = Join-Path $ExternalTempDir "node_modules"
if (Test-Path $SourceNodeModules) {
    Write-Host ">>> Vinculando node_modules local para acelerar o build..." -ForegroundColor Cyan
    cmd /c mklink /J "$DestNodeModules" "$SourceNodeModules" | Out-Null
} else {
    Write-Host ">>> Instalando dependências npm..." -ForegroundColor Cyan
    Push-Location $ExternalTempDir
    npm install
    Pop-Location
}

$prevPwd = Get-Location
try {
    Set-Location $ExternalTempDir

    Write-Host ">>> [3/5] Compilando Frontend com Vite..." -ForegroundColor Cyan
    npm run build

    Write-Host ">>> [4/5] Empacotando com Electron-Builder..." -ForegroundColor Cyan
    npx electron-builder --win --publish never

    Write-Host ">>> [5/5] Movendo artefatos gerados para dist-electron do projeto..." -ForegroundColor Cyan
    if (!(Test-Path $DistElectronDir)) {
        New-Item -ItemType Directory -Path $DistElectronDir -Force | Out-Null
    }

    $TempDist = Join-Path $ExternalTempDir "dist-electron"
    if (Test-Path $TempDist) {
        Get-ChildItem -Path $TempDist -Filter "*.exe" | ForEach-Object {
            Copy-Item -Path $_.FullName -Destination $DistElectronDir -Force
            Write-Host ">>> Executável copiado: $($_.Name)" -ForegroundColor Green
        }
    }
}
finally {
    Set-Location $prevPwd
    Write-Host ">>> Limpando diretório temporário..." -ForegroundColor Gray
    # Se houver junction, remover antes de limpar para não afetar o projeto
    if (Test-Path $DestNodeModules) {
        cmd /c rmdir "$DestNodeModules" 2>$null
    }
    Remove-Item -Recurse -Force $ExternalTempDir -ErrorAction SilentlyContinue
}

Write-Host "=== Build do ContaMEI concluído com sucesso! ===" -ForegroundColor Green
