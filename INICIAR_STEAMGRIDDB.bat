@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ================================================
echo   ESTANTE RETRO - AUXILIAR STEAMGRIDDB
echo ================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado.
  echo Instale a versao LTS em https://nodejs.org/ e execute este arquivo novamente.
  echo.
  pause
  exit /b 1
)
node --version
echo.
node api-server.js
echo.
echo O auxiliar foi encerrado. Pressione uma tecla para fechar esta janela.
pause >nul
