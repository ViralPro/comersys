# COMERSYS — GUÍA MAESTRA DE PUBLICACIÓN EN GITHUB Y DESPLIEGUE EN LA NUBE

Este documento contiene las instrucciones exactas para publicar **ComerSys** en GitHub de forma segura y desplegarlo en la nube con subdominio gratuito y certificado SSL HTTPS automático.

---

## FASE 1: Publicación en GitHub (Cuenta: ViralPro)

El proyecto local ya se encuentra completamente auditado, limpio de secretos y preparado:
- Historial Git saneado: únicamente contiene el commit limpio de lanzamiento.
- Bases de datos reales y copias de seguridad (`data/comersys_platform.json`, `.bak`, `.png`) excluidas mediante `.gitignore`.
- Plantilla inicial limpia configurada (`data/comersys_platform.template.json`).
- Remoto oficial preconfigurado hacia: `https://github.com/ViralPro/comersys.git`.

### Opción A — Asistente Automático (Recomendado con 1 Clic)
Hemos preparado el script `subir_a_github.bat` en la raíz del proyecto. Solo haz doble clic en él o ejecútalo en PowerShell:

```powershell
.\subir_a_github.bat
```

1. Si no estás conectado en GitHub CLI, abrirá tu navegador oficial para que autorices con un clic (`github.com/login/device`).
2. Una vez autorizado, creará y subirá automáticamente la rama `main` a tu cuenta: `https://github.com/ViralPro/comersys`.

### Opción B — Pasos Manuales en Terminal

Abre tu terminal en la carpeta del proyecto y ejecuta:

```powershell
# 1. Iniciar sesión segura con tu cuenta de GitHub
gh auth login -h github.com -p https --web

# 2. Configurar credenciales auxiliares de Git
gh auth setup-git

# 3. Subir el proyecto a GitHub
git push -u origin main
```

*(Si el repositorio aún no existe en GitHub.com, créalo con: `gh repo create comersys --public --source=. --remote=origin --push`)*.

---

## FASE 2: Despliegue Gratuito en la Nube (Sin Dominio Propio)

Para que ComerSys funcione 24/7 en Internet sin tener tu computadora encendida:

### Alternativa 1: Render.com (Recomendada — 100% Gratuita sin Tarjeta)
Render proporciona un servicio web gratuito permanente con subdominio HTTPS seguro (ej. `https://comersys-platform.onrender.com`).

1. Entra a [https://render.com](https://render.com) e inicia sesión con tu cuenta de GitHub (`ViralPro`).
2. En el panel principal, haz clic en **New +** y selecciona **Blueprint**.
3. Selecciona tu repositorio `comersys`.
4. Render leerá automáticamente el archivo `render.yaml` preconfigurado en la raíz del proyecto.
5. Haz clic en **Apply**.
6. En 2 o 3 minutos tu plataforma estará en línea en la URL pública que Render te asigne.

### Alternativa 2: Railway.app
Railway también detecta automáticamente proyectos Node.js:
1. Entra a [https://railway.app](https://railway.app) y conéctate con GitHub.
2. Haz clic en **New Project** > **Deploy from GitHub repo** > selecciona `comersys`.
3. En la pestaña de configuración (*Settings*) de tu servicio, haz clic en **Generate Domain** bajo *Networking*.
4. Te otorgará un enlace gratuito HTTPS del tipo: `https://comersys-production.up.railway.app`.

---

## FASE 3: Verificación de Funcionamiento en Internet

Una vez desplegado en tu proveedor (ej. `https://tu-app.onrender.com`):

1. **Panel Comercial (Punto de Venta / ERP):**
   - URL: `https://tu-app.onrender.com/`
   - Usuario inicial de prueba: `boutiquebella`
   - Contraseña inicial: `clave123`
2. **Panel de Administración Central (SuperAdmin):**
   - URL: `https://tu-app.onrender.com/admin/`
   - Usuario: `administrador`
   - Correo: `admin@comersys.local`
3. **Comprobación de Salud del Servidor:**
   - URL: `https://tu-app.onrender.com/health` (debe responder `{"status":"ok"}`).

---

## FASE 4: Vinculación de Dominio Propio en el Futuro

Cuando decidas adquirir un dominio propio (ejemplo: `miempresa.com`):

1. **Sin Cambios de Código:** ComerSys detecta automáticamente si la petición entra por la raíz comercial o por el subdominio `admin.miempresa.com`.
2. **En el Panel del Proveedor (Render / Railway):**
   - Ve a **Settings** > **Custom Domains**.
   - Agrega `miempresa.com` y `admin.miempresa.com`.
3. **En tu Proveedor DNS:**
   - Crea un registro `CNAME` apuntando `www` y `admin` hacia el dominio asignado por el host (`tu-app.onrender.com`).
   - El proveedor de hosting gestionará automáticamente el certificado SSL HTTPS gratuito de Let's Encrypt para tu dominio sin costo adicional.
