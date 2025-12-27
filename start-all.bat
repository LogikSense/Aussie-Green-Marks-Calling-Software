@echo off
echo Starting CRM Verification System...
echo.
echo Starting Backend Server in new window...
start "Backend Server" cmd /k "cd backend && if not exist venv (python -m venv venv) && call venv\Scripts\activate && pip install -q -r requirements.txt && python main.py"
timeout /t 3 /nobreak >nul
echo.
echo Starting Frontend Server...
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
call npm run dev

