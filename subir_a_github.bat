@echo off
chcp 65001 >nul
title Publicar ComerSys en GitHub
cls
echo ========================================================
echo       CONEXION Y PUBLICACION OFICIAL EN GITHUB
echo ========================================================
echo.
set "PATH=C:\Users\damian\AppData\Local\Programs\Git\cmd;C:\Users\damian\AppData\Local\Programs\Git\ucrt64\bin;%PATH%"

echo [1/3] Verificando autenticacion en GitHub...
echo.
gh auth status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Se iniciara la conexion oficial con tu navegador.
    echo Se abrira github.com/login/device y un codigo se copiara a tu portapapeles.
    echo.
    gh auth login -h github.com -p https --web
) else (
    echo Ya tienes la sesion iniciada en GitHub.
)

echo.
echo [2/3] Configurando credenciales de Git...
gh auth setup-git

echo.
echo [3/3] Publicando repositorio comersys en GitHub (ViralPro)...
gh repo create comersys --public --source=. --remote=origin --push 2>nul
if %ERRORLEVEL% NEQ 0 (
    git push -u origin main
)

echo.
echo ========================================================
echo  PROYECTO PUBLICADO EXITOSAMENTE EN GITHUB
echo  Repositorio: https://github.com/ViralPro/comersys
echo ========================================================
echo.
pause
