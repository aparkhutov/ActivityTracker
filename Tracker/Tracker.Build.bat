@echo off
rem build.bat - Flexible MSBuild automation with isolated project and tool path variables.
rem Strict ASCII encoding.

cd /d "%~dp0"

rem 1. Configuration block - Define your project file and directory here
set "PROJECT_NAME=Tracker.vcxproj"
set "PROJECT_DIR=."

echo [INFO] Initializing Developer Environment...
echo.

rem 2. Dynamic lookup for Visual Studio environment script using vswhere
set "VS_DEV_CMD="
if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" (
    for /f "usebackq delims=" %%i in (`"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -property installationPath`) do (
        if exist "%%i\Common7\Tools\VsDevCmd.bat" (
            set "VS_DEV_CMD=%%i\Common7\Tools\VsDevCmd.bat"
        )
    )
)

rem 3. Validate environment script presence before execution
if not defined VS_DEV_CMD (
    echo [ERROR] Visual Studio environment script was not found.
    echo Please verify that Visual Studio or Build Tools are installed.
    pause
    exit /b 1
)

rem 4. Validate project file presence before execution
if not exist "%PROJECT_DIR%\%PROJECT_NAME%" (
    echo [ERROR] Project file "%PROJECT_NAME%" was not found in directory "%PROJECT_DIR%".
    echo Please verify the PROJECT_NAME and PROJECT_DIR variables in this script.
    pause
    exit /b 1
)

rem 5. Call the setup script and run the msbuild command separately
call "%VS_DEV_CMD%" -arch=x64
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to initialize developer environment.
    pause
    exit /b %ERRORLEVEL%
)

msbuild "%PROJECT_DIR%\%PROJECT_NAME%" /p:Configuration=Release /p:Platform=x64
echo.

if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Build completed successfully.
    echo [SUCCESS] Check your output directory: %PROJECT_DIR%\bin\x64\Release\
) else (
    echo [FAILED] Compilation failed with errors.
)
pause
