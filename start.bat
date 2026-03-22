@echo off
chcp 65001 >nul 2>&1
setlocal

echo.
echo ========== Chamate 启动中 ==========
echo.

set "SCRIPT_DIR=%~dp0"

:: 检查后端依赖
echo [1/4] 检查后端依赖...
cd /d "%SCRIPT_DIR%backend"
pip install -r requirements.txt -q 2>nul

:: 启动后端服务
echo [2/4] 启动后端服务...
cd /d "%SCRIPT_DIR%backend"
start "" /b cmd /c "python -m uvicorn app.main:app --reload --port 8000 > nul 2>&1"
timeout /t 2 /nobreak >nul

:: 获取后端PID
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo   后端进程已启动 (PID: %%a)
    echo %%a> "%SCRIPT_DIR%.pids"
    goto :backend_done
)
:backend_done

:: 检查前端依赖
echo [3/4] 检查前端依赖...
cd /d "%SCRIPT_DIR%frontend"
if not exist "node_modules" (
    echo   正在安装前端依赖...
    call npm install --silent 2>nul
)

:: 启动前端服务
echo [4/4] 启动前端服务...
cd /d "%SCRIPT_DIR%frontend"
start "" /b cmd /c "call npm run dev > nul 2>&1"
timeout /t 3 /nobreak >nul

:: 获取前端PID
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo   前端进程已启动 (PID: %%a)
    echo %%a>> "%SCRIPT_DIR%.pids"
    goto :frontend_done
)
:frontend_done

echo.
echo ========== Chamate 启动完成 ==========
echo.
echo   前端地址: http://localhost:3000
echo   后端地址: http://localhost:8000
echo   API文档:  http://localhost:8000/docs
echo.
echo 运行 stop.bat 停止所有服务
echo.

endlocal
