/**
 * ============================================================================
 * COMERSYS — CONFIGURACIÓN CENTRAL Y ARQUITECTURA DE ADAPTADORES
 * ============================================================================
 * Define el espacio de nombres modular de la aplicación y la configuración
 * del motor de persistencia (LocalStorage transaccional hoy, integrable con
 * PHP + MySQL cambiando únicamente `DRIVER: 'PHP_MYSQL'` sin rehacer la UI).
 */
(function (global) {
  'use strict';

  const ComerSys = global.ComerSys || {};

  ComerSys.Config = {
    APP_NAME: 'ComerSys',
    APP_VERSION: '1.0.0',
    STORAGE_KEY: 'comersys_erp_database_v1',
    SESSION_KEY: 'comersys_erp_session_v1',

    /**
     * DRIVER DE DATOS:
     * - 'LOCAL': Persistencia local transaccional inmediata en el navegador.
     * - 'PHP_MYSQL': Conecta mediante fetch() a los endpoints REST en `API_BASE_URL`.
     */
    DATA_DRIVER: 'LOCAL',
    API_BASE_URL: './api/v1',

    DEFAULT_SETTINGS: {
      businessName: 'ComerSys',
      taxId: '',
      phone: '',
      address: '',
      currencySymbol: '$',
      currencyCode: 'ARS',
      dateFormat: 'DD/MM/YYYY',
      lowStockThreshold: 5,
      darkMode: false
    },

    PAYMENT_METHODS: [
      { id: 'efectivo', label: 'Efectivo' },
      { id: 'tarjeta', label: 'Tarjeta' },
      { id: 'transferencia', label: 'Transferencia' },
      { id: 'otro', label: 'Otro' }
    ],

    INSTALLMENT_FREQUENCIES: [
      { id: 'mensual', label: 'Mensual', days: 30 },
      { id: 'quincenal', label: 'Quincenal', days: 15 },
      { id: 'semanal', label: 'Semanal', days: 7 }
    ]
  };

  ComerSys.Core = ComerSys.Core || {};
  ComerSys.Services = ComerSys.Services || {};
  ComerSys.UI = ComerSys.UI || {};
  ComerSys.Modules = ComerSys.Modules || {};

  global.ComerSys = ComerSys;
})(window);
