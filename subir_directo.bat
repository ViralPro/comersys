@echo off
chcp 65001 >nul
title Subir ComerSys a GitHub (ViralPro)
cd /d "%~dp0"
set "PATH=C:\Users\damian\AppData\Local\Programs\Git\cmd;%PATH%"

echo ========================================================
echo      SUBIENDO COMERSYS A GITHUB (ViralPro/comersys)
echo ========================================================
echo.
echo Subiendo todos los modulos a la rama 'main'...
echo.
git push -u origin main --force
echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================================
    echo  [EXITO] TODOS LOS ARCHIVOS FUERON SUBIDOS CORRECTAMENTE
    echo  Verifica tu repositorio en:
    echo  https://github.com/ViralPro/comersys
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo  [AVISO] Si te solicito iniciar sesion en el navegador,
    echo  completa la autorizacion y vuelve a ejecutar este archivo.
    echo ========================================================
)
echo.
pause
