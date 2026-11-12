# ComerSys Platform v2.0 — Sistema Comercial Multi-Tenant & Administración Central

**ComerSys** es una solución comercial y empresarial integral que combina un sistema de gestión comercial de alto rendimiento (Punto de Venta, Control de Inventario, Gestión de Clientes, Cuentas Corrientes y Finanzas) con un panel centralizado de **SuperAdministración Multi-Tenant** para la supervisión global de múltiples comercios.

---

## 1. Arquitectura del Sistema

La plataforma está dividida en dos entornos aislados y coordinados:

1. **ComerSys Cliente (Punto de Venta & ERP Comercial)**
   - **Punto de Venta (POS):** Registro de ventas en 4 pasos (Contado, Entrega parcial, Financiación en cuotas).
   - **Control de Inventario:** Grupos dinámicos de productos, control de stock mínimo, cálculo de márgenes comerciales y alertas de reposición.
   - **Gestión de Clientes & CRM:** Ficha comercial por cliente, historial de compras, límites de crédito, cuentas corrientes y registro de deudas.
   - **Caja & Finanzas:** Arqueo de movimientos, balance de ingresos y cronograma de cobro de cuotas.
   - **Aislamiento de Datos:** Cada comercio opera en su propio espacio de datos cifrado e independiente.

2. **ComerSys Central (Panel de SuperAdministrador — Puerto 8001 / `/admin`)**
   - **Cuenta Maestra Única:** Propiedad y control exclusivo del SuperAdministrador (`admin@comersys.local` o configurable vía entorno).
   - **Directorio de Comercios:** Creación, activación, suspensión por falta de pago y reactivación de cuentas comerciales.
   - **Supervisión Transaccional:** Inspección en tiempo real del catálogo, clientes y últimas ventas de cada comercio.
   - **Gestión de Suscripciones:** Control de planes (Básico, Profesional, Empresarial), estados de cobro y fechas de renovación.
   - **Auditoría & Seguridad:** Registro cronológico inmutable de accesos, operaciones y cambios de estado con trazabilidad completa.
   - **Respaldo & Diagnóstico:** Exportación de bases de datos completas y comprobación de integridad criptográfica.

---

## 2. Puesta en Marcha Rápida (Ejecución Local)

### Opción A — Con Node.js (Recomendado para Producción y Multiplataforma)
El proyecto incluye un servidor de producción nativo sin dependencias externas:

```bash
# 1. Iniciar el servidor
npm start
# o directamente:
node server.js
```
- **Sistema Comercial:** [http://localhost:8000/](http://localhost:8000/)
- **Administración Central:** [http://localhost:8000/admin/](http://localhost:8000/admin/) (o [http://localhost:8001/](http://localhost:8001/))

### Opción B — Con Windows PowerShell (Servidor Dual Local)
```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1
```
- **Puerto 8000:** ComerSys Cliente
- **Puerto 8001:** Administración Central

### Opción C — Con Docker (Contenedor de Producción)
```bash
docker compose up -d
```

---

## 3. Credenciales Oficiales de Demostración

### Acceso SuperAdministrador (Administración Central 8001)
- **Portal:** [http://localhost:8001/](http://localhost:8001/) o `/admin/`
- **Correo Inicial:** `admin@comersys.local` (configurable vía variable de entorno)
- **Usuario:** `administrador`
- **Contraseña Inicial:** Configurable en primer arranque
- **Rol:** `SUPERADMINISTRADOR` (Propietario del Sistema)

### Acceso Comercio de Prueba (ComerSys 8000)
- **Portal:** [http://localhost:8000/](http://localhost:8000/)
- **Usuario:** `boutiquebella`
- **Rol:** `Administrador de Comercio`

---

## 4. Estructura de Directorios

```text
comersys/
├── index.html                  # Punto de entrada principal: ComerSys Cliente (SPA)
├── package.json                # Manifiesto del proyecto y scripts de arranque
├── server.js                   # Servidor de producción en Node.js (cero dependencias)
├── server.ps1                  # Servidor de desarrollo dual port en PowerShell
├── Dockerfile                  # Imagen Docker de producción en node:20-alpine
├── docker-compose.yml          # Orquestación con persistencia en volumen ./data
├── render.yaml                 # Blueprint declarativo para despliegue en PaaS / Cloud
├── .env.example                # Plantilla de variables de entorno seguras
├── .gitignore                  # Exclusión de archivos temporales, logs y secretos
│
├── admin-central/              # Aplicación de Administración Central Multi-Tenant
│   ├── index.html              # Panel ejecutivo (Directorio, Auditoría y Sistema)
│   ├── css/admin.css           # Sistema de diseño blanco y azul, responsive táctil
│   └── js/admin.js             # Lógica cliente, validaciones y llamadas a la API
│
├── css/                        # Estilos del Sistema Comercial Cliente
│   ├── variables.css           # Tokens de color, tipografía y sombras
│   ├── base.css                # Reset y utilidades
│   ├── layout.css              # Layout split-screen, barra lateral y header
│   ├── components.css          # Tablas, modales, formularios y badges
│   └── modules.css             # Estilos específicos de cada vista comercial
│
├── js/                         # Lógica modular del Sistema Comercial Cliente
│   ├── app.js                  # Orquestador principal y Router SPA
│   ├── core/                   # Storage transaccional, APIs, validadores y formateadores
│   ├── modules/                # Dashboard, Inventario, Clientes, Ventas, Cuotas y Deudas
│   ├── services/               # Servicios de dominio y sincronización de datos
│   └── ui/                     # Componentes visuales, gráficos SVG e iconos vectoriales
│
├── data/                       # Base de datos multi-tenant persistente
│   └── comersys_platform.json  # Esquema ACID con usuarios, sesiones y espacios aislados
│
└── documentacion/              # Manuales de usuario y guías operativas paso a paso
```

---

## 5. Criptografía y Seguridad

- **Cifrado de Contraseñas:** PBKDF2 (SHA-256 con 10.000 iteraciones y Salt criptográfico aleatorio de 128-bit por usuario).
- **Protección de Sesiones:** Tokens de autorización Bearer validados exclusivamente en el backend.
- **Aislamiento de Comercios:** Cada negocio cuenta con su propio árbol transaccional; ningún comercio puede consultar ni modificar datos de otros comercios.
- **Cabeceras HTTP de Seguridad:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Cero Dependencias Externas:** Reducción absoluta de la superficie de ataque (0 vulnerabilidades CVE).
