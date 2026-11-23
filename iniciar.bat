@echo off
title UBS Suzyanne Sousa Lopes - Servidor Local
echo =======================================================
echo   UBS SUZYANNE SOUSA LOPES - OLHO D'AGUA DAS CUNHAS
echo   Iniciando Servidor Local...
echo =======================================================
cd /d "%~dp0"
start http://localhost:3000
node server.js
if %errorlevel% neq 0 (
    echo Node.js nao encontrado, tentando com Python...
    python -m http.server 3000
)
pause
