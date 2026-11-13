/**
 * ============================================================================
 * COMERSYS — FORMATEADORES DE MONEDA, FECHAS Y CÁLCULO DE VENCIMIENTOS
 * ============================================================================
 */
(function (global) {
  'use strict';

  const { Storage, Validators } = global.ComerSys.Core;

  const Formatters = {
    /**
     * Formatea un importe numérico en la moneda configurada en el sistema.
     */
    currency(value) {
      const state = Storage.getState();
      const symbol = (state && state.settings && state.settings.currencySymbol) || '$';
      const num = Validators.roundCurrency(value);
      const isNegative = num < 0;
      const absNum = Math.abs(num);

      const hasDecimals = absNum % 1 !== 0;
      const formatted = absNum.toLocaleString('es-AR', {
        minimumFractionDigits: hasDecimals ? 2 : 0,
        maximumFractionDigits: 2
      });

      return `${isNegative ? '-' : ''}${symbol}${formatted}`;
    },

    /**
     * Devuelve la fecha local de hoy en formato ISO corto `YYYY-MM-DD`.
     */
    todayISO() {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },

    /**
     * Convierte una cadena de fecha ISO (`YYYY-MM-DD` o timestamp) al formato del sistema.
     */
    date(dateInput) {
      if (!dateInput) return '—';
      const state = Storage.getState();
      const format = (state && state.settings && state.settings.dateFormat) || 'DD/MM/YYYY';

      let y, m, d;
      if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const parts = dateInput.split('-');
        y = parts[0];
        m = parts[1];
        d = parts[2];
      } else {
        const dt = new Date(dateInput);
        if (isNaN(dt.getTime())) return String(dateInput);
        y = String(dt.getFullYear());
        m = String(dt.getMonth() + 1).padStart(2, '0');
        d = String(dt.getDate()).padStart(2, '0');
      }

      if (format === 'YYYY-MM-DD') {
        return `${y}-${m}-${d}`;
      }
      return `${d}/${m}/${y}`;
    },

    /**
     * Formatea la fecha actual en texto largo para el encabezado del Dashboard.
     */
    longDate(dateInput = new Date()) {
      const dt = dateInput instanceof Date ? dateInput : new Date(dateInput);
      return dt.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    },

    /**
     * Suma períodos a una fecha base `YYYY-MM-DD` para generar cronogramas de cuotas.
     */
    addInstallmentPeriod(baseDateISO, stepIndex, frequency) {
      const parts = String(baseDateISO).split('-').map(Number);
      const originalDay = parts[2] || 1;
      const dt = new Date(parts[0], (parts[1] || 1) - 1, originalDay);

      if (stepIndex === 0) {
        return baseDateISO;
      }

      if (frequency === 'semanal') {
        dt.setDate(dt.getDate() + stepIndex * 7);
      } else if (frequency === 'quincenal') {
        dt.setDate(dt.getDate() + stepIndex * 15);
      } else {
        // Mensual por defecto con ajuste seguro de fin de mes
        dt.setDate(1);
        dt.setMonth(dt.getMonth() + stepIndex);
        const daysInMonth = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
        dt.setDate(Math.min(originalDay, daysInMonth));
      }

      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },

    /**
     * Obtiene las iniciales de un nombre (máximo 2 letras) para avatares.
     */
    initials(name) {
      if (!name) return 'CS';
      const words = String(name).trim().split(/\s+/).filter(Boolean);
      if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    },

    /**
     * Renderiza un badge HTML según el estado financiero/deuda:
     * Distingue: Al día, Pendiente, Pago parcial, Atrasado, Cancelado, Pagado.
     */
    statusBadge(status) {
      const map = {
        'al_dia': { label: 'Al día', cls: 'badge-success' },
        'pagado': { label: 'Pagado', cls: 'badge-success' },
        'cancelado': { label: 'Cancelado', cls: 'badge-neutral' },
        'pendiente': { label: 'Pendiente', cls: 'badge-warning' },
        'pago_parcial': { label: 'Pago parcial', cls: 'badge-warning' },
        'debe': { label: 'Pendiente', cls: 'badge-warning' },
        'atrasado': { label: 'Atrasado', cls: 'badge-danger' }
      };
      const item = map[status] || { label: status || 'Al día', cls: 'badge-neutral' };
      return `<span class="badge ${item.cls}">${Validators.escapeHtml(item.label)}</span>`;
    }
  };

  global.ComerSys.Core.Formatters = Formatters;
})(window);
