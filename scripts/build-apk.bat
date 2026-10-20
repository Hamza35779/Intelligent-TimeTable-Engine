@echo off
echo ===================================================
echo   Intelligent Timetable - Android APK Build Script
echo ===================================================
echo.

cd /d "%~dp0..\frontend"

echo [1/3] Building frontend web assets...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo Error: Frontend build failed.
    pause
    exit /b %ERRORLEVEL%
)

echo [2/3] Syncing Capacitor Android assets...
call npx cap sync android
if %ERRORLEVEL% neq 0 (
    echo Error: Capacitor sync failed.
    pause
    exit /b %ERRORLEVEL%
)

echo [3/3] Checking for Gradle / Android Studio...
cd android
if exist gradlew.bat (
    echo Running Gradle assembleDebug...
    call gradlew.bat assembleDebug
    if %ERRORLEVEL% equ 0 (
        echo.
        echo ===================================================
        echo   BUILD SUCCESS!
        echo   APK location:
        echo   frontend\android\app\build\outputs\apk\debug\app-debug.apk
        echo ===================================================
        pause
        exit /b 0
    )
)

echo.
echo NOTE: Local Java or Android SDK was not found on PATH.
echo.
echo You have two easy ways to get your APK:
echo   1. Push this commit to GitHub - GitHub Actions will build the APK automatically
echo      in the cloud and make it downloadable under the 'Actions' tab.
echo   2. Open 'frontend\android' in Android Studio and click:
echo      Build ^> Build Bundle(s) / APK(s) ^> Build APK(s)
echo.
pause
