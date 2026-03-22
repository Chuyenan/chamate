@echo off
chcp 65001 >nul 2>&1
setlocal

echo.
echo ========== 停止 Chamate 服务 ==========
echo.

set "SCRIPT_DIR=%~dp0"
set "STOPPED=0"

:: 从 .pids 文件终止已记录的进程
set "PIDS_FILE=%SCRIPT_DIR%.pids"
if exist "%PIDS_FILE%" (
    echo 正在终止已记录的进程...
    for /f "usebackq tokens=*" %%p in ("%PIDS_FILE%") do (
        taskkill /PID %%p /T /F >nul 2>&1
        if not errorlevel 1 (
            echo   已终止进程 ^(PID: %%p^)
            set "STOPPED=1"
        )
    )
    del /f "%PIDS_FILE%" >nul 2>&1
)

:: 额外清理：终止占用 8000 和 3000 端口的进程
echo.
echo 检查并清理残留进程...

for %%P in (8000 3000) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P" ^| findstr "LISTENING"') do (
        taskkill /PID %%a /T /F >nul 2>&1
        if not errorlevel 1 (
            echo   已终止端口 %%P 上的进程 ^(PID: %%a^)
            set "STOPPED=1"
        )
    )
)

:: 额外清理：查找 uvicorn 和 node 进程
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq python.exe" /fo list 2^>nul ^| findstr "PID"') do (
    wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr "uvicorn" >nul 2>&1
    if not errorlevel 1 (
        taskkill /PID %%a /T /F >nul 2>&1
        echo   已终止 uvicorn 进程 ^(PID: %%a^)
        set "STOPPED=1"
    )
)

echo.
if "%STOPPED%"=="1" (
    echo ========== Chamate 已停止 ==========
) else (
    echo ========== 没有发现运行中的服务 ==========
)
echo.

endlocal
