@echo off
setlocal
cd /d "%~dp0"

call :killpid ".pids\vite.pid" "Vite"
call :killpid ".pids\electron.pid" "Electron"

echo.
echo Stop complete.
endlocal
exit /b

:killpid
set "PIDFILE=%~1"
set "LABEL=%~2"

if not exist %PIDFILE% (
  echo %LABEL% PID file not found, skipping.
  goto :eof
)

set /p PID=<%PIDFILE%

if "%PID%"=="" (
  echo %LABEL% PID empty, skipping.
  del /f /q %PIDFILE% >nul 2>&1
  goto :eof
)

echo Stopping %LABEL% with PID %PID% ...
taskkill /PID %PID% /T /F >nul 2>&1

if errorlevel 1 (
  echo %LABEL% may already be closed.
) else (
  echo %LABEL% stopped.
)

del /f /q %PIDFILE% >nul 2>&1
goto :eof