@echo off
setlocal
cd /d "%~dp0"

if not exist ".pids" mkdir ".pids"

echo Starting Vite...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$wd='%cd%'; $p = Start-Process cmd.exe -WorkingDirectory $wd -ArgumentList '/k','title VOICEGEN_VITE && npm run dev' -WindowStyle Minimized -PassThru; Set-Content -Path '.pids\vite.pid' -Value $p.Id"

echo Starting Electron...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$wd='%cd%'; $p = Start-Process cmd.exe -WorkingDirectory $wd -ArgumentList '/k','title VOICEGEN_ELECTRON && npm run electron:dev' -WindowStyle Minimized -PassThru; Set-Content -Path '.pids\electron.pid' -Value $p.Id"

echo.
echo Started.
echo Vite PID: .pids\vite.pid
echo Electron PID: .pids\electron.pid
endlocal
