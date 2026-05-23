@echo off
chcp 65001 > nul
echo ======================================
echo      Bilibili-RAG 一键启动脚本
echo ======================================
echo 正在启动后端服务（8000端口）...
start "后端服务" cmd /k "cd /d ""%~dp0"" && .\venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload"

echo 正在启动前端服务（3000端口）...
timeout /t 3 /nobreak > nul
start "前端服务" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo ======================================
echo ✅ 前后端服务启动中...
echo 📍 前端页面：http://localhost:3000
echo ⚠️  关闭窗口会停止服务，请勿关闭！
echo ======================================
start http://localhost:3000
pause