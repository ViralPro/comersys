/**
 * ============================================================================
 * COMERSYS — SERVICIO DE CUOTAS, DEUDAS Y REGISTRO DE PAGOS
 * ============================================================================
 * Gestiona el sistema completo de financiación, generación automática de
 * cuotas, control de vencimientos, pagos parciales, pagos completos y
 * actualización automática de saldos.
 *
 * Distingue estados:
 * - al_dia ("Al día")
 * - pendiente ("Pendiente")
 * - pago_parcial ("Pago parcial")
 * - atrasado ("Atrasado")
 * - cancelado ("Cancelado")
 */
(function (global) {
  'use strict';

  const { Storage, Validators, Formatters } = global.ComerSys.Core;

  const DebtsService = {
    /**
     * Evalúa el estado dinámico de una cuota individual según su saldo y fecha de vencimiento.
     */
    computeInstallmentStatus(inst, today = Formatters.todayISO()) {
      const amount = Validators.roundCurrency(inst.amount);
      const paid = Validators.roundCurrency(inst.paidAmount);
      const pending = Validators.roundCurrency(Math.max(0, amount - paid));

      if (pending <= 0.009) {
        return 'cancelado';
      }
      if (inst.dueDate && inst.dueDate < today) {
        return 'atrasado';
      }
      if (paid > 0 && pending > 0) {
        return 'pago_parcial';
      }
      return 'pendiente';
    },

    /**
     * Evalúa el estado dinámico de una cuenta/deuda según sus cuotas y vencimientos.
     * Distingue: Al día, Pendiente, Pago parcial, Atrasado, Cancelado.
     */
    computeDebtStatus(debt, installments, today = Formatters.todayISO()) {
      const total = Validators.roundCurrency(debt.totalAmount);
      const paid = Validators.roundCurrency(debt.paidAmount);
      const pending = Validators.roundCurrency(Math.max(0, total - paid));

      if (pending <= 0.009) {
        return 'cancelado';
      }

      const activeInstallments = (installments || []).filter(
        (i) => Validators.roundCurrency(i.amount - i.paidAmount) > 0.009
      );

      // Si alguna cuota impaga ya venció (dueDate < hoy) -> Atrasado
      const hasOverdue = activeInstallments.some((i) => i.dueDate && i.dueDate < today);
      if (hasOverdue) {
        return 'atrasado';
      }

      // Si la próxima cuota tiene un pago parcial entregado -> Pago parcial
      const hasPartialInstallment = activeInstallments.some((i) => Number(i.paidAmount) > 0);
      if (hasPartialInstallment) {
        return 'pago_parcial';
      }

      // Si es un plan de cuotas sin cuotas vencidas y ya tiene cuotas previas canceladas o entrega al día -> Al día / Pendiente
      const completedInstallments = (installments || []).filter(
        (i) => Validators.roundCurrency(i.amount - i.paidAmount) <= 0.009
      );
      if (completedInstallments.length > 0 && !hasOverdue) {
        return 'al_dia';
      }

      return 'pendiente';
    },

    /**
     * Construye dentro de una transacción una deuda y su cronograma de cuotas.
     * Usado tanto desde Ventas (pago parcial o en cuotas) como desde Nueva Cuenta en Cuotas y Deudas.
     */
    createDebtRecordInTx(db, storage, params) {
      const clientId = Number(params.clientId);
      const saleId = params.saleId ? Number(params.saleId) : null;
      const concept = String(params.concept || 'Financiación comercial').trim();
      const totalSaleAmount = Validators.roundCurrency(params.totalSaleAmount);
      const initialPayment = Validators.roundCurrency(params.initialPayment || 0);
      const financedAmount = Validators.roundCurrency(totalSaleAmount - initialPayment);
      const installmentsCount = Math.max(1, parseInt(params.installmentsCount, 10) || 1);
      const firstDueDate = params.firstDueDate || Formatters.todayISO();
      const frequency = params.frequency || 'mensual';
      const now = new Date().toISOString();

      if (financedAmount <= 0) {
        throw new Error('El saldo a financiar debe ser mayor a 0.');
      }

      const debtId = storage.nextId('debts');

      // Generación exacta de cuotas (ajustando centavos en la última cuota)
      const baseInstallmentAmount = Math.floor((financedAmount / installmentsCount) * 100) / 100;
      const createdInstallments = [];
      let accumulated = 0;

      for (let i = 0; i < installmentsCount; i++) {
        const isLast = i === installmentsCount - 1;
        const instAmount = isLast
          ? Validators.roundCurrency(financedAmount - accumulated)
          : Validators.roundCurrency(baseInstallmentAmount);
        accumulated = Validators.roundCurrency(accumulated + instAmount);

        const dueDate = Formatters.addInstallmentPeriod(firstDueDate, i, frequency);
        const instRecord = {
          id: storage.nextId('installments'),
          debtId,
          saleId,
          clientId,
          number: i + 1,
          totalInstallments: installmentsCount,
          amount: instAmount,
          paidAmount: 0,
          pendingAmount: instAmount,
          dueDate,
          status: 'pendiente',
          paidAt: null,
          createdAt: now
        };
        instRecord.status = this.computeInstallmentStatus(instRecord);
        db.installments.push(instRecord);
        createdInstallments.push(instRecord);
      }

      const debtRecord = {
        id: debtId,
        saleId,
        clientId,
        concept,
        mode: installmentsCount > 1 ? 'cuotas' : 'parcial',
        originalSaleTotal: totalSaleAmount,
        initialPayment,
        totalAmount: financedAmount,
        paidAmount: 0,
        pendingAmount: financedAmount,
        installmentsCount,
        frequency,
        firstDueDate,
        nextDueDate: firstDueDate,
        status: 'pendiente',
        createdAt: now,
        updatedAt: now
      };

      debtRecord.status = this.computeDebtStatus(debtRecord, createdInstallments);
      db.debts.push(debtRecord);

      return { debt: debtRecord, installments: createdInstallments };
    },

    /**
     * Permite crear una cuenta financiada o deuda directa para un cliente desde el módulo Cuotas y Deudas.
     */
    createStandaloneDebt(payload) {
      const clientId = Number(payload.clientId);
      const concept = String(payload.concept || '').trim();
      const totalAmount = Validators.roundCurrency(payload.totalAmount);
      const initialPayment = Validators.roundCurrency(payload.initialPayment || 0);
      const installmentsCount = Math.max(1, parseInt(payload.installmentsCount, 10) || 1);
      const firstDueDate = payload.firstDueDate || Formatters.todayISO();
      const frequency = payload.frequency || 'mensual';
      const paymentMethod = payload.paymentMethod || 'efectivo';

      if (!clientId) throw new Error('Seleccione un cliente.');
      if (!concept) throw new Error('Ingrese el concepto o descripción de la cuenta.');
      if (!Validators.isPositiveNumber(totalAmount)) {
        throw new Error('El importe total debe ser mayor a 0.');
      }
      if (initialPayment < 0 || initialPayment >= totalAmount) {
        throw new Error('La entrega inicial debe ser menor al importe total a financiar.');
      }

      return Storage.transaction((db, storage) => {
        const client = db.clients.find((c) => Number(c.id) === clientId);
        if (!client) throw new Error('El cliente seleccionado no existe.');

        const result = this.createDebtRecordInTx(db, storage, {
          clientId,
          saleId: null,
          concept,
          totalSaleAmount: totalAmount,
          initialPayment,
          installmentsCount,
          firstDueDate,
          frequency
        });

        if (initialPayment > 0) {
          const now = new Date().toISOString();
          const paymentId = storage.nextId('payments');
          db.payments.push({
            id: paymentId,
            clientId,
            saleId: null,
            debtId: result.debt.id,
            installmentId: null,
            amount: initialPayment,
            paymentMethod,
            date: Formatters.todayISO(),
            notes: `Entrega inicial — ${concept}`,
            createdAt: now
          });

          db.movements.push({
            id: storage.nextId('movements'),
            type: 'cobro',
            category: 'Entrega Inicial de Cuenta',
            direction: 'in',
            amount: initialPayment,
            paymentMethod,
            date: Formatters.todayISO(),
            description: `Entrega inicial de ${client.name} (${concept})`,
            referenceType: 'payment',
            referenceId: paymentId,
            createdAt: now
          });
        }

        return result.debt;
      });
    },

    /**
     * Obtiene todas las deudas enriquecidas con datos del cliente, cuotas y estados actualizados al día de hoy.
     */
    getAllDebts(filters = {}) {
      const db = Storage.getState();
      const today = Formatters.todayISO();
      const q = Validators.normalizeText(filters.search || '');
      const statusFilter = filters.status || 'todos';
      const clientFilter = filters.clientId ? Number(filters.clientId) : null;

      const clientsMap = new Map(db.clients.map((c) => [Number(c.id), c]));

      return db.debts
        .map((debt) => {
          const client = clientsMap.get(Number(debt.clientId));
          const debtInstallments = db.installments
            .filter((i) => Number(i.debtId) === Number(debt.id))
            .sort((a, b) => a.number - b.number)
            .map((inst) => {
              const pendingAmount = Validators.roundCurrency(
                Math.max(0, Number(inst.amount) - Number(inst.paidAmount))
              );
              return Object.assign({}, inst, {
                pendingAmount,
                status: this.computeInstallmentStatus(inst, today)
              });
            });

          const paidAmount = Validators.roundCurrency(
            debtInstallments.reduce((sum, i) => sum + Number(i.paidAmount || 0), 0)
          );
          const pendingAmount = Validators.roundCurrency(
            Math.max(0, Number(debt.totalAmount) - paidAmount)
          );
          const nextPendingInst = debtInstallments.find((i) => i.pendingAmount > 0.009);
          const nextDueDate = nextPendingInst ? nextPendingInst.dueDate : debt.firstDueDate;
          const computedStatus = this.computeDebtStatus(
            Object.assign({}, debt, { paidAmount, pendingAmount }),
            debtInstallments,
            today
          );

          // Total global de la operación (incluyendo entrega inicial si existió)
          const operationTotal = Validators.roundCurrency(
            Number(debt.originalSaleTotal || debt.totalAmount)
          );
          const operationPaid = Validators.roundCurrency(
            Number(debt.initialPayment || 0) + paidAmount
          );

          return Object.assign({}, debt, {
            clientName: client ? client.name : 'Cliente eliminado',
            clientPhone: client ? client.phone : '',
            paidAmount,
            pendingAmount,
            operationTotal,
            operationPaid,
            nextDueDate,
            status: computedStatus,
            installments: debtInstallments,
            paidInstallmentsCount: debtInstallments.filter((i) => i.pendingAmount <= 0.009).length
          });
        })
        .filter((d) => {
          if (clientFilter && Number(d.clientId) !== clientFilter) return false;
          if (statusFilter && statusFilter !== 'todos') {
            if (d.status !== statusFilter) return false;
          }
          if (q) {
            const matchName = Validators.normalizeText(d.clientName).includes(q);
            const matchConcept = Validators.normalizeText(d.concept).includes(q);
            if (!matchName && !matchConcept) return false;
          }
          return true;
        })
        .sort((a, b) => {
          // Priorizar atrasados y pendientes sobre cancelados
          const order = { atrasado: 1, pago_parcial: 2, pendiente: 3, al_dia: 4, cancelado: 5 };
          if (order[a.status] !== order[b.status]) {
            return (order[a.status] || 9) - (order[b.status] || 9);
          }
          return String(a.nextDueDate || '').localeCompare(String(b.nextDueDate || ''));
        });
    },

    /**
     * Obtiene una deuda específica por ID con todas sus cuotas.
     */
    getDebtById(debtId) {
      const list = this.getAllDebts();
      return list.find((d) => Number(d.id) === Number(debtId)) || null;
    },

    /**
     * Obtiene todas las cuotas de un cliente (o de todo el sistema).
     */
    getInstallmentsByClient(clientId) {
      const debts = this.getAllDebts({ clientId });
      const result = [];
      debts.forEach((debt) => {
        debt.installments.forEach((inst) => {
          result.push(
            Object.assign({}, inst, {
              concept: debt.concept,
              debtStatus: debt.status
            })
          );
        });
      });
      return result.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
    },

    /**
     * Registra un pago (completo o parcial) sobre una cuota específica o sobre una deuda general.
     * Actualiza automáticamente las cuotas, el saldo de la deuda, el estado de la venta si aplica,
     * el saldo del cliente y registra el ingreso real en Finanzas.
     */
    registerPayment(payload) {
      const clientId = Number(payload.clientId);
      const debtId = Number(payload.debtId);
      const installmentId = payload.installmentId ? Number(payload.installmentId) : null;
      const amount = Validators.roundCurrency(payload.amount);
      const paymentMethod = payload.paymentMethod || 'efectivo';
      const date = payload.date || Formatters.todayISO();
      const notes = String(payload.notes || '').trim();

      if (!clientId) throw new Error('Seleccione el cliente que realiza el pago.');
      if (!debtId) throw new Error('Seleccione la deuda o cuota a abonar.');
      if (!Validators.isPositiveNumber(amount)) {
        throw new Error('El importe del pago debe ser mayor a 0.');
      }

      return Storage.transaction((db, storage) => {
        const client = db.clients.find((c) => Number(c.id) === clientId);
        if (!client) throw new Error('Cliente no encontrado.');

        const debt = db.debts.find((d) => Number(d.id) === debtId && Number(d.clientId) === clientId);
        if (!debt) throw new Error('No se encontró la cuenta seleccionada para este cliente.');

        const debtInstallments = db.installments
          .filter((i) => Number(i.debtId) === debtId)
          .sort((a, b) => a.number - b.number);

        const currentDebtPending = Validators.roundCurrency(
          debtInstallments.reduce(
            (sum, i) => sum + Math.max(0, Number(i.amount) - Number(i.paidAmount)),
            0
          )
        );

        if (currentDebtPending <= 0) {
          throw new Error('Esta deuda ya se encuentra completamente cancelada.');
        }

        if (amount > currentDebtPending + 0.01) {
          throw new Error(
            `El importe ingresado (${Formatters.currency(amount)}) supera el saldo pendiente de la cuenta (${Formatters.currency(currentDebtPending)}).`
          );
        }

        const now = new Date().toISOString();
        const today = Formatters.todayISO();
        let remainingToApply = amount;
        const appliedLabels = [];

        // Si se eligió una cuota específica, se aplica primero a esa cuota y el excedente (si hubiera) a las siguientes
        const orderedTargets = [];
        if (installmentId) {
          const targetInst = debtInstallments.find((i) => Number(i.id) === installmentId);
          if (targetInst) orderedTargets.push(targetInst);
          debtInstallments.forEach((i) => {
            if (Number(i.id) !== installmentId) orderedTargets.push(i);
          });
        } else {
          orderedTargets.push(...debtInstallments);
        }

        orderedTargets.forEach((inst) => {
          if (remainingToApply <= 0.004) return;
          const instPending = Validators.roundCurrency(
            Math.max(0, Number(inst.amount) - Number(inst.paidAmount))
          );
          if (instPending <= 0.004) return;

          const applied = Validators.roundCurrency(Math.min(instPending, remainingToApply));
          inst.paidAmount = Validators.roundCurrency(Number(inst.paidAmount) + applied);
          inst.pendingAmount = Validators.roundCurrency(
            Math.max(0, Number(inst.amount) - inst.paidAmount)
          );
          remainingToApply = Validators.roundCurrency(remainingToApply - applied);

          if (inst.pendingAmount <= 0.009) {
            inst.pendingAmount = 0;
            inst.paidAmount = Validators.roundCurrency(inst.amount);
            inst.status = 'cancelado';
            inst.paidAt = date;
            appliedLabels.push(`Cuota #${inst.number} (Cancelada)`);
          } else {
            inst.status = this.computeInstallmentStatus(inst, today);
            appliedLabels.push(`Cuota #${inst.number} (Pago parcial)`);
          }
        });

        // Recalcular totales de la deuda
        debt.paidAmount = Validators.roundCurrency(
          debtInstallments.reduce((sum, i) => sum + Number(i.paidAmount), 0)
        );
        debt.pendingAmount = Validators.roundCurrency(
          Math.max(0, Number(debt.totalAmount) - debt.paidAmount)
        );
        const nextOpen = debtInstallments.find((i) => i.pendingAmount > 0.009);
        debt.nextDueDate = nextOpen ? nextOpen.dueDate : debt.firstDueDate;
        debt.status = this.computeDebtStatus(debt, debtInstallments, today);
        debt.updatedAt = now;

        // Si la deuda proviene de una venta, actualizar también los importes cobrados de la venta
        if (debt.saleId) {
          const sale = db.sales.find((s) => Number(s.id) === Number(debt.saleId));
          if (sale) {
            sale.paidAmount = Validators.roundCurrency(
              Number(debt.initialPayment || 0) + debt.paidAmount
            );
            sale.pendingAmount = debt.pendingAmount;
            sale.status = debt.pendingAmount <= 0.009 ? 'pagado' : debt.status;
            sale.updatedAt = now;
          }
        }

        const autoConcept =
          appliedLabels.length > 0
            ? `${debt.concept} — ${appliedLabels.join(', ')}`
            : `Pago a cuenta — ${debt.concept}`;

        const paymentRecord = {
          id: storage.nextId('payments'),
          clientId,
          saleId: debt.saleId || null,
          debtId: debt.id,
          installmentId: installmentId || null,
          amount,
          paymentMethod,
          date,
          notes: notes ? `${autoConcept} (${notes})` : autoConcept,
          createdAt: now
        };
        db.payments.push(paymentRecord);

        // Registrar cobro real en el libro de movimientos financieros
        db.movements.push({
          id: storage.nextId('movements'),
          type: 'cobro',
          category: 'Cobro de Cuota / Deuda',
          direction: 'in',
          amount,
          paymentMethod,
          date,
          description: `Cobro a ${client.name}: ${paymentRecord.notes}`,
          referenceType: 'payment',
          referenceId: paymentRecord.id,
          createdAt: now
        });

        return paymentRecord;
      });
    },

    /**
     * Obtiene el historial de pagos registrados (filtrable por cliente o búsqueda).
     */
    getPayments(filters = {}) {
      const db = Storage.getState();
      const clientsMap = new Map(db.clients.map((c) => [Number(c.id), c.name]));
      const clientFilter = filters.clientId ? Number(filters.clientId) : null;

      return db.payments
        .filter((p) => {
          if (clientFilter && Number(p.clientId) !== clientFilter) return false;
          return true;
        })
        .map((p) =>
          Object.assign({}, p, {
            clientName: clientsMap.get(Number(p.clientId)) || 'Consumidor Final'
          })
        )
        .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));
    }
  };

  global.ComerSys.Services.DebtsService = DebtsService;
})(window);
