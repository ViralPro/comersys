/**
 * ============================================================================
 * COMERSYS — VALIDADORES Y REGLAS DE INTEGRIDAD DE NEGOCIO
 * ============================================================================
 */
(function (global) {
  'use strict';

  const Validators = {
    /**
     * Normaliza texto para comparaciones libres de acentos y espacios extra (anti-duplicados).
     */
    normalizeText(value) {
      if (!value) return '';
      return String(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');
    },

    /**
     * Normaliza teléfono o documento dejando solo dígitos/caracteres alfanuméricos.
     */
    normalizeIdentifier(value) {
      if (!value) return '';
      return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    },

    /**
     * Escapa caracteres HTML para evitar inyección XSS al renderizar vistas dinámicas.
     */
    escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    /**
     * Redondea importes monetarios a 2 decimales con precisión contable.
     */
    roundCurrency(amount) {
      const num = Number(amount);
      if (!Number.isFinite(num)) return 0;
      return Math.round((num + Number.EPSILON) * 100) / 100;
    },

    /**
     * Valida que un número sea positivo o cero.
     */
    isNonNegativeNumber(val) {
      const n = Number(val);
      return Number.isFinite(n) && n >= 0;
    },

    /**
     * Valida que un número sea estrictamente mayor a cero.
     */
    isPositiveNumber(val) {
      const n = Number(val);
      return Number.isFinite(n) && n > 0;
    }
  };

  global.ComerSys.Core.Validators = Validators;
})(window);
