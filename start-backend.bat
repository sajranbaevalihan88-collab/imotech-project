@echo off
chcp 65001 >nul
title ImoTech (ЫмТили) — Backend (порт 8010)
cd /d "%~dp0backend"

echo Проверка зависимостей ImoTech (ЫмТили)...
python -m pip install -r requirements.txt --quiet

echo.
echo ======================================================
echo   Бэкенд ImoTech (ЫмТили): http://localhost:8010
echo   Документация Swagger: http://localhost:8010/docs
echo   Это окно НЕ закрывайте во время демонстрации!
echo ======================================================
echo.
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8010
pause
