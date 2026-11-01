/**
 * ============================================================================
 * COMERSYS — MÓDULOS 7 Y 8: CUOTAS Y DEUDAS + REGISTRO DE PAGOS
 * ============================================================================
 * - Sistema completo de financiación con generación automática de cuotas.
 * - Registra vencimientos, pagos parciales y pagos completos.
 * - Actualiza los saldos automáticamente.
 * - Distingue estados: Al día, Pendiente, Pago parcial, Atrasado, Cancelado.
 */
(function (global) {
  'use strict';

  const { Config } = global.ComerSys;
  const { Validators, Formatters } = global.ComerSys.Core;
  const { DebtsService, ClientsService } = global.ComerSys.Services;
  const { Icons, Components } = global.ComerSys.UI;

  const DebtsModule = {
    state: {
      search: '',
      statusFilter: 'todos',
      activeViewTab: 'cuentas', // 'cuentas' | 'pagos'
      currentPage: 1,
      pageSize: 8
    },

    render(container) {
      const debts = DebtsService.getAllDebts({
        search: this.state.search,
        status: this.state.statusFilter
      });

      const allPayments = DebtsService.getPayments();
      const activeDebtsCount = DebtsService.getAllDebts().filter((d) => d.pendingAmount > 0.009).length;

      const pagination = Components.renderPagination(
        this.state.activeViewTab === 'cuentas' ? debts.length : allPayments.length,
        this.state.currentPage,
        this.state.pageSize
      );
      this.state.currentPage = pagination.safePage;

      const pageDebts = debts.slice(pagination.startIdx, pagination.endIdx);
      const pagePayments = allPayments.slice(pagination.startIdx, pagination.endIdx);

      container.innerHTML = `
        <div class="page-header">
          <div class="page-header-titles">
            <h1>Cuotas y Deudas</h1>
            <p>Control de cuentas financiadas, vencimientos, pagos parciales y cobros</p>
          </div>
          <div class="page-header-actions">
            <button type="button" class="btn btn-secondary" id="debts-register-payment-top-btn" ${activeDebtsCount === 0 ? 'disabled' : ''}>
              ${Icons.get('wallet')} Registrar Pago
            </button>
            <button type="button" class="btn btn-primary" id="debts-new-account-btn">
              ${Icons.get('plus')} Nueva Cuenta
            </button>
          </div>
        </div>

        <div class="card">
          <div class="toolbar-row">
            <div class="search-box">
              ${Icons.get('search')}
              <input
                type="search"
                id="debts-search-input"
                placeholder="Buscar cliente o concepto..."
                value="${Validators.escapeHtml(this.state.search)}"
              />
            </div>

            <div class="toolbar-filters">
              <div class="segmented-control">
                <button
                  type="button"
                  class="segmented-btn ${this.state.activeViewTab === 'cuentas' ? 'active' : ''}"
                  data-switch-tab="cuentas"
                >
                  Cuentas y Cuotas (${debts.length})
                </button>
                <button
                  type="button"
                  class="segmented-btn ${this.state.activeViewTab === 'pagos' ? 'active' : ''}"
                  data-switch-tab="pagos"
                >
                  Historial de Pagos (${allPayments.length})
                </button>
              </div>

              ${
                this.state.activeViewTab === 'cuentas'
                  ? `
                <select class="form-control" id="debts-status-filter" style="width:auto;min-width:135px;">
                  <option value="todos" ${this.state.statusFilter === 'todos' ? 'selected' : ''}>Todos los estados</option>
                  <option value="al_dia" ${this.state.statusFilter === 'al_dia' ? 'selected' : ''}>Al día</option>
                  <option value="pendiente" ${this.state.statusFilter === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                  <option value="pago_parcial" ${this.state.statusFilter === 'pago_parcial' ? 'selected' : ''}>Pago parcial</option>
                  <option value="atrasado" ${this.state.statusFilter === 'atrasado' ? 'selected' : ''}>Atrasado</option>
                  <option value="cancelado" ${this.state.statusFilter === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                </select>
              `
                  : ''
              }
            </div>
          </div>

          <div class="table-responsive">
            ${
              this.state.activeViewTab === 'cuentas'
                ? this._renderDebtsTable(pageDebts)
                : this._renderPaymentsTable(pagePayments)
            }
          </div>

          ${pagination.html}
        </div>
      `;

      // Búsqueda
      const searchInput = container.querySelector('#debts-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.state.search = e.target.value;
          this.state.currentPage = 1;
          this.render(container);
          const refocused = container.querySelector('#debts-search-input');
          if (refocused) {
            refocused.focus();
            refocused.setSelectionRange(refocused.value.length, refocused.value.length);
          }
        });
      }

      // Alternar entre Cuentas y Pagos
      container.querySelectorAll('[data-switch-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.state.activeViewTab = btn.getAttribute('data-switch-tab');
          this.state.currentPage = 1;
          this.render(container);
        });
      });

      // Filtro por estado
      const statusSelect = container.querySelector('#debts-status-filter');
      if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
          this.state.statusFilter = e.target.value;
          this.state.currentPage = 1;
          this.render(container);
        });
      }

      // Botón superior Registrar Pago
      const regPayBtn = container.querySelector('#debts-register-payment-top-btn');
      if (regPayBtn) {
        regPayBtn.addEventListener('click', () =>
          this.openRegisterPaymentModal({}, () => this.render(container))
        );
      }

      // Botón Nueva Cuenta
      const newAccBtn = container.querySelector('#debts-new-account-btn');
      if (newAccBtn) {
        newAccBtn.addEventListener('click', () =>
          this.openNewAccountModal(() => this.render(container))
        );
      }

      const emptyNewAccBtn = container.querySelector('#debts-empty-new-btn');
      if (emptyNewAccBtn) {
        emptyNewAccBtn.addEventListener('click', () =>
          this.openNewAccountModal(() => this.render(container))
        );
      }

      // Paginación
      container.querySelectorAll('[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.state.currentPage = Number(btn.getAttribute('data-page'));
          this.render(container);
        });
      });

      // Ver cronograma de cuotas al hacer clic en fila o botón
      container.querySelectorAll('[data-open-debt]').forEach((row) => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('[data-stop-row]')) return;
          const debtId = Number(row.getAttribute('data-open-debt'));
          this.openDebtScheduleModal(debtId, () => this.render(container));
        });
      });

      container.querySelectorAll('[data-view-schedule]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const debtId = Number(btn.getAttribute('data-view-schedule'));
          this.openDebtScheduleModal(debtId, () => this.render(container));
        });
      });

      // Registrar pago sobre una deuda específica
      container.querySelectorAll('[data-pay-debt]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const debtId = Number(btn.getAttribute('data-pay-debt'));
          const clientId = Number(btn.getAttribute('data-client-id'));
          this.openRegisterPaymentModal({ clientId, debtId }, () => this.render(container));
        });
      });
    },

    _renderDebtsTable(pageDebts) {
      if (pageDebts.length === 0) {
        return `
          <div class="empty-state">
            <div class="empty-state-icon">${Icons.get('debts')}</div>
            <div class="empty-state-title">No hay cuentas financiadas ni deudas para mostrar</div>
            <p class="empty-state-desc">
              Las cuentas se generan automáticamente al registrar una venta con pago parcial o en cuotas, o puedes crear una nueva cuenta financiada manualmente.
            </p>
            <button type="button" class="btn btn-primary" id="debts-empty-new-btn">
              ${Icons.get('plus')} Nueva Cuenta
            </button>
          </div>
        `;
      }

      return `
        <table class="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Concepto / Plan</th>
              <th class="text-right">Total</th>
              <th class="text-right">Pagado</th>
              <th class="text-right">Pendiente</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${pageDebts
              .map(
                (d) => `
              <tr style="cursor:pointer;" data-open-debt="${d.id}">
                <td class="font-semibold">${Validators.escapeHtml(d.clientName)}</td>
                <td>
                  <div style="font-size:0.85rem;font-weight:600;">${Validators.escapeHtml(d.concept)}</div>
                  <div class="text-muted" style="font-size:0.75rem;">
                    ${d.paidInstallmentsCount}/${d.installmentsCount} cuota(s) completada(s)
                  </div>
                </td>
                <td class="text-right font-semibold">${Formatters.currency(d.operationTotal)}</td>
                <td class="text-right text-success font-semibold">${Formatters.currency(d.operationPaid)}</td>
                <td class="text-right font-bold ${d.pendingAmount > 0.009 ? 'text-danger' : 'text-muted'}">
                  ${Formatters.currency(d.pendingAmount)}
                </td>
                <td class="text-muted">${Formatters.date(d.nextDueDate)}</td>
                <td>${Formatters.statusBadge(d.status)}</td>
                <td class="text-right" data-stop-row>
                  <div class="action-btn-group">
                    <button
                      type="button"
                      class="icon-action-btn primary"
                      data-view-schedule="${d.id}"
                      title="Ver cronograma de cuotas"
                    >
                      ${Icons.get('calendar')}
                    </button>
                    ${
                      d.pendingAmount > 0.009
                        ? `<button
                            type="button"
                            class="btn btn-sm btn-primary"
                            data-pay-debt="${d.id}"
                            data-client-id="${d.clientId}"
                          >
                            Cobrar
                          </button>`
                        : ''
                    }
                  </div>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `;
    },

    _renderPaymentsTable(pagePayments) {
      if (pagePayments.length === 0) {
        return `
          <div class="empty-state">
            <div class="empty-state-icon">${Icons.get('wallet')}</div>
            <div class="empty-state-title">Sin pagos registrados</div>
            <p class="empty-state-desc">Aquí se listarán todos los cobros recibidos por ventas, entregas y cuotas.</p>
          </div>
        `;
      }

      return `
        <table class="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Detalle / Concepto</th>
              <th>Método de pago</th>
              <th class="text-right">Importe cobrado</th>
            </tr>
          </thead>
          <tbody>
            ${pagePayments
              .map(
                (p) => `
              <tr>
                <td class="text-muted">${Formatters.date(p.date)}</td>
                <td class="font-semibold">${Validators.escapeHtml(p.clientName)}</td>
                <td>${Validators.escapeHtml(p.notes)}</td>
                <td style="text-transform:capitalize;">${Validators.escapeHtml(p.paymentMethod)}</td>
                <td class="text-right font-bold text-success">${Formatters.currency(p.amount)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `;
    },

    /**
     * Modal: "Registrar pago" (Diseño exacto de la esquina inferior derecha de la referencia).
     * Permite elegir Cliente -> Deuda/Cuota -> Importe del pago (completo o parcial) -> Método -> Fecha.
     */
    openRegisterPaymentModal(preselect = {}, onSuccess = null) {
      const activeDebts = DebtsService.getAllDebts().filter((d) => d.pendingAmount > 0.009);
      if (activeDebts.length === 0) {
        Components.toast('No existen deudas pendientes de cobro en este momento.', 'info');
        return;
      }

      // Clientes que tienen al menos una deuda activa
      const clientIdsWithDebt = Array.from(new Set(activeDebts.map((d) => Number(d.clientId))));
      const clients = ClientsService.getClients().filter((c) =>
        clientIdsWithDebt.includes(Number(c.id))
      );

      let selectedClientId = preselect.clientId
        ? Number(preselect.clientId)
        : clients[0]
        ? Number(clients[0].id)
        : null;

      Components.openModal({
        size: 'sm',
        headerHtml: `
          <div class="modal-title-group">
            <button type="button" class="icon-action-btn" data-modal-close title="Volver">
              ${Icons.get('arrowLeft')}
            </button>
            <h3 class="modal-title">Registrar pago</h3>
          </div>
          <button type="button" class="modal-close-btn" data-modal-close aria-label="Cerrar">
            ${Icons.get('close')}
          </button>
        `,
        bodyHtml: `
          <form id="register-payment-form" novalidate>
            <div class="form-group">
              <label class="form-label">Cliente</label>
              <select class="form-control" id="pay-client-select" required>
                ${clients
                  .map(
                    (c) =>
                      `<option value="${c.id}" ${Number(c.id) === selectedClientId ? 'selected' : ''}>
                        ${Validators.escapeHtml(c.name)} (Saldo: ${Formatters.currency(c.pendingBalance)})
                      </option>`
                  )
                  .join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Deuda / Cuota a imputar</label>
              <select class="form-control" id="pay-target-select" required></select>
            </div>

            <div class="form-group">
              <label class="form-label">
                <span>Importe del pago</span>
                <span class="text-muted" id="pay-max-hint" style="font-weight:500;font-size:0.75rem;"></span>
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                class="form-control font-bold"
                id="pay-amount-input"
                required
              />
              <span class="form-hint">Puede ingresar el total de la cuota, un pago parcial o adelantar saldo.</span>
            </div>

            <div class="form-group">
              <label class="form-label">Método de pago</label>
              <select class="form-control" id="pay-method-select">
                ${Config.PAYMENT_METHODS.map(
                  (m) => `<option value="${m.id}">${Validators.escapeHtml(m.label)}</option>`
                ).join('')}
              </select>
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">Fecha</label>
              <input
                type="date"
                class="form-control"
                id="pay-date-input"
                value="${Formatters.todayISO()}"
                required
              />
            </div>
          </form>
        `,
        footerHtml: `
          <button type="button" class="btn btn-primary btn-block btn-lg" id="pay-confirm-submit-btn">
            Confirmar Pago
          </button>
        `,
        onMount(modalEl, close) {
          const clientSelect = modalEl.querySelector('#pay-client-select');
          const targetSelect = modalEl.querySelector('#pay-target-select');
          const amountInput = modalEl.querySelector('#pay-amount-input');
          const maxHint = modalEl.querySelector('#pay-max-hint');
          const methodSelect = modalEl.querySelector('#pay-method-select');
          const dateInput = modalEl.querySelector('#pay-date-input');
          const confirmBtn = modalEl.querySelector('#pay-confirm-submit-btn');
          const form = modalEl.querySelector('#register-payment-form');

          const populateTargetsForClient = (cid) => {
            const clientDebts = activeDebts.filter((d) => Number(d.clientId) === Number(cid));
            let optionsHtml = '';

            clientDebts.forEach((debt) => {
              const openInst = debt.installments.filter((i) => i.pendingAmount > 0.009);
              openInst.forEach((inst) => {
                const isPreselected =
                  Number(preselect.installmentId) === Number(inst.id) ||
                  (!preselect.installmentId &&
                    Number(preselect.debtId) === Number(debt.id) &&
                    inst === openInst[0]);

                optionsHtml += `
                  <option
                    value="inst:${debt.id}:${inst.id}"
                    data-suggested="${inst.pendingAmount}"
                    data-max="${debt.pendingAmount}"
                    ${isPreselected ? 'selected' : ''}
                  >
                    Cuota #${inst.number} - ${Formatters.currency(inst.pendingAmount)} (Venc. ${Formatters.date(inst.dueDate)}) — ${Validators.escapeHtml(debt.concept)}
                  </option>
                `;
              });

              if (openInst.length > 1) {
                optionsHtml += `
                  <option
                    value="debt:${debt.id}:0"
                    data-suggested="${debt.pendingAmount}"
                    data-max="${debt.pendingAmount}"
                  >
                    Cancelar saldo total cuenta (${Formatters.currency(debt.pendingAmount)}) — ${Validators.escapeHtml(debt.concept)}
                  </option>
                `;
              }
            });

            targetSelect.innerHTML = optionsHtml;
            syncSuggestedAmount();
          };

          const syncSuggestedAmount = () => {
            const opt = targetSelect.options[targetSelect.selectedIndex];
            if (!opt) return;
            const suggested = Number(opt.getAttribute('data-suggested')) || 0;
            const maxAllowed = Number(opt.getAttribute('data-max')) || suggested;
            amountInput.value = suggested;
            amountInput.max = maxAllowed;
            maxHint.textContent = `Máx. cuenta: ${Formatters.currency(maxAllowed)}`;
          };

          clientSelect.addEventListener('change', () => {
            selectedClientId = Number(clientSelect.value);
            populateTargetsForClient(selectedClientId);
          });

          targetSelect.addEventListener('change', syncSuggestedAmount);

          populateTargetsForClient(selectedClientId);

          const submit = (e) => {
            if (e) e.preventDefault();
            try {
              const rawTarget = targetSelect.value || '';
              const parts = rawTarget.split(':');
              const debtId = Number(parts[1]);
              const installmentId = Number(parts[2]) || null;

              const payment = DebtsService.registerPayment({
                clientId: Number(clientSelect.value),
                debtId,
                installmentId,
                amount: Number(amountInput.value),
                paymentMethod: methodSelect.value,
                date: dateInput.value
              });

              Components.toast(
                `Pago de ${Formatters.currency(payment.amount)} registrado. Saldos actualizados.`
              );
              close();
              if (typeof onSuccess === 'function') onSuccess(payment);
              global.ComerSys.App.refreshCurrentView();
            } catch (err) {
              Components.toast(err.message, 'error');
            }
          };

          confirmBtn.addEventListener('click', submit);
          form.addEventListener('submit', submit);
        }
      });
    },

    /**
     * Modal: Ver Cronograma Completo de Cuotas de una Deuda.
     */
    openDebtScheduleModal(debtId, onUpdated = null) {
      const self = this;

      Components.openModal({
        size: 'lg',
        title: 'Detalle de Cuenta y Cronograma de Cuotas',
        bodyHtml: `<div id="debt-schedule-modal-body"></div>`,
        footerHtml: `<button type="button" class="btn btn-secondary" data-modal-close>Cerrar</button>`,
        onMount(modalEl, close) {
          const container = modalEl.querySelector('#debt-schedule-modal-body');

          const renderSchedule = () => {
            const debt = DebtsService.getDebtById(debtId);
            if (!debt) {
              close();
              return;
            }

            container.innerHTML = `
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1.15rem;">
                <div>
                  <h4 style="font-size:1.08rem;">${Validators.escapeHtml(debt.clientName)}</h4>
                  <p class="text-muted" style="font-size:0.84rem;">${Validators.escapeHtml(debt.concept)}</p>
                </div>
                <div style="display:flex;align-items:center;gap:0.85rem;">
                  ${Formatters.statusBadge(debt.status)}
                  ${
                    debt.pendingAmount > 0.009
                      ? `<button type="button" class="btn btn-sm btn-primary" id="sched-pay-btn">
                          ${Icons.get('wallet')} Registrar Pago
                        </button>`
                      : ''
                  }
                </div>
              </div>

              <div class="client-kpis-3">
                <div class="client-kpi-box">
                  <div class="client-kpi-label">Total Financiado</div>
                  <div class="client-kpi-val">${Formatters.currency(debt.totalAmount)}</div>
                </div>
                <div class="client-kpi-box">
                  <div class="client-kpi-label">Pagado en Cuotas</div>
                  <div class="client-kpi-val text-success">${Formatters.currency(debt.paidAmount)}</div>
                </div>
                <div class="client-kpi-box ${debt.pendingAmount > 0.009 ? 'danger-highlight' : ''}">
                  <div class="client-kpi-label">Saldo Pendiente</div>
                  <div class="client-kpi-val">${Formatters.currency(debt.pendingAmount)}</div>
                </div>
              </div>

              <div class="table-responsive" style="border:1px solid var(--border-color);border-radius:var(--radius-sm);">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Cuota</th>
                      <th>Vencimiento</th>
                      <th class="text-right">Valor Cuota</th>
                      <th class="text-right">Abonado</th>
                      <th class="text-right">Saldo Cuota</th>
                      <th>Estado</th>
                      <th class="text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${debt.installments
                      .map(
                        (inst) => `
                      <tr>
                        <td class="font-semibold">Cuota #${inst.number} de ${inst.totalInstallments || debt.installmentsCount || (debt.installments ? debt.installments.length : 1)}</td>
                        <td>${Formatters.date(inst.dueDate)}</td>
                        <td class="text-right">${Formatters.currency(inst.amount)}</td>
                        <td class="text-right text-success font-semibold">${Formatters.currency(inst.paidAmount)}</td>
                        <td class="text-right font-bold ${inst.pendingAmount > 0.009 ? 'text-danger' : 'text-muted'}">
                          ${Formatters.currency(inst.pendingAmount)}
                        </td>
                        <td>${Formatters.statusBadge(inst.status)}</td>
                        <td class="text-right">
                          ${
                            inst.pendingAmount > 0.009
                              ? `<button type="button" class="btn btn-sm btn-primary" data-pay-inst="${inst.id}">
                                  Cobrar
                                </button>`
                              : `<span class="text-muted" style="font-size:0.78rem;">Cancelada</span>`
                          }
                        </td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `;

            const topPayBtn = container.querySelector('#sched-pay-btn');
            if (topPayBtn) {
              topPayBtn.addEventListener('click', () => {
                self.openRegisterPaymentModal({ clientId: debt.clientId, debtId: debt.id }, () => {
                  renderSchedule();
                  if (typeof onUpdated === 'function') onUpdated();
                });
              });
            }

            container.querySelectorAll('[data-pay-inst]').forEach((btn) => {
              btn.addEventListener('click', () => {
                const instId = Number(btn.getAttribute('data-pay-inst'));
                self.openRegisterPaymentModal(
                  { clientId: debt.clientId, debtId: debt.id, installmentId: instId },
                  () => {
                    renderSchedule();
                    if (typeof onUpdated === 'function') onUpdated();
                  }
                );
              });
            });
          };

          renderSchedule();
        }
      });
    },

    /**
     * Modal: Crear Nueva Cuenta / Financiación manual para un cliente.
     */
    openNewAccountModal(onSuccess = null) {
      const clients = ClientsService.getClients();
      if (clients.length === 0) {
        Components.toast('Primero registre un cliente para asignarle una cuenta financiada.', 'warning');
        global.ComerSys.Modules.Clients.openClientFormModal(null, () => {
          this.openNewAccountModal(onSuccess);
        });
        return;
      }

      const defaultDue = Formatters.addInstallmentPeriod(Formatters.todayISO(), 1, 'mensual');

      Components.openModal({
        title: 'Nueva Cuenta / Plan de Cuotas',
        size: 'md',
        bodyHtml: `
          <form id="new-account-form" novalidate>
            <div class="form-grid">
              <div class="form-group full-width">
                <label class="form-label">Cliente <span class="required">*</span></label>
                <select class="form-control" id="acc-client-select" required>
                  ${clients
                    .map(
                      (c) => `<option value="${c.id}">${Validators.escapeHtml(c.name)} (${Validators.escapeHtml(c.phone)})</option>`
                    )
                    .join('')}
                </select>
              </div>
              <div class="form-group full-width">
                <label class="form-label">Concepto / Descripción <span class="required">*</span></label>
                <input
                  type="text"
                  class="form-control"
                  id="acc-concept-input"
                  placeholder="Ej. Financiación de equipos, Saldo cuenta corriente..."
                  required
                />
              </div>
              <div class="form-group">
                <label class="form-label">Importe Total ($) <span class="required">*</span></label>
                <input type="number" min="1" step="0.01" class="form-control" id="acc-total-input" placeholder="0.00" required />
              </div>
              <div class="form-group">
                <label class="form-label">Entrega inicial ($)</label>
                <input type="number" min="0" step="0.01" class="form-control" id="acc-initial-input" value="0" />
              </div>
              <div class="form-group">
                <label class="form-label">Cantidad de cuotas <span class="required">*</span></label>
                <input type="number" min="1" max="60" step="1" class="form-control" id="acc-count-input" value="3" required />
              </div>
              <div class="form-group">
                <label class="form-label">Frecuencia</label>
                <select class="form-control" id="acc-freq-select">
                  ${Config.INSTALLMENT_FREQUENCIES.map(
                    (f) => `<option value="${f.id}">${f.label}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Primer vencimiento</label>
                <input type="date" class="form-control" id="acc-due-input" value="${defaultDue}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Valor estimado por cuota</label>
                <input type="text" class="form-control font-bold" id="acc-preview-input" readonly style="background:var(--bg-surface-muted);" value="$0" />
              </div>
            </div>
          </form>
        `,
        footerHtml: `
          <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
          <button type="button" class="btn btn-primary" id="acc-save-btn">Generar Cuenta y Cuotas</button>
        `,
        onMount(modalEl, close) {
          const clientSelect = modalEl.querySelector('#acc-client-select');
          const conceptInput = modalEl.querySelector('#acc-concept-input');
          const totalInput = modalEl.querySelector('#acc-total-input');
          const initialInput = modalEl.querySelector('#acc-initial-input');
          const countInput = modalEl.querySelector('#acc-count-input');
          const freqSelect = modalEl.querySelector('#acc-freq-select');
          const dueInput = modalEl.querySelector('#acc-due-input');
          const previewInput = modalEl.querySelector('#acc-preview-input');
          const saveBtn = modalEl.querySelector('#acc-save-btn');
          const form = modalEl.querySelector('#new-account-form');

          const updatePreview = () => {
            const total = Number(totalInput.value) || 0;
            const init = Number(initialInput.value) || 0;
            const count = Math.max(1, parseInt(countInput.value, 10) || 1);
            const financed = Math.max(0, total - init);
            const each = Validators.roundCurrency(financed / count);
            previewInput.value = `${count} x ${Formatters.currency(each)}`;
          };

          totalInput.addEventListener('input', updatePreview);
          initialInput.addEventListener('input', updatePreview);
          countInput.addEventListener('input', updatePreview);

          const submit = (e) => {
            if (e) e.preventDefault();
            try {
              const created = DebtsService.createStandaloneDebt({
                clientId: Number(clientSelect.value),
                concept: conceptInput.value,
                totalAmount: Number(totalInput.value),
                initialPayment: Number(initialInput.value),
                installmentsCount: Number(countInput.value),
                frequency: freqSelect.value,
                firstDueDate: dueInput.value
              });
              Components.toast(`Cuenta creada con ${created.installmentsCount} cuota(s).`);
              close();
              if (typeof onSuccess === 'function') onSuccess(created);
              global.ComerSys.App.refreshHeaderIndicators();
            } catch (err) {
              Components.toast(err.message, 'error');
            }
          };

          saveBtn.addEventListener('click', submit);
          form.addEventListener('submit', submit);
        }
      });
    }
  };

  global.ComerSys.Modules.Debts = DebtsModule;
})(window);
