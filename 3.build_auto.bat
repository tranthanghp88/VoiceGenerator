@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"

echo ============================
echo AUTO BUILD + PUBLISH + TAG
echo ============================
echo.

set /p VERSION=Nhap version moi (vd 2.0.3): 

if "%VERSION%"=="" (
  echo Ban chua nhap version.
  pause
  exit /b 1
)

echo.
echo Dang cap nhat version package.json -> %VERSION% ...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='package.json';" ^
  "$raw = Get-Content $p -Raw | Out-String;" ^
  "$j = $raw | ConvertFrom-Json;" ^
  "$j.version = '%VERSION%';" ^
  "$json = $j | ConvertTo-Json -Depth 100;" ^
  "$utf8NoBom = New-Object System.Text.UTF8Encoding($false);" ^
  "[System.IO.File]::WriteAllText((Resolve-Path $p), $json, $utf8NoBom)"

if errorlevel 1 (
  echo Loi cap nhat package.json
  pause
  exit /b 1
)

echo.
echo ============================
echo BUILD PUBLISH
echo ============================
call npm run dist:publish
if errorlevel 1 (
  echo Loi build/publish
  pause
  exit /b 1
)

echo.
echo ============================
echo GIT COMMIT + TAG + PUSH
echo ============================
git add .
git commit -m "release v%VERSION%"
git tag v%VERSION%
git push origin main
git push origin v%VERSION%

if errorlevel 1 (
  echo Loi push git/tag
  pause
  exit /b 1
)

echo.
echo DONE RELEASE v%VERSION%
pause
