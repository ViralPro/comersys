/**
 * ============================================================================
 * COMERSYS — SERVICIO DE CLIENTES Y CUENTA CORRIENTE INDIVIDUAL
 * ============================================================================
 * Gestiona fichas individuales con datos personales, teléfono, dirección,
 * historial de compras, deudas, pagos, cuotas, notas y saldo pendiente.
 * Incluye validación estricta anti-duplicados.
 */
(function (global) {
  'use strict';

  const { Storage, Validators, Formatters } = global.ComerSys.Core;

  const ClientsService = {
    /**
     * Obtiene todos los clientes con sus totales comprados, pagados, saldo pendiente y estado real.
     */
    getClients(filters = {}) {
      const db = Storage.getState();
      const { DebtsService } = global.ComerSys.Services;
      const q = Validators.normalizeText(filters.search || '');
      const statusFilter = filters.status || 'todos';
      const allDebts = DebtsService.getAllDebts();

      return db.clients
        .map((client) => this._buildClientSummary(client, db, allDebts))
        .filter((c) => {
          if (statusFilter && statusFilter !== 'todos') {
            if (statusFilter === 'con_deuda') {
              if (c.pendingBalance <= 0) return false;
            } else if (c.status !== statusFilter) {
              return false;
            }
          }
          if (!q) return true;
          return (
            Validators.normalizeText(c.name).includes(q) ||
            Validators.normalizeText(c.phone || '').includes(q) ||
            Validators.normalizeText(c.address || '').includes(q) ||
            Validators.normalizeText(c.documentId || '').includes(q)
          );
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    },

    /**
     * Obtiene la ficha completa de un cliente por ID incluyendo compras, cuotas, pagos y notas.
     */
    getClientDetail(clientId) {
      const db = Storage.getState();
      const client = db.clients.find((c) => Number(c.id) === Number(clientId));
      if (!client) return null;

      const { DebtsService } = global.ComerSys.Services;
      const clientDebts = DebtsService.getAllDebts({ clientId: client.id });
      const summary = this._buildClientSummary(client, db, clientDebts);

      const sales = db.sales
        .filter((s) => Number(s.clientId) === Number(client.id))
        .map((s) => {
          const linkedDebt = clientDebts.find((d) => Number(d.saleId) === Number(s.id));
          const computedStatus = linkedDebt
            ? linkedDebt.pendingAmount <= 0.009
              ? 'pagado'
              : linkedDebt.status
            : 'pagado';
          return Object.assign({}, s, {
            computedStatus,
            pendingAmount: linkedDebt ? linkedDebt.pendingAmount : 0
          });
        })
        .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));

      const installments = DebtsService.getInstallmentsByClient(client.id);
      const payments = DebtsService.getPayments({ clientId: client.id });

      return Object.assign({}, summary, {
        sales,
        debts: clientDebts,
        installments,
        payments,
        notesList: Array.isArray(client.notesList) ? client.notesList : []
      });
    },

    _buildClientSummary(client, db, preloadedDebts) {
      const clientId = Number(client.id);
      const clientSales = db.sales.filter((s) => Number(s.clientId) === clientId);
      const clientDebts = preloadedDebts.filter((d) => Number(d.clientId) === clientId);
      const clientPayments = db.payments.filter((p) => Number(p.clientId) === clientId);

      // Total comprado: suma de ventas al cliente + deudas independientes (sin saleId)
      const salesSum = clientSales.reduce((acc, s) => acc + Number(s.total || 0), 0);
      const standaloneDebtsSum = clientDebts
        .filter((d) => !d.saleId)
        .reduce((acc, d) => acc + Number(d.originalSaleTotal || d.totalAmount || 0), 0);

      const totalBought = Validators.roundCurrency(salesSum + standaloneDebtsSum);
      const totalPaid = Validators.roundCurrency(
        clientPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0)
      );
      const pendingBalance = Validators.roundCurrency(
        clientDebts.reduce((acc, d) => acc + Number(d.pendingAmount || 0), 0)
      );

      // Estado general del cliente
      let status = 'al_dia';
      if (pendingBalance > 0.009) {
        const hasOverdue = clientDebts.some((d) => d.status === 'atrasado');
        const hasPartial = clientDebts.some((d) => d.status === 'pago_parcial');
        if (hasOverdue) {
          status = 'atrasado';
        } else if (hasPartial) {
          status = 'pago_parcial';
        } else {
          status = 'pendiente';
        }
      } else if (clientDebts.length > 0 && clientDebts.every((d) => d.status === 'cancelado')) {
        status = 'cancelado';
      }

      return Object.assign({}, client, {
        totalBought,
        totalPaid,
        pendingBalance,
        status,
        salesCount: clientSales.length,
        activeDebtsCount: clientDebts.filter((d) => d.pendingAmount > 0.009).length
      });
    },

    /**
     * Crea un cliente validando duplicados por nombre completo, documento o teléfono.
     */
    createClient(payload) {
      const name = String(payload.name || '').trim();
      const documentId = String(payload.documentId || '').trim();
      const phone = String(payload.phone || '').trim();
      const address = String(payload.address || '').trim();
      const email = String(payload.email || '').trim();
      const notes = String(payload.notes || '').trim();

      if (!name) throw new Error('Ingrese el nombre completo del cliente.');
      if (!phone) throw new Error('Ingrese el teléfono de contacto del cliente.');

      return Storage.transaction((db, storage) => {
        this._assertNoDuplicateClient(db.clients, { name, documentId, phone }, null);

        const now = new Date().toISOString();
        const notesList = [];
        if (notes) {
          notesList.push({
            id: 1,
            text: notes,
            date: Formatters.todayISO(),
            createdAt: now
          });
        }

        const newClient = {
          id: storage.nextId('clients'),
          name,
          documentId,
          phone,
          address: address || 'Sin especificar',
          email,
          notes,
          notesList,
          createdAt: now,
          updatedAt: now
        };

        db.clients.push(newClient);
        return newClient;
      });
    },

    /**
     * Actualiza los datos personales de un cliente verificando que no duplique a otro.
     */
    updateClient(clientId, payload) {
      const name = String(payload.name || '').trim();
      const documentId = String(payload.documentId || '').trim();
      const phone = String(payload.phone || '').trim();
      const address = String(payload.address || '').trim();
      const email = String(payload.email || '').trim();

      if (!name) throw new Error('El nombre del cliente es obligatorio.');
      if (!phone) throw new Error('El teléfono del cliente es obligatorio.');

      return Storage.transaction((db) => {
        const client = db.clients.find((c) => Number(c.id) === Number(clientId));
        if (!client) throw new Error('Cliente no encontrado.');

        this._assertNoDuplicateClient(db.clients, { name, documentId, phone }, Number(clientId));

        client.name = name;
        client.documentId = documentId;
        client.phone = phone;
        client.address = address || 'Sin especificar';
        client.email = email;
        client.updatedAt = new Date().toISOString();

        return client;
      });
    },

    /**
     * Agrega una nota u observación a la ficha del cliente.
     */
    addClientNote(clientId, noteText) {
      const clean = String(noteText || '').trim();
      if (!clean) throw new Error('Escriba el contenido de la nota antes de guardar.');

      return Storage.transaction((db) => {
        const client = db.clients.find((c) => Number(c.id) === Number(clientId));
        if (!client) throw new Error('Cliente no encontrado.');

        if (!Array.isArray(client.notesList)) {
          client.notesList = [];
        }

        const noteObj = {
          id: Date.now(),
          text: clean,
          date: Formatters.todayISO(),
          createdAt: new Date().toISOString()
        };

        client.notesList.unshift(noteObj);
        client.notes = clean;
        client.updatedAt = new Date().toISOString();
        return noteObj;
      });
    },

    /**
     * Elimina una nota de la ficha del cliente.
     */
    deleteClientNote(clientId, noteId) {
      return Storage.transaction((db) => {
        const client = db.clients.find((c) => Number(c.id) === Number(clientId));
        if (!client || !Array.isArray(client.notesList)) return false;
        client.notesList = client.notesList.filter((n) => Number(n.id) !== Number(noteId));
        return true;
      });
    },

    /**
     * Elimina un cliente solo si no registra saldo pendiente activo.
     */
    deleteClient(clientId) {
      const detail = this.getClientDetail(clientId);
      if (!detail) throw new Error('El cliente no existe.');
      if (detail.pendingBalance > 0.009) {
        throw new Error(
          `No se puede eliminar a "${detail.name}" porque tiene un saldo pendiente de ${Formatters.currency(detail.pendingBalance)}.`
        );
      }

      return Storage.transaction((db) => {
        const idx = db.clients.findIndex((c) => Number(c.id) === Number(clientId));
        if (idx === -1) throw new Error('El cliente no existe.');
        return db.clients.splice(idx, 1)[0];
      });
    },

    _assertNoDuplicateClient(clients, { name, documentId, phone }, excludeId = null) {
      const normName = Validators.normalizeText(name);
      const normDoc = Validators.normalizeIdentifier(documentId);
      const normPhone = Validators.normalizeIdentifier(phone);

      for (const existing of clients) {
        if (excludeId !== null && Number(existing.id) === Number(excludeId)) continue;

        if (normDoc && Validators.normalizeIdentifier(existing.documentId) === normDoc) {
          throw new Error(
            `Ya existe un cliente registrado con el documento "${documentId}" (${existing.name}).`
          );
        }
        if (normName && Validators.normalizeText(existing.name) === normName) {
          throw new Error(`Ya existe un cliente registrado con el nombre "${existing.name}".`);
        }
        if (normPhone && normPhone.length >= 6 && Validators.normalizeIdentifier(existing.phone) === normPhone) {
          throw new Error(
            `El teléfono "${phone}" ya pertenece al cliente "${existing.name}". Evite duplicar fichas.`
          );
        }
      }
    }
  };

  global.ComerSys.Services.ClientsService = ClientsService;
})(window);
