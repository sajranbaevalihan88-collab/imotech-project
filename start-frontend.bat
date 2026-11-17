@echo off
chcp 65001 >nul
title ImoTech (ЫмТили) — Frontend (порт 3010)
cd /d "%~dp0frontend"

echo Сборка актуального фронтенда ImoTech (ЫмТили)...
node build.js

echo.
echo ======================================================
echo   Сайт ImoTech (ЫмТили): http://localhost:3010
echo   Откройте эту ссылку в браузере!
echo   Это окно НЕ закрывайте во время демонстрации!
echo ======================================================
echo.
node preview.js
pause
