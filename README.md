# ComerSys — Sistema de Gestión Comercial (ERP)

**ComerSys** es un sistema de gestión comercial de nivel empresarial desarrollado íntegramente con **HTML5**, **CSS3** y **JavaScript Puro (Vanilla JS)**, sin dependencias externas ni frameworks.

Su arquitectura modular separa limpiamente la **Interfaz de Usuario (UI)**, los **Servicios de Dominio** y el **Motor Transaccional de Datos**, funcionando de manera 100% local e inmediata hoy y dejando preparado el esquema relacional y conector para una futura publicación con **PHP 8.2+ y MySQL 8.0+** sin rehacer la interfaz.

---

## 1. Cómo Ejecutar el Proyecto

### Opción A — Ejecución Directa Local (Doble Clic)
La arquitectura fue diseñada sin bloqueos CORS de módulos ES6 para que pueda abrirse directamente en cualquier navegador moderno:
1. Abra la carpeta `c:\Users\Usuario\Downloads\ollama sistema`.
2. Haga doble clic sobre **`index.html`**.
3. Inicie sesión con las credenciales de administrador iniciales:
   - **Usuario:** `administrador`
   - **Contraseña:** `admin123`

### Opción B — Servidor HTTP Local (Opcional)
Si prefiere ejecutarlo mediante un servidor web local (por ejemplo, desde PowerShell):
```powershell
cd "c:\Users\Usuario\Downloads\ollama sistema"
python -m http.server 8080
```
Luego abra `http://localhost:8080` en su navegador.

---

## 2. Arquitectura del Proyecto

```text
comersys/
├── index.html                  # Punto de entrada principal (Login + App Shell SPA)
├── README.md                   # Documentación técnica y guía de ejecución
├── css/
│   ├── variables.css           # Sistema de diseño (Azul marino, azul intenso, grises, modo oscuro)
│   ├── base.css                # Reset, tipografía profesional Inter y utilidades
│   ├── layout.css              # Login split-screen, Sidebar fijo, Header superior y diseño responsivo
│   ├── components.css          # Tablas modernas, Modales apilables, Stepper, Badges, Formularios
│   └── modules.css             # Estilos específicos de cada uno de los módulos
├── js/
│   ├── core/
│   │   ├── config.js           # Configuración central y selector de driver (LOCAL vs PHP_MYSQL)
│   │   ├── storage.js          # Motor transaccional ACID en localStorage con rollback automático
│   │   ├── api.js              # Capa Gateway de datos preparada para endpoints REST
│   │   ├── validators.js       # Sanitización XSS, redondeo contable y prevención de duplicados
│   │   └── formatters.js       # Formato de moneda, fechas y cálculo de cronogramas de vencimiento
│   ├── services/
│   │   ├── auth.service.js     # Autenticación, sesiones y preferencias del negocio
│   │   ├── inventory.service.js# Grupos dinámicos, productos, ganancia automática y reposición
│   │   ├── debts.service.js    # Motor de financiación, cuotas, vencimientos y cobros parciales/totales
│   │   ├── clients.service.js  # Padrón anti-duplicados, ficha individual, cuenta corriente y notas
│   │   ├── sales.service.js    # Registro atómico de ventas con descuento de stock e impacto financiero
│   │   └── finance.service.js  # Cálculo de métricas comerciales y resúmenes del Dashboard
│   ├── ui/
│   │   ├── icons.js            # Iconografía lineal vectorial SVG
│   │   ├── components.js       # Gestor de ventanas modales, confirmaciones, paginación y toasts
│   │   └── charts.js           # Gráficos vectoriales dinámicos (Ventas 7 días)
│   ├── modules/
│   │   ├── dashboard.js        # 1. Inicio y Dashboard
│   │   ├── inventory.js        # 2, 3 y 4. Inventario, Grupos dinámicos, Productos y Salida rápida
│   │   ├── clients.js          # 5. Clientes y Ficha detallada (Compras, Cuotas, Pagos, Notas)
│   │   ├── sales.js            # 6. Ventas e Historial + Asistente en 4 pasos
│   │   └── debts.js            # 7 y 8. Cuotas y Deudas + Registro de Pagos
│   └── app.js                  # Controlador principal, Router SPA, Buscador Global y Centro de Alertas
└── backend-php-mysql/
    ├── schema.sql              # Esquema relacional MySQL 8.0+ InnoDB completo
    └── Database.php            # Conector PDO con transacciones atómicas para futura publicación
```

---

## 3. Recorrido Funcional Recomendado (Sistema Limpio sin Datos Ficticios)

Siguiendo las reglas de calidad empresarial, **ComerSys inicia completamente limpio (`0` registros ficticios)**:

1. **Crear un Grupo Dinámico (`Inventario -> + Nuevo Grupo`)**:
   - Cree por ejemplo *"Herramientas de taller"* o *"Electricidad"*.
2. **Registrar Productos (`Entrar al grupo -> + Agregar Producto`)**:
   - Ingrese nombre, código, stock inicial, precio de compra y precio de venta.
   - Observe cómo el sistema calcula la **Ganancia** automáticamente.
3. **Registrar un Cliente (`Clientes -> + Nuevo Cliente`)**:
   - Ingrese nombre, teléfono y dirección. El validador impide crear clientes duplicados.
4. **Registrar una Venta (`Ventas -> + Nueva Venta` o desde el botón de salida rápida en Inventario)**:
   - Pruebe las 3 modalidades en el asistente de 4 pasos:
     - **Pago completo**: cobra el 100% en el acto y descuenta el stock.
     - **Pago parcial**: registra la entrega inicial en caja y deja el saldo pendiente con fecha de vencimiento.
     - **En cuotas**: genera automáticamente el cronograma de cuotas (`Cuota #1`, `Cuota #2`, etc.) según la cantidad y frecuencia elegida.
5. **Cobrar Cuotas o Saldos (`Cuotas y Deudas -> Registrar Pago` o desde la Ficha del Cliente)**:
   - Seleccione el cliente y la cuota, abone el total o una entrega parcial, y compruebe cómo se actualizan al instante los estados (**Al día**, **Pendiente**, **Pago parcial**, **Atrasado**, **Cancelado**) y el **Total Cobrado** en el panel de **Inicio**.
