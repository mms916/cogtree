@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PREVIEW_URL=http://localhost:5173/app/quotes"

echo Starting CogTree API...
start "CogTree API" /min cmd.exe /k ""%SCRIPT_DIR%dev-api.cmd""

echo Starting CogTree Web...
start "CogTree Web" /min cmd.exe /k ""%SCRIPT_DIR%dev-web.cmd""

echo Waiting for dev servers...
timeout /t 5 /nobreak >nul

echo Opening preview: %PREVIEW_URL%
start "" "%PREVIEW_URL%"

endlocal
