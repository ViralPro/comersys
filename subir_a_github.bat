@echo off
chcp 65001 >nul
title Publicar ComerSys en GitHub (Damian82uj)
cls
echo ========================================================
echo       COMERSYS — ASISTENTE DE PUBLICACION EN GITHUB
echo ========================================================
echo.
set "PATH=C:\Users\damian\AppData\Local\Programs\Git\cmd;C:\Users\damian\AppData\Local\Programs\Git\ucrt64\bin;%PATH%"

echo Cuenta de GitHub objetivo: https://github.com/Damian82uj
echo.
echo [1/3] Verificando autenticacion en GitHub CLI...
echo.
gh auth status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Se abrira la autorizacion web.
    echo ATENCION: Copia con exactitud el codigo que aparezca en pantalla
    echo y pegalo en la ventana de GitHub que se abrira.
    echo.
    gh auth login -h github.com -p https --web
) else (
    echo [OK] Sesion activa verificada en GitHub.
)

echo.
echo [2/3] Configurando credenciales seguras de Git...
gh auth setup-git

echo.
echo [3/3] Publicando rama main en GitHub (Damian82uj/comersys)...
gh repo view Damian82uj/comersys >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Creando repositorio publico 'comersys' en tu cuenta...
    gh repo create comersys --public --source=. --remote=origin --push
) else (
    echo El repositorio ya existe en GitHub. Subiendo cambios a 'main'...
    git push -u origin main
)

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo  [EXITO] REPOSITORIO PUBLICADO CORRECTAMENTE
    echo  Enlace directo: https://github.com/Damian82uj/comersys
    echo ========================================================
) else (
    echo.
    echo [AVISO] Si el repositorio aun no se creo, puedes crearlo en:
    echo https://github.com/new (Nombre: comersys)
    echo Y luego ejecutar simplemente:
    echo git push -u origin main
)

echo.
pause
