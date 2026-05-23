chcp 65001 >nul
title 启动 Image Matting 抠图工具
echo ==============================================
echo 正在启动抠图工具前后端服务，请稍候...
echo 提示：启动后会弹出2个终端窗口，请勿关闭！
echo ==============================================

:: 1. 启动前端服务（独立窗口）
start "前端服务 (pnpm dev)" cmd /k "cd /d "%~dp0frontend" && pnpm run dev"

:: 2. 等待3秒，避免前端未启动完成导致后端报错
timeout /t 3 /nobreak >nul

:: 3. 启动后端服务（独立窗口）
start "后端服务 (pdm dev)" cmd /k "cd /d "%~dp0backend" && pdm dev"

:: 4. 提示信息
echo.
echo ✅ 服务启动指令已执行！
echo 📌 前端访问地址：通常为 http://localhost:5173（以前端终端提示为准）
echo 📌 后端服务地址：通常为 http://localhost:8000（以后端终端提示为准）
echo ❌ 关闭工具时，请先关闭浏览器页面，再关闭两个终端窗口。
pause