# ComerSys Platform v2.0 — Sistema Comercial Multi-Tenant & Administración Central

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0%20(Pure%20Native)-blue)](https://nodejs.org)
[![Multi--Tenant](https://img.shields.io/badge/Architecture-Multi--Tenant%20ACID-orange)](#1-arquitectura-del-sistema)
[![Crypto PBKDF2](https://img.shields.io/badge/Security-PBKDF2%20%2B%20SHA--256-success)](#5-criptografía-y-seguridad)
[![Tests Passing](https://img.shields.io/badge/Tests-38%2F38%20Passing-brightgreen)](#6-suite-de-pruebas-automatizadas)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red)](#licencia)

**ComerSys Platform** es una solución integral de software empresarial y comercial que fusiona un **Punto de Venta (POS) y ERP Comercial de alta velocidad** con un portal centralizado de **SuperAdministración Multi-Tenant** para la gestión, supervisión y control de múltiples comercios independientes desde una única infraestructura.

---

## 1. Arquitectura del Sistema

La plataforma opera bajo un modelo de **doble entorno coordinado y aislado**:

```
                              ┌──────────────────────────────────────────────┐
                              │          NUBE / SERVIDOR PRINCIPAL           │
                              │           (Puerto 8000 / $PORT)              │
                              └──────────────────────┬───────────────────────┘
                                                     │
                         ┌───────────────────────────┴───────────────────────────┐
                         ▼                                                       ▼
            ┌──────────────────────────┐                           ┌──────────────────────────┐
            │   COMERSYS COMERCIAL     │                           │  ADMINISTRACIÓN CENTRAL  │
            │    (Panel de Clientes)   │                           │     (SuperAdmin Master)  │
            │     Ruta: / (Raíz)       │                           │     Ruta: /admin/        │
            └────────────┬─────────────┘                           └────────────┬─────────────┘
                         │                                                       │
                         │ (Aislamiento por TenantId)                            │ (Supervisión Global)
                         ▼                                                       ▼
            ┌─────────────────────────────────────────────────────────────────────────────────┐
            │                     MOTOR DE PERSISTENCIA ATÓMICA PBKDF2                        │
            │                  data/comersys_platform.json (+ rotación .bak)                  │
            └─────────────────────────────────────────────────────────────────────────────────┘
```

### A. ComerSys Cliente (Punto de Venta & Gestión Comercial) — Acceso `/`
- **Punto de Venta (POS):** Facturación y registro de ventas en 4 pasos (Contado, Entrega parcial, Financiación personalizada en cuotas).
- **Control de Inventario:** Categorización por grupos dinámicos, cálculo automático de márgenes comerciales y alertas de stock mínimo.
- **Gestión de Clientes & CRM:** Ficha comercial por cliente, historial de compras, límites de crédito, cuentas corrientes y registro de deudas.
- **Caja & Finanzas:** Arqueo de movimientos, balance de ingresos en tiempo real y cronograma interactivo de cuotas por cobrar.
- **Aislamiento Multi-Tenant Estricto:** Cada comercio únicamente accede a sus propios datos cifrados mediante verificación en backend.

### B. ComerSys Central (SuperAdministrador) — Acceso `/admin/` (o Puerto `8001`)
- **Directorio de Comercios:** Alta de negocios, activación instantánea, suspensión por mora y reactivación sin pérdida de datos.
- **Supervisión Transaccional:** Inspección remota de métricas, catálogos y transacciones de cada negocio en tiempo real.
- **Gestión de Suscripciones:** Control de planes (Básico, Profesional, Corporativo), fechas de renovación y control de cobros.
- **Auditoría & Trazabilidad:** Registro cronológico inmutable de accesos, inicios de sesión y modificaciones del sistema.
- **Copias de Seguridad:** Descarga y restauración de backups completos en un clic.

---

## 2. Puesta en Marcha Rápida (Entorno Local)

### Requisitos Previos
- **Node.js** v18.0.0 o superior (no requiere instalar librerías externas vía `npm install`).

### Ejecución con Node.js (Recomendado para Producción)
```bash
# 1. Iniciar servidor principal
npm start
# O directamente:
node server.js
```
- **Sistema Comercial:** [http://localhost:8000/](http://localhost:8000/)
- **Administración Central:** [http://localhost:8000/admin/](http://localhost:8000/admin/) (o [http://localhost:8001/](http://localhost:8001/))
- **Healthcheck:** [http://localhost:8000/health](http://localhost:8000/health)

### Ejecución con Docker
```bash
docker compose up -d
```

---

## 3. Despliegue en la Nube (Hosting Gratuito sin Dominio Propio)

ComerSys está diseñado para desplegarse inmediatamente en plataformas en la nube utilizando **subdominios gratuitos con HTTPS automático**:

### Comparativa: Render vs Railway

| Criterio | Render.com (Recomendado) | Railway.app |
| :--- | :--- | :--- |
| **Costo Inicial** | **100% Gratuito** (Sin tarjeta de crédito) | Requiere tarjeta o prueba temporal (\$5 crédito) |
| **Dominio Gratuito** | `https://tu-app.onrender.com` con SSL gratis | `https://tu-app.up.railway.app` con SSL gratis |
| **Despliegue** | 1 Clic con `render.yaml` (Blueprint nativo) | Detección automática de Dockerfile / Node.js |
| **Ambos Paneles** | Sí: `/` (Comercio) y `/admin/` (SuperAdmin) | Sí: `/` (Comercio) y `/admin/` (SuperAdmin) |
| **Persistencia Gratis** | Disco efímero en plan Free (se inicializa con template) | Volúmenes persistentes disponibles |
| **Escalabilidad** | Upgrade a disco persistente sin cambios de código | Upgrade a plan Hobby sin cambios de código |

> **Recomendación:** Para una publicación inicial gratuita sin pagos ni tarjetas, **Render** es la opción más conveniente e inmediata.

### Despliegue en Render (Paso a Paso)
1. Crea una cuenta gratuita en [render.com](https://render.com).
2. Haz clic en **New +** y selecciona **Blueprint**.
3. Conecta este repositorio de GitHub (`comersys`).
4. Render detectará automáticamente el archivo `render.yaml` y pondrá en marcha el servicio con HTTPS gratuito.
5. Tu plataforma estará disponible al instante en `https://comersys-platform.onrender.com`.

---

## 4. Conexión de Dominio Propio (Preparado para el Futuro)

La arquitectura de ComerSys está completamente lista para conectar un dominio personalizado (ej. `tucomercio.com` o `comersys.com`) **sin modificar una sola línea de código**:

1. **Configuración en el Proveedor (Render o Railway):**
   - Ve a los ajustes del servicio > **Custom Domains**.
   - Agrega tu dominio principal: `tuempresa.com`.
   - Agrega opcionalmente el subdominio para la administración central: `admin.tuempresa.com`.
2. **Registros DNS en tu Registrador de Dominios (cuando decidas adquirirlo):**
   - **Registro CNAME para www:** `www` apuntando a `tu-app.onrender.com`.
   - **Registro A / ALIAS para la raíz:** Apuntando a la IP provista por el host.
   - **Registro CNAME para admin (opcional):** `admin` apuntando a `tu-app.onrender.com`.
3. **Detección Automática de Contexto:**
   - Si el visitante accede por `tuempresa.com`, ingresa al sistema comercial.
   - Si accede por `admin.tuempresa.com` o por `tuempresa.com/admin/`, el servidor conmuta automáticamente al panel de SuperAdministrador.

---

## 5. Variables de Entorno

Configurables mediante archivo `.env` o en el panel de variables del proveedor cloud:

| Variable | Tipo | Valor Predeterminado | Propósito |
| :--- | :--- | :--- | :--- |
| `PORT` | Número | `8000` (o `$PORT` del host) | Puerto del servidor HTTP principal |
| `ADMIN_PORT` | Número | `8001` | Puerto secundario para acceso local a SuperAdmin |
| `NODE_ENV` | Texto | `production` | Modo de entorno (`production` / `development`) |
| `DATA_PATH` | Ruta | `./data/comersys_platform.json` | Ruta al archivo de almacenamiento multi-tenant |
| `ALLOWED_ORIGINS` | Texto | `*` | Orígenes CORS habilitados para APIs |

---

## 6. Criptografía y Seguridad

- **Cifrado de Credenciales:** PBKDF2 (SHA-256 + 10.000 iteraciones + Salt criptográfico único de 128-bit por usuario).
- **Protección de Sesiones:** Tokens de autorización Bearer de 256-bit con tiempo de vida limitado (TTL).
- **Mitigación de Fuerza Bruta:** Limitador de tasa (Rate Limiting) con bloqueo temporal tras 5 intentos fallidos consecutivos por IP.
- **Cabeceras HTTP de Seguridad:** `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Transacciones Atómicas:** Escritura en dos fases con archivo temporal (`.tmp`) y generación automática de respaldo rotativo (`.bak`).
- **Cero Dependencias en Producción:** Menor superficie de ataque y 0 vulnerabilidades de librerías externas.

---

## 7. Suite de Pruebas Automatizadas

ComerSys incluye un arnés de pruebas automatizadas con el test runner nativo de Node.js:

```bash
# Ejecutar la suite completa (38 pruebas)
npm test
```

- **api.test.js:** Verificación de autenticación, aislamiento IDOR, control de sesiones y cabeceras de seguridad.
- **crypto.test.js:** Validación del algoritmo PBKDF2, sales criptográficas y tiempo constante.
- **database.test.js:** Integridad del esquema JSON, particiones por comercio y auditoría.
- **frontend-integrity.test.js:** Comprobación de consistencia de IDs del DOM, vistas y recursos estáticos.
- **load-resilience.test.js:** Pruebas de estrés de 100 peticiones concurrentes, latencias P95/P99 y recuperación ante caídas.

---

## 8. Estructura de Directorios

```text
comersys/
├── index.html                  # Punto de entrada ComerSys Cliente (SPA comercial)
├── package.json                # Manifiesto y scripts de ejecución
├── server.js                   # Servidor de producción en Node.js (cero dependencias)
├── server.ps1                  # Servidor dual-port para desarrollo en Windows
├── Dockerfile                  # Contenedor optimizado en node:20-alpine
├── docker-compose.yml          # Orquestación de desarrollo y producción
├── render.yaml                 # Blueprint declarativo para Render.com
├── .env.example                # Plantilla de variables de entorno
├── .gitignore                  # Reglas estrictas de exclusión de datos y secretos
│
├── admin-central/              # Aplicación de Administración Central (SuperAdmin)
│   ├── index.html              # Panel ejecutivo (Directorio, Auditoría y Sistema)
│   ├── css/admin.css           # Sistema de diseño corporativo responsive
│   └── js/admin.js             # Lógica cliente, validaciones y conexión API
│
├── css/                        # Hojas de estilo del sistema comercial
├── js/                         # Lógica modular del sistema comercial
├── data/                       # Motor de datos persistente
│   └── comersys_platform.template.json  # Plantilla limpia de inicio para producción
│
├── test/                       # Arnes de pruebas automatizadas (38 tests)
└── documentacion/              # Manual de usuario con capturas paso a paso
```

---

## Licencia

Propiedad exclusiva de **ComerSys Platform**. Todos los derechos reservados.
