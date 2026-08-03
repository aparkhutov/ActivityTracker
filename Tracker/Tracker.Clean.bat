@echo off
rem clean.bat - One-click project cleanup script for ActivityTracker
rem Strict ASCII encoding.

cd /d "%~dp0"

echo [INFO] Starting project cleanup...
echo.
set "OBJDIR=.\obj"
set "BINDIR=.\bin"

rem 1. Remove the entire intermediate objects directory
if exist "%OBJDIR%" (
    echo [INFO] Removing intermediate folder: obj\
    rd /s /q "%OBJDIR%"
)

rem 2. Remove the binaries directory
if exist "%BINDIR%" (
    echo [INFO] Removing output folder: bin\
    rd /s /q "%BINDIR%"
)

echo.
echo [SUCCESS] Cleanup completed successfully.
pause
