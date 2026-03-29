# Refresh script for @qzoft/check-list
# Clears the npx cache for this package so the next run fetches the latest version
# Usage: .\refresh.ps1

$ErrorActionPreference = "Stop"

$cacheDir = npm config get cache
$npxDir = Join-Path $cacheDir "_npx"

if (-not (Test-Path $npxDir)) {
    Write-Host "npx cache directory not found — nothing to clear." -ForegroundColor Yellow
    return
}

$removed = Get-ChildItem $npxDir -Recurse -Filter "package.json" |
    Where-Object { (Get-Content $_.FullName -Raw) -match 'check-list' } |
    ForEach-Object {
        $dir = $_.Directory.Parent.FullName
        Write-Host "Removing cached package: $dir" -ForegroundColor Cyan
        Remove-Item $dir -Recurse -Force
    }

if ($removed) {
    Write-Host "Cache cleared. Reload VS Code to fetch the latest version." -ForegroundColor Green
} else {
    Write-Host "No cached check-list package found — already clean." -ForegroundColor Yellow
}
