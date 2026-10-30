/**
 * ============================================================================
 * COMERSYS — SERVICIO TRANSACCIONAL DE VENTAS CONECTADAS AL INVENTARIO
 * ============================================================================
 * Garantiza consistencia atómica:
 * 1. Valida stock disponible de cada producto, cliente y parámetros de pago.
 * 2. Si cualquier validación falla, no descuenta stock ni crea registros parciales.
 * 3. Al confirmar: descuenta stock, registra la venta, crea el cobro si hubo
 *    ingreso de dinero, y genera automáticamente la deuda y cuotas si corresponde.
 */
(function (global) {
  'use strict';

  const { Storage, Validators, Formatters } = global.ComerSys.Core;

  const SalesService = {
    /**
     * Registra una venta completa, parcial o en cuotas de manera atómica.
     */
    createSale(payload) {
      const itemsInput = Array.isArray(payload.items) ? payload.items : [];
      const clientId = payload.clientId ? Number(payload.clientId) : null;
      const paymentMode = payload.paymentMode || 'completo'; // 'completo' | 'parcial' | 'cuotas'
      const paymentMethod = payload.paymentMethod || 'efectivo';
      const discount = Validators.roundCurrency(payload.discount || 0);
      const initialPaymentInput = Validators.roundCurrency(payload.initialPayment || 0);
      const installmentsCount = Math.max(1, parseInt(payload.installmentsCount, 10) || 1);
      const firstDueDate = payload.firstDueDate || Formatters.todayISO();
      const frequency = payload.frequency || 'mensual';
      const date = payload.date || Formatters.todayISO();
      const notes = String(payload.notes || '').trim();

      if (itemsInput.length === 0) {
        throw new Error('Debe seleccionar al menos un producto para registrar la venta.');
      }

      if (!['completo', 'parcial', 'cuotas'].includes(paymentMode)) {
        throw new Error('Modalidad de pago no válida.');
      }

      if ((paymentMode === 'parcial' || paymentMode === 'cuotas') && !clientId) {
        throw new Error(
          'Para ventas con pago parcial o en cuotas es obligatorio seleccionar un cliente registrado.'
        );
      }

      return Storage.transaction((db, storage) => {
        const { DebtsService } = global.ComerSys.Services;

        // 1. Verificar cliente si fue indicado
        let client = null;
        if (clientId) {
          client = db.clients.find((c) => Number(c.id) === clientId);
          if (!client) {
            throw new Error('El cliente seleccionado no existe en el padrón.');
          }
        }

        // 2. Consolidar cantidades por producto y validar stock ANTES de modificar nada
        const aggregatedQty = new Map();
        itemsInput.forEach((line) => {
          const pid = Number(line.productId);
          const qty = Number(line.quantity);
          if (!pid || !Number.isInteger(qty) || qty <= 0) {
            throw new Error('Las cantidades de los productos deben ser números enteros mayores a 0.');
          }
          aggregatedQty.set(pid, (aggregatedQty.get(pid) || 0) + qty);
        });

        const validatedLines = [];
        let subtotal = 0;
        let totalCost = 0;

        for (const [pid, totalQty] of aggregatedQty.entries()) {
          const product = db.products.find((p) => Number(p.id) === pid);
          if (!product) {
            throw new Error(`El producto con ID #${pid} ya no existe en el inventario.`);
          }
          const availableStock = Number(product.stock) || 0;
          if (totalQty > availableStock) {
            throw new Error(
              `Stock insuficiente para "${product.name}" (Código: ${product.code}). Disponible: ${availableStock}, solicitado: ${totalQty}.`
            );
          }

          const unitPrice = Validators.roundCurrency(product.salePrice);
          const unitCost = Validators.roundCurrency(product.purchasePrice);
          const lineSubtotal = Validators.roundCurrency(unitPrice * totalQty);
          const lineCost = Validators.roundCurrency(unitCost * totalQty);
          const lineProfit = Validators.roundCurrency(lineSubtotal - lineCost);

          subtotal = Validators.roundCurrency(subtotal + lineSubtotal);
          totalCost = Validators.roundCurrency(totalCost + lineCost);

          validatedLines.push({
            productRef: product,
            productId: product.id,
            code: product.code,
            name: product.name,
            quantity: totalQty,
            unitCost,
            unitPrice,
            subtotal: lineSubtotal,
            profit: lineProfit
          });
        }

        if (discount < 0 || discount >= subtotal) {
          throw new Error('El descuento no puede ser negativo ni igualar o superar el subtotal de la venta.');
        }

        const total = Validators.roundCurrency(subtotal - discount);
        const estimatedProfit = Validators.roundCurrency(total - totalCost);

        // 3. Validar montos según modalidad de pago
        let paidAmount = 0;
        let pendingAmount = 0;

        if (paymentMode === 'completo') {
          paidAmount = total;
          pendingAmount = 0;
        } else if (paymentMode === 'parcial') {
          if (initialPaymentInput <= 0) {
            throw new Error('En Pago Parcial debe ingresar un importe entregado mayor a $0.');
          }
          if (initialPaymentInput >= total) {
            throw new Error(
              'En Pago Parcial la entrega inicial debe ser menor al total. Si abona todo, elija "Pago completo".'
            );
          }
          paidAmount = initialPaymentInput;
          pendingAmount = Validators.roundCurrency(total - paidAmount);
        } else if (paymentMode === 'cuotas') {
          if (initialPaymentInput < 0 || initialPaymentInput >= total) {
            throw new Error('La entrega inicial debe ser menor al total de la venta.');
          }
          if (installmentsCount < 1 || installmentsCount > 60) {
            throw new Error('La cantidad de cuotas debe estar entre 1 y 60.');
          }
          paidAmount = initialPaymentInput;
          pendingAmount = Validators.roundCurrency(total - paidAmount);
        }

        // 4. Descontar el stock automáticamente (ya validado al 100%)
        const now = new Date().toISOString();
        validatedLines.forEach((line) => {
          line.productRef.stock = Number(line.productRef.stock) - line.quantity;
          line.productRef.updatedAt = now;
        });

        // 5. Crear registro de Venta
        const saleId = storage.nextId('sales');
        const saleItems = validatedLines.map((l) => ({
          productId: l.productId,
          code: l.code,
          name: l.name,
          quantity: l.quantity,
          unitCost: l.unitCost,
          unitPrice: l.unitPrice,
          subtotal: l.subtotal,
          profit: l.profit
        }));

        const summaryConcept = saleItems
          .map((i) => (i.quantity > 1 ? `${i.name} (x${i.quantity})` : i.name))
          .join(', ');

        const saleRecord = {
          id: saleId,
          code: `V-${String(saleId).padStart(4, '0')}`,
          clientId: client ? client.id : null,
          clientName: client ? client.name : 'Consumidor Final',
          items: saleItems,
          summaryConcept,
          subtotal,
          discount,
          total,
          totalCost,
          estimatedProfit,
          paymentMode,
          paymentMethod,
          paidAmount,
          pendingAmount,
          status: pendingAmount <= 0 ? 'pagado' : 'pendiente',
          date,
          notes,
          createdAt: now,
          updatedAt: now
        };

        db.sales.push(saleRecord);

        // 6. Si es Pago Parcial o En Cuotas, generar la Deuda y el Cronograma de Cuotas
        let createdDebt = null;
        if (pendingAmount > 0 && client) {
          const debtResult = DebtsService.createDebtRecordInTx(db, storage, {
            clientId: client.id,
            saleId: saleRecord.id,
            concept: `Venta ${saleRecord.code}: ${summaryConcept}`,
            totalSaleAmount: total,
            initialPayment: paidAmount,
            installmentsCount: paymentMode === 'cuotas' ? installmentsCount : 1,
            firstDueDate,
            frequency: paymentMode === 'cuotas' ? frequency : 'mensual'
          });
          createdDebt = debtResult.debt;
          saleRecord.debtId = createdDebt.id;
        }

        // 7. Si hubo dinero efectivamente cobrado en el acto (Pago completo o Entrega inicial > 0)
        if (paidAmount > 0) {
          const paymentId = storage.nextId('payments');
          const paymentNotes =
            paymentMode === 'completo'
              ? `Pago completo Venta ${saleRecord.code} (${summaryConcept})`
              : `Entrega inicial Venta ${saleRecord.code} (${summaryConcept})`;

          db.payments.push({
            id: paymentId,
            clientId: client ? client.id : null,
            saleId: saleRecord.id,
            debtId: createdDebt ? createdDebt.id : null,
            installmentId: null,
            amount: paidAmount,
            paymentMethod,
            date,
            notes: paymentNotes,
            createdAt: now
          });

          db.movements.push({
            id: storage.nextId('movements'),
            type: 'cobro',
            category: paymentMode === 'completo' ? 'Venta al Contado' : 'Entrega Inicial de Venta',
            direction: 'in',
            amount: paidAmount,
            paymentMethod,
            date,
            description: `${paymentNotes} — Cliente: ${saleRecord.clientName}`,
            referenceType: 'sale',
            referenceId: saleRecord.id,
            createdAt: now
          });
        }

        return saleRecord;
      });
    },

    /**
     * Obtiene todas las ventas con filtros opcionales (búsqueda, modalidad, estado, fecha).
     */
    getSales(filters = {}) {
      const db = Storage.getState();
      const { DebtsService } = global.ComerSys.Services;
      const debtsMap = new Map(DebtsService.getAllDebts().map((d) => [Number(d.saleId), d]));
      const q = Validators.normalizeText(filters.search || '');
      const modeFilter = filters.paymentMode || 'todos';

      return db.sales
        .map((sale) => {
          const linkedDebt = debtsMap.get(Number(sale.id));
          const pendingAmount = linkedDebt
            ? linkedDebt.pendingAmount
            : Validators.roundCurrency(sale.pendingAmount || 0);
          const paidAmount = linkedDebt
            ? Validators.roundCurrency(Number(linkedDebt.initialPayment || 0) + linkedDebt.paidAmount)
            : Validators.roundCurrency(sale.paidAmount || sale.total);
          const computedStatus =
            pendingAmount <= 0.009 ? 'pagado' : linkedDebt ? linkedDebt.status : 'pendiente';

          return Object.assign({}, sale, {
            paidAmount,
            pendingAmount,
            computedStatus
          });
        })
        .filter((s) => {
          if (modeFilter && modeFilter !== 'todos' && s.paymentMode !== modeFilter) return false;
          if (filters.dateFrom && s.date < filters.dateFrom) return false;
          if (filters.dateTo && s.date > filters.dateTo) return false;
          if (!q) return true;
          return (
            Validators.normalizeText(s.code).includes(q) ||
            Validators.normalizeText(s.clientName).includes(q) ||
            Validators.normalizeText(s.summaryConcept).includes(q)
          );
        })
        .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));
    },

    /**
     * Obtiene el detalle completo de una venta por su ID.
     */
    getSaleById(saleId) {
      return this.getSales().find((s) => Number(s.id) === Number(saleId)) || null;
    }
  };

  global.ComerSys.Services.SalesService = SalesService;
})(window);
