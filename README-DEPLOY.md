# COMERSYS — GUÍA DE DESPLIEGUE EN PRODUCCIÓN Y GITHUB

Este documento detalla la arquitectura de despliegue profesional para **ComerSys Multi-Tenant** y el panel de **Administración Central**.

---

## 1. Arquitectura de Acceso en la Nube

El sistema está diseñado para operar con un único puerto público asignado por el proveedor cloud (Render, Railway o VPS), sirviendo de forma nativa ambos entornos con HTTPS gratuito automático:

- **Sistema Comercial ComerSys (POS):** `https://<tu-servicio-cloud>/`
- **Administración Central (SuperAdmin):** `https://<tu-servicio-cloud>/admin/` (o vía subdominio `https://admin.<tu-dominio>/`)
- **Comprobación de Salud (Healthcheck):** `https://<tu-servicio-cloud>/health`

---

## 2. Publicación en GitHub (Paso a Paso Seguro)

El repositorio local Git ya ha sido inicializado en tu carpeta con el commit inicial de producción:
`feat: ComerSys Enterprise Platform v2.0 - Production Ready Multi-Tenant & Central Admin`

Ya tienes instalado en tu equipo tanto **Git** (`2.56.1`) como la herramienta oficial **GitHub CLI** (`gh 2.103.3`).

### Opción Rápida con GitHub CLI (Recomendada y 100% Segura):
Abre una terminal PowerShell en esta carpeta y ejecuta:

```powershell
gh auth login
```
1. Selecciona **GitHub.com** -> **HTTPS** -> **Yes** -> **Login with a web browser**.
2. Se abrirá tu navegador web oficial en GitHub para que autorices con un clic, **sin necesidad de escribir contraseñas ni tokens en el chat**.
3. Una vez autorizado, sube el repositorio con:

```powershell
gh repo create comersys --public --source=. --remote=origin --push
```

### Opción Manual con Repositorio Existente:
Si ya creaste el repositorio en tu cuenta de GitHub (ej. `https://github.com/TU_USUARIO/comersys`):

```powershell
git remote add origin https://github.com/TU_USUARIO/comersys.git
git push -u origin main
```

---

## 3. Despliegue 24/7 en la Nube (Sin depender de tu PC encendida)

Para que el sistema funcione las 24 horas en un servidor en la nube sin costo inicial y listo para conectar tu dominio `.com`:

### En Render.com (Recomendado / 1-Click con `render.yaml`)
1. Crea una cuenta gratuita en [Render.com](https://render.com).
2. Haz clic en **New +** > **Blueprint**.
3. Conecta tu repositorio de GitHub `comersys`.
4. Render leerá automáticamente el archivo `render.yaml` que dejamos configurado en la raíz y desplegará:
   - Servidor Node.js de producción (`server.js`).
   - Criptografía PBKDF2 nativa.
   - Base de datos multi-tenant persistente.
   - URL pública permanente con HTTPS: `https://comersys-platform.onrender.com`.
   - Soporte para vincular tu propio dominio `.com` con SSL gratuito gestionado automáticamente.

### En Cualquier Servidor Linux / VPS con Docker:
El proyecto incluye `Dockerfile` y `docker-compose.yml`:

```bash
docker compose up -d
```
El sistema quedará corriendo en segundo plano, reiniciándose automáticamente ante caídas del servidor.

---

## 4. Credenciales de la Cuenta Maestra
- **Correo Inicial:** `admin@comersys.local` (o configurado vía `SUPERADMIN_EMAIL`)
- **Usuario:** `administrador`
- **Rol:** `SUPERADMINISTRADOR` (Propietario único del sistema)
