# Publish script for @qzoft/check-list
# Usage: .\publish.ps1 [patch|minor|major]

param(
    [ValidateSet("patch", "minor", "major")]
    [string]$Bump = "patch"
)

$ErrorActionPreference = "Stop"

# Ensure NPM_TOKEN is available in this session
if (-not $env:NPM_TOKEN) {
    $env:NPM_TOKEN = [Environment]::GetEnvironmentVariable("NPM_TOKEN", "User")
}
if (-not $env:NPM_TOKEN) { throw "NPM_TOKEN environment variable is not set" }

Write-Host "Building..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

Write-Host "Bumping version ($Bump)..." -ForegroundColor Cyan
npm version $Bump --no-git-tag-version
if ($LASTEXITCODE -ne 0) { throw "Version bump failed" }

$pkg = Get-Content package.json | ConvertFrom-Json
Write-Host "Publishing v$($pkg.version)..." -ForegroundColor Cyan
npm publish --access public
if ($LASTEXITCODE -ne 0) { throw "Publish failed" }

Write-Host "Published @qzoft/check-list@$($pkg.version)" -ForegroundColor Green
