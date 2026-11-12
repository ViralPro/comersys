@echo off
chcp 65001 >nul
title Publicar ComerSys en GitHub (ViralPro)
cls
echo ========================================================
echo       COMERSYS — ASISTENTE DE PUBLICACION EN GITHUB
echo ========================================================
echo.
set "PATH=C:\Users\damian\AppData\Local\Programs\Git\cmd;C:\Users\damian\AppData\Local\Programs\Git\ucrt64\bin;%PATH%"

echo [1/3] Verificando autenticacion en GitHub CLI...
echo.
gh auth status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo No se detecto sesion iniciada.
    echo Se abrira tu navegador oficial en github.com/login/device para autorizar con un clic.
    echo.
    gh auth login -h github.com -p https --web
) else (
    echo [OK] Sesion activa verificada en GitHub.
)

echo.
echo [2/3] Configurando credenciales seguras de Git...
gh auth setup-git

echo.
echo [3/3] Publicando rama main en GitHub (ViralPro/comersys)...
gh repo view ViralPro/comersys >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Creando repositorio publico 'comersys' en tu cuenta de GitHub...
    gh repo create comersys --public --source=. --remote=origin --push
) else (
    echo El repositorio ya existe en GitHub. Subiendo cambios a 'main'...
    git push -u origin main
)

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo  [EXITO] REPOSITORIO PUBLICADO CORRECTAMENTE
    echo  Enlace directo: https://github.com/ViralPro/comersys
    echo ========================================================
) else (
    echo.
    echo [AVISO] Si hubo algun conflicto, verifica tu conexion o ejecuta:
    echo git push -u origin main
)

echo.
pause
