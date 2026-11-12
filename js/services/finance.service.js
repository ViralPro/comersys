/**
 * ============================================================================
 * COMERSYS — SERVICIO DE FINANZAS Y LIBRO DIARIO DE MOVIMIENTOS
 * ============================================================================
 * Calcula indicadores reales desde los movimientos registrados sin confundir
 * el dinero vendido con el dinero efectivamente cobrado:
 * - Ventas (Total Vendido)
 * - Cobros (Total Cobrado efectivamente ingresado)
 * - Deudas (Pendiente de cobro)
 * - Compras (Inversión en mercadería / stock)
 * - Ganancias (Ganancia bruta de ventas y ganancia efectivamente cobrada)
 * - Ingresos (Entradas reales de dinero)
 * - Egresos (Compras + Gastos operativos)
 */
(function (global) {
  'use strict';

  const { Storage, Validators, Formatters } = global.ComerSys.Core;

  const FinanceService = {
    /**
     * Calcula todos los indicadores financieros reales para un rango de fechas opcional.
     */
    getFinancialSummary(filters = {}) {
      const db = Storage.getState();
      const { DebtsService } = global.ComerSys.Services;
      const dateFrom = filters.dateFrom || null;
      const dateTo = filters.dateTo || null;

      const inDateRange = (dateStr) => {
        if (!dateStr) return true;
        const d = String(dateStr).substring(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      };

      // 1. Ventas en el período
      const filteredSales = db.sales.filter((s) => inDateRange(s.date));
      const totalSold = Validators.roundCurrency(
        filteredSales.reduce((acc, s) => acc + Number(s.total || 0), 0)
      );
      const estimatedProfit = Validators.roundCurrency(
        filteredSales.reduce((acc, s) => acc + Number(s.estimatedProfit || 0), 0)
      );

      // 2. Pagos / Cobros efectivamente recibidos en el período
      const filteredPayments = db.payments.filter((p) => inDateRange(p.date));
      const totalCollected = Validators.roundCurrency(
        filteredPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0)
      );

      // 3. Deudas pendientes de cobro (total activo en la calle)
      const allDebts = DebtsService.getAllDebts();
      const totalPending = Validators.roundCurrency(
        allDebts.reduce((acc, d) => acc + Number(d.pendingAmount || 0), 0)
      );
      const overdueDebtsCount = allDebts.filter((d) => d.status === 'atrasado').length;

      // 4. Movimientos de Caja (Ingresos, Compras de Stock, Egresos Operativos)
      const filteredMovements = db.movements
        .filter((m) => inDateRange(m.date))
        .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));

      const totalPurchases = Validators.roundCurrency(
        filteredMovements
          .filter((m) => m.type === 'compra')
          .reduce((acc, m) => acc + Number(m.amount || 0), 0)
      );

      const otherExpenses = Validators.roundCurrency(
        filteredMovements
          .filter((m) => m.type === 'egreso')
          .reduce((acc, m) => acc + Number(m.amount || 0), 0)
      );

      const totalIncome = Validators.roundCurrency(
        filteredMovements
          .filter((m) => m.direction === 'in')
          .reduce((acc, m) => acc + Number(m.amount || 0), 0)
      );

      const totalExpenses = Validators.roundCurrency(
        filteredMovements
          .filter((m) => m.direction === 'out')
          .reduce((acc, m) => acc + Number(m.amount || 0), 0)
      );

      const netCashflow = Validators.roundCurrency(totalIncome - totalExpenses);

      // Ganancia efectivamente cobrada (proporcional al porcentaje cobrado de cada venta)
      const realizedProfit = Validators.roundCurrency(
        filteredSales.reduce((acc, s) => {
          const saleTotal = Number(s.total || 0);
          if (saleTotal <= 0) return acc;
          const linkedDebt = allDebts.find((d) => Number(d.saleId) === Number(s.id));
          const collectedForSale = linkedDebt
            ? Number(linkedDebt.initialPayment || 0) + Number(linkedDebt.paidAmount || 0)
            : Number(s.paidAmount || saleTotal);
          const ratio = Math.min(1, Math.max(0, collectedForSale / saleTotal));
          return acc + Number(s.estimatedProfit || 0) * ratio;
        }, 0)
      );

      return {
        totalSold,
        totalCollected,
        totalPending,
        totalPurchases,
        otherExpenses,
        estimatedProfit,
        realizedProfit,
        totalIncome,
        totalExpenses,
        netCashflow,
        salesCount: filteredSales.length,
        paymentsCount: filteredPayments.length,
        overdueDebtsCount,
        movements: filteredMovements
      };
    },

    /**
     * Registra un movimiento financiero manual (Egreso operativo, Compra de insumo o Ingreso extra).
     */
    createManualMovement(payload) {
      const type = payload.type || 'egreso'; // 'compra' | 'egreso' | 'ingreso'
      const category = String(payload.category || '').trim();
      const amount = Validators.roundCurrency(payload.amount);
      const paymentMethod = payload.paymentMethod || 'efectivo';
      const date = payload.date || Formatters.todayISO();
      const description = String(payload.description || '').trim();

      if (!['compra', 'egreso', 'ingreso'].includes(type)) {
        throw new Error('Tipo de movimiento no válido.');
      }
      if (!Validators.isPositiveNumber(amount)) {
        throw new Error('El importe del movimiento debe ser mayor a 0.');
      }
      if (!description) {
        throw new Error('Ingrese una descripción o concepto para el movimiento.');
      }

      const direction = type === 'ingreso' ? 'in' : 'out';
      const defaultCategory =
        type === 'compra'
          ? 'Compra de Mercadería'
          : type === 'egreso'
          ? 'Gasto Operativo'
          : 'Ingreso Extraordinario';

      return Storage.transaction((db, storage) => {
        const record = {
          id: storage.nextId('movements'),
          type,
          category: category || defaultCategory,
          direction,
          amount,
          paymentMethod,
          date,
          description,
          referenceType: 'manual',
          referenceId: null,
          createdAt: new Date().toISOString()
        };
        db.movements.push(record);
        return record;
      });
    },

    /**
     * Construye la serie de los últimos 7 días para el gráfico del Dashboard y Finanzas.
     */
    getLast7DaysSeries() {
      const db = Storage.getState();
      const days = [];
      const today = new Date();
      const shortMonths = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

      for (let i = 6; i >= 0; i--) {
        const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        const iso = `${y}-${m}-${d}`;
        const label = `${dt.getDate()} ${shortMonths[dt.getMonth()]}`;

        const daySold = Validators.roundCurrency(
          db.sales
            .filter((s) => String(s.date).substring(0, 10) === iso)
            .reduce((sum, s) => sum + Number(s.total || 0), 0)
        );

        const dayIncome = Validators.roundCurrency(
          db.movements
            .filter((mv) => mv.direction === 'in' && String(mv.date).substring(0, 10) === iso)
            .reduce((sum, mv) => sum + Number(mv.amount || 0), 0)
        );

        const dayExpense = Validators.roundCurrency(
          db.movements
            .filter((mv) => mv.direction === 'out' && String(mv.date).substring(0, 10) === iso)
            .reduce((sum, mv) => sum + Number(mv.amount || 0), 0)
        );

        days.push({
          iso,
          label,
          sold: daySold,
          income: dayIncome,
          expense: dayExpense
        });
      }

      return days;
    }
  };

  global.ComerSys.Services.FinanceService = FinanceService;
})(window);
