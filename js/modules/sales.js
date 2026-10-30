/**
 * ============================================================================
 * COMERSYS — MÓDULO 5: VENTAS CONECTADAS AL INVENTARIO Y ASISTENTE 4 PASOS
 * ============================================================================
 * - Historial de ventas y comprobantes.
 * - Asistente de Venta profesional en 4 pasos (1 Productos -> 2 Cliente ->
 *   3 Pago/Cuotas -> 4 Confirmar) idéntico a la referencia visual.
 * - Soporta Pago completo, Pago parcial y Financiación en cuotas.
 * - Descuenta el stock automáticamente de forma atómica al confirmar.
 */
(function (global) {
  'use strict';

  const { Config } = global.ComerSys;
  const { Validators, Formatters } = global.ComerSys.Core;
  const { SalesService, InventoryService, ClientsService } = global.ComerSys.Services;
  const { Icons, Components } = global.ComerSys.UI;

  const SalesModule = {
    state: {
      search: '',
      modeFilter: 'todos',
      currentPage: 1,
      pageSize: 8
    },

    render(container) {
      const sales = SalesService.getSales({
        search: this.state.search,
        paymentMode: this.state.modeFilter
      });

      const pagination = Components.renderPagination(
        sales.length,
        this.state.currentPage,
        this.state.pageSize
      );
      this.state.currentPage = pagination.safePage;
      const pageItems = sales.slice(pagination.startIdx, pagination.endIdx);

      const modeLabels = {
        completo: 'Pago completo',
        parcial: 'Pago parcial',
        cuotas: 'En cuotas'
      };

      container.innerHTML = `
        <div class="page-header">
          <div class="page-header-titles">
            <h1>Ventas</h1>
            <p>Operaciones comerciales conectadas al inventario y cuentas corrientes</p>
          </div>
          <div class="page-header-actions">
            <button type="button" class="btn btn-primary" id="sales-new-btn">
              ${Icons.get('plus')} Nueva Venta
            </button>
          </div>
        </div>

        <div class="card">
          <div class="toolbar-row">
            <div class="search-box">
              ${Icons.get('search')}
              <input
                type="search"
                id="sales-search-input"
                placeholder="Buscar por cliente, producto o código de venta..."
                value="${Validators.escapeHtml(this.state.search)}"
              />
            </div>
            <div class="toolbar-filters">
              <select class="form-control" id="sales-mode-filter" style="width:auto;min-width:145px;">
                <option value="todos" ${this.state.modeFilter === 'todos' ? 'selected' : ''}>Todas las modalidades</option>
                <option value="completo" ${this.state.modeFilter === 'completo' ? 'selected' : ''}>Pago completo</option>
                <option value="parcial" ${this.state.modeFilter === 'parcial' ? 'selected' : ''}>Pago parcial</option>
                <option value="cuotas" ${this.state.modeFilter === 'cuotas' ? 'selected' : ''}>En cuotas</option>
              </select>
            </div>
          </div>

          <div class="table-responsive">
            ${
              pageItems.length === 0
                ? `
                  <div class="empty-state">
                    <div class="empty-state-icon">${Icons.get('sales')}</div>
                    <div class="empty-state-title">
                      ${
                        this.state.search || this.state.modeFilter !== 'todos'
                          ? 'No se encontraron ventas con esos criterios'
                          : 'Aún no se han registrado ventas'
                      }
                    </div>
                    <p class="empty-state-desc">
                      Al confirmar una venta, el sistema descuenta automáticamente el stock, registra el cobro y genera las cuotas si corresponde.
                    </p>
                    <button type="button" class="btn btn-primary" id="sales-empty-new-btn">
                      ${Icons.get('plus')} Registrar primera venta
                    </button>
                  </div>
                `
                : `
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Operación</th>
                        <th>Cliente</th>
                        <th>Productos</th>
                        <th>Modalidad</th>
                        <th class="text-right">Total</th>
                        <th class="text-right">Cobrado</th>
                        <th class="text-right">Pendiente</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                        <th class="text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${pageItems
                        .map(
                          (s) => `
                        <tr style="cursor:pointer;" data-open-sale="${s.id}">
                          <td class="font-mono font-semibold" style="font-size:0.82rem;">${Validators.escapeHtml(s.code)}</td>
                          <td class="font-semibold">${Validators.escapeHtml(s.clientName)}</td>
                          <td class="text-muted" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                            ${Validators.escapeHtml(s.summaryConcept)}
                          </td>
                          <td>${Validators.escapeHtml(modeLabels[s.paymentMode] || s.paymentMode)}</td>
                          <td class="text-right font-bold">${Formatters.currency(s.total)}</td>
                          <td class="text-right text-success font-semibold">${Formatters.currency(s.paidAmount)}</td>
                          <td class="text-right ${s.pendingAmount > 0.009 ? 'text-danger font-bold' : 'text-muted'}">
                            ${Formatters.currency(s.pendingAmount)}
                          </td>
                          <td>${Formatters.statusBadge(s.computedStatus)}</td>
                          <td class="text-muted">${Formatters.date(s.date)}</td>
                          <td class="text-right" data-stop-row>
                            <div class="action-btn-group">
                              <button type="button" class="icon-action-btn primary" data-view-sale="${s.id}" title="Ver detalle de venta">
                                ${Icons.get('eye')}
                              </button>
                              ${
                                s.pendingAmount > 0.009 && s.debtId
                                  ? `<button type="button" class="icon-action-btn success" data-pay-sale-debt="${s.debtId}" data-client-id="${s.clientId}" title="Registrar pago sobre esta venta">
                                      ${Icons.get('wallet')}
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
                `
            }
          </div>

          ${pagination.html}
        </div>
      `;

      const searchInput = container.querySelector('#sales-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.state.search = e.target.value;
          this.state.currentPage = 1;
          this.render(container);
          const refocused = container.querySelector('#sales-search-input');
          if (refocused) {
            refocused.focus();
            refocused.setSelectionRange(refocused.value.length, refocused.value.length);
          }
        });
      }

      const modeSelect = container.querySelector('#sales-mode-filter');
      if (modeSelect) {
        modeSelect.addEventListener('change', (e) => {
          this.state.modeFilter = e.target.value;
          this.state.currentPage = 1;
          this.render(container);
        });
      }

      const newBtn = container.querySelector('#sales-new-btn');
      if (newBtn) {
        newBtn.addEventListener('click', () =>
          this.openSaleWizard({ onSaleConfirmed: () => this.render(container) })
        );
      }

      const emptyNewBtn = container.querySelector('#sales-empty-new-btn');
      if (emptyNewBtn) {
        emptyNewBtn.addEventListener('click', () =>
          this.openSaleWizard({ onSaleConfirmed: () => this.render(container) })
        );
      }

      container.querySelectorAll('[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.state.currentPage = Number(btn.getAttribute('data-page'));
          this.render(container);
        });
      });

      container.querySelectorAll('[data-open-sale]').forEach((row) => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('[data-stop-row]')) return;
          const sid = Number(row.getAttribute('data-open-sale'));
          this.openSaleDetailModal(sid);
        });
      });

      container.querySelectorAll('[data-view-sale]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const sid = Number(btn.getAttribute('data-view-sale'));
          this.openSaleDetailModal(sid);
        });
      });

      container.querySelectorAll('[data-pay-sale-debt]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const debtId = Number(btn.getAttribute('data-pay-sale-debt'));
          const clientId = Number(btn.getAttribute('data-client-id'));
          global.ComerSys.Modules.Debts.openRegisterPaymentModal(
            { clientId, debtId },
            () => this.render(container)
          );
        });
      });
    },

    /**
     * Abre el Asistente de Venta en 4 Pasos (Productos -> Cliente -> Pago/Cuotas -> Confirmar).
     */
    openSaleWizard(options = {}) {
      const availableProducts = InventoryService.getProducts().filter((p) => p.stock > 0);
      if (availableProducts.length === 0) {
        Components.toast(
          'No hay productos con stock disponible en el inventario. Agregue productos o reponga stock primero.',
          'warning'
        );
        global.ComerSys.App.navigate('inventory');
        return;
      }

      // fecha sugerida para el primer vencimiento (30 días adelante)
      const defaultDueDate = Formatters.addInstallmentPeriod(Formatters.todayISO(), 1, 'mensual');

      const draft = {
        step: options.startStep || 1,
        items: [], // [{ productId, code, name, unitPrice, maxStock, quantity }]
        discount: 0,
        clientId: options.clientId ? Number(options.clientId) : null,
        paymentMode: options.paymentMode || 'completo', // 'completo' | 'parcial' | 'cuotas'
        paymentMethod: 'efectivo',
        initialPayment: 0,
        installmentsCount: 3,
        firstDueDate: defaultDueDate,
        frequency: 'mensual',
        notes: ''
      };

      // Si viene precargado desde "Registrar salida de producto"
      if (Array.isArray(options.initialItems)) {
        options.initialItems.forEach((initItem) => {
          const prod = InventoryService.getProductById(initItem.productId);
          if (prod && prod.stock > 0) {
            draft.items.push({
              productId: prod.id,
              code: prod.code,
              name: prod.name,
              unitPrice: prod.salePrice,
              maxStock: prod.stock,
              quantity: Math.min(prod.stock, Math.max(1, Number(initItem.quantity) || 1))
            });
          }
        });
      }

      const calcTotals = () => {
        const subtotal = Validators.roundCurrency(
          draft.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
        );
        const discount = Math.min(subtotal, Math.max(0, Validators.roundCurrency(draft.discount || 0)));
        const total = Validators.roundCurrency(subtotal - discount);
        return { subtotal, discount, total };
      };

      // Si se precargó en modo parcial, sugerir 50% de entrega inicial
      const initTotals = calcTotals();
      if (draft.paymentMode === 'parcial' && initTotals.total > 0) {
        draft.initialPayment = Validators.roundCurrency(initTotals.total / 2);
      }

      const modeTitleMap = {
        completo: 'Venta - Pago completo',
        parcial: 'Venta - Pago parcial',
        cuotas: 'Venta - En cuotas'
      };

      Components.openModal({
        size: 'lg',
        headerHtml: `
          <div class="modal-title-group">
            <button type="button" class="icon-action-btn" id="wizard-header-back-btn" title="Paso anterior / Cerrar">
              ${Icons.get('arrowLeft')}
            </button>
            <h3 class="modal-title" id="wizard-modal-title">${modeTitleMap[draft.paymentMode]}</h3>
          </div>
          <button type="button" class="modal-close-btn" data-modal-close aria-label="Cerrar">
            ${Icons.get('close')}
          </button>
        `,
        subHeaderHtml: `<div id="wizard-stepper-bar"></div>`,
        bodyHtml: `<div id="wizard-step-body"></div>`,
        footerHtml: `<div id="wizard-footer-actions" style="display:flex;width:100%;align-items:center;justify-content:space-between;gap:0.75rem;"></div>`,
        onMount(modalEl, close) {
          const titleEl = modalEl.querySelector('#wizard-modal-title');
          const stepperEl = modalEl.querySelector('#wizard-stepper-bar');
          const bodyEl = modalEl.querySelector('#wizard-step-body');
          const footerEl = modalEl.querySelector('#wizard-footer-actions');
          const headerBackBtn = modalEl.querySelector('#wizard-header-back-btn');

          const canAdvanceFromStep = (stepNum) => {
            if (stepNum === 1) {
              if (draft.items.length === 0) {
                Components.toast('Agregue al menos un producto a la venta.', 'warning');
                return false;
              }
              return true;
            }
            if (stepNum === 2) {
              if ((draft.paymentMode === 'parcial' || draft.paymentMode === 'cuotas') && !draft.clientId) {
                Components.toast(
                  'Seleccione o cree un cliente para poder financiar el saldo o las cuotas.',
                  'warning'
                );
                return false;
              }
              return true;
            }
            if (stepNum === 3) {
              const { total } = calcTotals();
              if (draft.paymentMode !== 'completo' && !draft.clientId) {
                Components.toast('Para pago parcial o en cuotas debe seleccionar un cliente en el Paso 2.', 'warning');
                draft.step = 2;
                renderWizard();
                return false;
              }
              if (draft.paymentMode === 'parcial') {
                if (draft.initialPayment <= 0 || draft.initialPayment >= total) {
                  Components.toast(
                    'En Pago Parcial la entrega inicial debe ser mayor a $0 y menor al total de la venta.',
                    'warning'
                  );
                  return false;
                }
              }
              if (draft.paymentMode === 'cuotas') {
                if (draft.initialPayment < 0 || draft.initialPayment >= total) {
                  Components.toast('La entrega inicial debe ser menor al total de la venta.', 'warning');
                  return false;
                }
                if (!draft.installmentsCount || draft.installmentsCount < 1) {
                  Components.toast('Indique una cantidad de cuotas válida.', 'warning');
                  return false;
                }
              }
              return true;
            }
            return true;
          };

          const executeConfirmSale = () => {
            if (!canAdvanceFromStep(1) || !canAdvanceFromStep(2) || !canAdvanceFromStep(3)) return;
            try {
              const createdSale = SalesService.createSale({
                items: draft.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
                clientId: draft.clientId,
                paymentMode: draft.paymentMode,
                paymentMethod: draft.paymentMethod,
                discount: draft.discount,
                initialPayment: draft.initialPayment,
                installmentsCount: draft.installmentsCount,
                firstDueDate: draft.firstDueDate,
                frequency: draft.frequency,
                notes: draft.notes
              });

              Components.toast(
                `Venta ${createdSale.code} confirmada por ${Formatters.currency(createdSale.total)}. Stock actualizado.`
              );
              close();
              if (typeof options.onSaleConfirmed === 'function') {
                options.onSaleConfirmed(createdSale);
              }
              global.ComerSys.App.refreshCurrentView();
            } catch (err) {
              Components.toast(err.message, 'error');
            }
          };

          const renderWizard = () => {
            titleEl.textContent = modeTitleMap[draft.paymentMode] || 'Registrar Venta';
            const thirdLabel = draft.paymentMode === 'cuotas' ? 'Cuotas' : 'Pago';
            const stepsMeta = [
              { num: 1, label: 'Productos' },
              { num: 2, label: 'Cliente' },
              { num: 3, label: thirdLabel },
              { num: 4, label: 'Confirmar' }
            ];

            stepperEl.innerHTML = `
              <div class="wizard-stepper">
                ${stepsMeta
                  .map((s, idx) => {
                    const isCompleted = draft.step > s.num;
                    const isActive = draft.step === s.num;
                    const stateCls = isActive ? 'active' : isCompleted ? 'completed' : '';
                    return `
                      <div class="wizard-step ${stateCls}" style="cursor:pointer;" data-jump-step="${s.num}">
                        <span class="wizard-step-num">${isCompleted ? '✓' : s.num}</span>
                        <span>${s.label}</span>
                      </div>
                      ${
                        idx < stepsMeta.length - 1
                          ? `<div class="wizard-step-line ${isCompleted ? 'completed' : ''}"></div>`
                          : ''
                      }
                    `;
                  })
                  .join('')}
              </div>
            `;

            stepperEl.querySelectorAll('[data-jump-step]').forEach((stepNode) => {
              stepNode.addEventListener('click', () => {
                const target = Number(stepNode.getAttribute('data-jump-step'));
                if (target < draft.step || canAdvanceFromStep(draft.step)) {
                  draft.step = target;
                  renderWizard();
                }
              });
            });

            if (draft.step === 1) {
              renderStep1Products();
            } else if (draft.step === 2) {
              renderStep2Client();
            } else if (draft.step === 3) {
              renderStep3Payment();
            } else {
              renderStep4Confirm();
            }
          };

          // PASO 1: SELECCIÓN DE PRODUCTOS Y CANTIDADES
          const renderStep1Products = () => {
            const products = InventoryService.getProducts().filter((p) => p.stock > 0);
            const { subtotal, discount, total } = calcTotals();

            bodyEl.innerHTML = `
              <div class="form-grid" style="grid-template-columns:1.35fr 1fr;align-items:flex-end;margin-bottom:1.1rem;">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Seleccionar producto en stock</label>
                  <select class="form-control" id="wiz-prod-select">
                    ${products
                      .map(
                        (p) =>
                          `<option value="${p.id}">${Validators.escapeHtml(p.name)} (${Validators.escapeHtml(p.code)}) — Stock: ${p.stock} — ${Formatters.currency(p.salePrice)}</option>`
                      )
                      .join('')}
                  </select>
                </div>
                <div style="display:flex;gap:0.85rem;align-items:flex-end;">
                  <div class="form-group" style="width:85px;margin-bottom:0;">
                    <label class="form-label">Cantidad</label>
                    <input type="number" min="1" step="1" value="1" class="form-control" id="wiz-prod-qty" />
                  </div>
                  <button type="button" class="btn btn-primary" id="wiz-add-item-btn" style="flex:1;height:31px;">
                    ${Icons.get('plus')} Agregar
                  </button>
                </div>
              </div>

              <div class="table-responsive" style="border:1px solid var(--border-color);border-radius:var(--radius-sm);">
                ${
                  draft.items.length === 0
                    ? `<div class="empty-state" style="padding:1.8rem;">
                        <p class="text-muted">Seleccione uno o más productos arriba para armar el pedido.</p>
                      </div>`
                    : `
                      <table class="data-table">
                        <thead>
                          <tr>
                            <th>Producto</th>
                            <th style="width:130px;">Cant.</th>
                            <th>Precio</th>
                            <th>Subtotal</th>
                            <th class="text-right">Quitar</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${draft.items
                            .map(
                              (item, idx) => `
                            <tr>
                              <td>
                                <div class="font-semibold">${Validators.escapeHtml(item.name)}</div>
                                <div class="text-muted" style="font-size:0.74rem;">Disp: ${item.maxStock} u.</div>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="1"
                                  max="${item.maxStock}"
                                  value="${item.quantity}"
                                  class="form-control"
                                  style="height:27px;width:72px;"
                                  data-item-qty-idx="${idx}"
                                />
                              </td>
                              <td>${Formatters.currency(item.unitPrice)}</td>
                              <td class="font-bold">${Formatters.currency(item.unitPrice * item.quantity)}</td>
                              <td class="text-right">
                                <button type="button" class="icon-action-btn danger" data-remove-item-idx="${idx}">
                                  ${Icons.get('trash')}
                                </button>
                              </td>
                            </tr>
                          `
                            )
                            .join('')}
                        </tbody>
                      </table>
                    `
                }
              </div>

              <div class="sale-totals-box">
                <div class="sale-total-row">
                  <span>Subtotal</span>
                  <span class="font-semibold">${Formatters.currency(subtotal)}</span>
                </div>
                <div class="sale-total-row">
                  <span>Descuento ($)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value="${discount}"
                    id="wiz-discount-input"
                    class="form-control text-right"
                    style="width:95px;height:25px;font-size:0.84rem;"
                  />
                </div>
                <div class="sale-total-row grand-total">
                  <span>Total</span>
                  <span>${Formatters.currency(total)}</span>
                </div>
              </div>
            `;

            footerEl.innerHTML = `
              <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
              <button type="button" class="btn btn-primary" id="wiz-next-step-btn">
                Continuar a Cliente ${Icons.get('chevronRight')}
              </button>
            `;

            bodyEl.querySelector('#wiz-add-item-btn').addEventListener('click', () => {
              const pid = Number(bodyEl.querySelector('#wiz-prod-select').value);
              const qty = Math.max(1, parseInt(bodyEl.querySelector('#wiz-prod-qty').value, 10) || 1);
              const prod = InventoryService.getProductById(pid);
              if (!prod) return;

              const existing = draft.items.find((i) => Number(i.productId) === pid);
              const newQty = (existing ? existing.quantity : 0) + qty;
              if (newQty > prod.stock) {
                Components.toast(
                  `Stock máximo disponible para "${prod.name}": ${prod.stock} unidad(es).`,
                  'warning'
                );
                return;
              }
              if (existing) {
                existing.quantity = newQty;
              } else {
                draft.items.push({
                  productId: prod.id,
                  code: prod.code,
                  name: prod.name,
                  unitPrice: prod.salePrice,
                  maxStock: prod.stock,
                  quantity: qty
                });
              }
              renderStep1Products();
            });

            bodyEl.querySelectorAll('[data-item-qty-idx]').forEach((inp) => {
              inp.addEventListener('change', () => {
                const idx = Number(inp.getAttribute('data-item-qty-idx'));
                const item = draft.items[idx];
                if (!item) return;
                const val = parseInt(inp.value, 10) || 1;
                if (val > item.maxStock) {
                  Components.toast(`Stock disponible de "${item.name}": ${item.maxStock}.`, 'warning');
                }
                item.quantity = Math.max(1, Math.min(item.maxStock, val));
                renderStep1Products();
              });
            });

            bodyEl.querySelectorAll('[data-remove-item-idx]').forEach((btn) => {
              btn.addEventListener('click', () => {
                const idx = Number(btn.getAttribute('data-remove-item-idx'));
                draft.items.splice(idx, 1);
                renderStep1Products();
              });
            });

            const discInput = bodyEl.querySelector('#wiz-discount-input');
            if (discInput) {
              discInput.addEventListener('change', () => {
                draft.discount = Math.max(0, Number(discInput.value) || 0);
                renderStep1Products();
              });
            }

            footerEl.querySelector('#wiz-next-step-btn').addEventListener('click', () => {
              if (canAdvanceFromStep(1)) {
                draft.step = 2;
                renderWizard();
              }
            });
            footerEl.querySelector('[data-modal-close]').addEventListener('click', close);
          };

          // PASO 2: SELECCIÓN O ALTA DE CLIENTE Y MODALIDAD DE PAGO
          const renderStep2Client = () => {
            const clients = ClientsService.getClients();

            bodyEl.innerHTML = `
              <div class="form-group">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem;">
                  <label class="form-label" style="margin:0;">Cliente de la operación</label>
                  <button type="button" class="btn btn-sm btn-secondary" id="wiz-create-client-inline-btn">
                    ${Icons.get('plus')} Nuevo Cliente
                  </button>
                </div>
                <select class="form-control" id="wiz-client-select">
                  <option value="" ${!draft.clientId ? 'selected' : ''}>
                    Consumidor Final (Solo habilitado para Pago completo)
                  </option>
                  ${clients
                    .map(
                      (c) =>
                        `<option value="${c.id}" ${Number(c.id) === Number(draft.clientId) ? 'selected' : ''}>
                          ${Validators.escapeHtml(c.name)} — Tel: ${Validators.escapeHtml(c.phone)} ${c.pendingBalance > 0 ? `(Saldo: ${Formatters.currency(c.pendingBalance)})` : ''}
                        </option>`
                    )
                    .join('')}
                </select>
              </div>

              <div class="form-group" style="margin-top:1.1rem;margin-bottom:0;">
                <label class="form-label">¿Cómo realiza el pago?</label>
                <div class="payment-mode-options">
                  <div class="payment-mode-card mode-full ${draft.paymentMode === 'completo' ? 'selected' : ''}" data-select-mode="completo">
                    <div class="payment-mode-radio">${draft.paymentMode === 'completo' ? Icons.get('check') : ''}</div>
                    <div>
                      <div class="payment-mode-title">Pago completo</div>
                      <div class="payment-mode-desc">Se registra la venta como pagada en su totalidad.</div>
                    </div>
                  </div>
                  <div class="payment-mode-card mode-partial ${draft.paymentMode === 'parcial' ? 'selected' : ''}" data-select-mode="parcial">
                    <div class="payment-mode-radio">${draft.paymentMode === 'parcial' ? Icons.get('check') : ''}</div>
                    <div>
                      <div class="payment-mode-title">Pago parcial</div>
                      <div class="payment-mode-desc">Se registra el importe entregado y queda un saldo pendiente en la cuenta del cliente.</div>
                    </div>
                  </div>
                  <div class="payment-mode-card mode-installments ${draft.paymentMode === 'cuotas' ? 'selected' : ''}" data-select-mode="cuotas">
                    <div class="payment-mode-radio">${draft.paymentMode === 'cuotas' ? Icons.get('check') : ''}</div>
                    <div>
                      <div class="payment-mode-title">En cuotas</div>
                      <div class="payment-mode-desc">Se genera un plan de financiación automático con vencimientos y cuotas.</div>
                    </div>
                  </div>
                </div>
              </div>
            `;

            footerEl.innerHTML = `
              <button type="button" class="btn btn-secondary" id="wiz-prev-btn">
                ${Icons.get('chevronLeft')} Anterior
              </button>
              <button type="button" class="btn btn-primary" id="wiz-next-btn">
                Continuar a ${draft.paymentMode === 'cuotas' ? 'Cuotas' : 'Pago'} ${Icons.get('chevronRight')}
              </button>
            `;

            const clientSelect = bodyEl.querySelector('#wiz-client-select');
            clientSelect.addEventListener('change', () => {
              draft.clientId = clientSelect.value ? Number(clientSelect.value) : null;
            });

            bodyEl.querySelector('#wiz-create-client-inline-btn').addEventListener('click', () => {
              global.ComerSys.Modules.Clients.openClientFormModal(null, (newClient) => {
                draft.clientId = newClient.id;
                renderStep2Client();
              });
            });

            bodyEl.querySelectorAll('[data-select-mode]').forEach((card) => {
              card.addEventListener('click', () => {
                draft.paymentMode = card.getAttribute('data-select-mode');
                const { total } = calcTotals();
                if (draft.paymentMode === 'parcial' && draft.initialPayment <= 0) {
                  draft.initialPayment = Validators.roundCurrency(total / 2);
                } else if (draft.paymentMode === 'cuotas' && draft.initialPayment >= total) {
                  draft.initialPayment = 0;
                }
                renderWizard();
              });
            });

            footerEl.querySelector('#wiz-prev-btn').addEventListener('click', () => {
              draft.step = 1;
              renderWizard();
            });
            footerEl.querySelector('#wiz-next-btn').addEventListener('click', () => {
              if (canAdvanceFromStep(2)) {
                draft.step = 3;
                renderWizard();
              }
            });
          };

          // PASO 3: CONFIGURACIÓN DE PAGO COMPLETO, PAGO PARCIAL O EN CUOTAS (Diseño exacto de las 3 pantallas)
          const renderStep3Payment = () => {
            const { subtotal, discount, total } = calcTotals();
            const clients = ClientsService.getClients();
            const currentClient = clients.find((c) => Number(c.id) === Number(draft.clientId));
            const clientLabel = currentClient ? currentClient.name : 'Consumidor Final';

            const renderMethodsPills = () => `
              <div class="form-group" style="margin-top:1rem;margin-bottom:0;">
                <label class="form-label">Método de pago</label>
                <div class="payment-methods-row">
                  ${Config.PAYMENT_METHODS.map(
                    (m) => `
                    <div class="method-radio-pill ${draft.paymentMethod === m.id ? 'active' : ''}" data-method="${m.id}">
                      <input type="radio" name="wiz_pay_method" ${draft.paymentMethod === m.id ? 'checked' : ''} style="pointer-events:none;" />
                      <span>${Validators.escapeHtml(m.label)}</span>
                    </div>
                  `
                  ).join('')}
                </div>
              </div>
            `;

            if (draft.paymentMode === 'completo') {
              bodyEl.innerHTML = `
                <h4 style="margin-bottom:0.75rem;font-size:0.95rem;">Productos</h4>
                <div class="table-responsive" style="border:1px solid var(--border-color);border-radius:var(--radius-sm);">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cant.</th>
                        <th>Precio</th>
                        <th class="text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${draft.items
                        .map(
                          (item) => `
                        <tr>
                          <td class="font-semibold">${Validators.escapeHtml(item.name)}</td>
                          <td>${item.quantity}</td>
                          <td>${Formatters.currency(item.unitPrice)}</td>
                          <td class="text-right font-semibold">${Formatters.currency(item.unitPrice * item.quantity)}</td>
                        </tr>
                      `
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>

                <div class="sale-totals-box">
                  <div class="sale-total-row">
                    <span>Subtotal</span>
                    <span>${Formatters.currency(subtotal)}</span>
                  </div>
                  <div class="sale-total-row">
                    <span>Descuento</span>
                    <span>${Formatters.currency(discount)}</span>
                  </div>
                  <div class="sale-total-row grand-total">
                    <span>Total</span>
                    <span>${Formatters.currency(total)}</span>
                  </div>
                </div>

                ${renderMethodsPills()}
              `;
            } else if (draft.paymentMode === 'parcial') {
              const pending = Validators.roundCurrency(Math.max(0, total - draft.initialPayment));
              bodyEl.innerHTML = `
                <div class="sale-split-grid">
                  <div>
                    <div class="form-group">
                      <label class="form-label">Cliente</label>
                      <input type="text" class="form-control font-semibold" value="${Validators.escapeHtml(clientLabel)}" readonly style="background:var(--bg-surface-subtle);" />
                    </div>
                    <div class="form-group">
                      <label class="form-label">Entrega inicial ($) <span class="required">*</span></label>
                      <input
                        type="number"
                        min="1"
                        max="${total - 0.01}"
                        step="0.01"
                        class="form-control font-bold"
                        id="wiz-initial-payment-input"
                        value="${draft.initialPayment}"
                      />
                    </div>
                    <div class="form-group">
                      <label class="form-label">Fecha de vencimiento del saldo</label>
                      <input
                        type="date"
                        class="form-control"
                        id="wiz-due-date-input"
                        value="${draft.firstDueDate}"
                      />
                    </div>
                    ${renderMethodsPills()}
                  </div>

                  <div>
                    <div class="summary-stat-box">
                      <span class="summary-stat-label">Total de la venta</span>
                      <div class="summary-stat-value">${Formatters.currency(total)}</div>
                    </div>
                    <div class="summary-stat-box">
                      <span class="summary-stat-label">Entregado ahora</span>
                      <div class="summary-stat-value text-success" id="wiz-stat-delivered">${Formatters.currency(draft.initialPayment)}</div>
                    </div>
                    <div class="summary-stat-box" style="border-color:var(--danger-border);background:var(--danger-bg);">
                      <span class="summary-stat-label">Saldo pendiente</span>
                      <div class="summary-stat-value text-danger" id="wiz-stat-pending">${Formatters.currency(pending)}</div>
                    </div>
                  </div>
                </div>
              `;
            } else {
              // Modo: En cuotas
              const financed = Validators.roundCurrency(Math.max(0, total - draft.initialPayment));
              const perInstallment = Validators.roundCurrency(
                financed / Math.max(1, draft.installmentsCount)
              );

              bodyEl.innerHTML = `
                <div class="form-group">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.35rem;">
                    <label class="form-label" style="margin:0;">Cliente</label>
                    <button type="button" class="btn btn-sm btn-secondary" id="wiz-step3-new-client-btn">
                      Nuevo Cliente
                    </button>
                  </div>
                  <input type="text" class="form-control font-semibold" value="${Validators.escapeHtml(clientLabel)}" readonly style="background:var(--bg-surface-subtle);" />
                </div>

                <div class="form-grid" style="margin-bottom:1rem;">
                  <div class="summary-stat-box" style="margin:0;">
                    <span class="summary-stat-label">Total de la venta</span>
                    <div class="summary-stat-value">${Formatters.currency(total)}</div>
                  </div>
                  <div class="summary-stat-box" style="margin:0;border-color:var(--primary-200);background:var(--primary-50);">
                    <span class="summary-stat-label">Saldo a financiar en cuotas</span>
                    <div class="summary-stat-value text-primary-blue" id="wiz-cuotas-financed">${Formatters.currency(financed)}</div>
                  </div>
                </div>

                <div class="form-grid">
                  <div class="form-group">
                    <label class="form-label">Entrega inicial (opcional)</label>
                    <input
                      type="number"
                      min="0"
                      max="${total - 0.01}"
                      step="0.01"
                      class="form-control"
                      id="wiz-initial-payment-input"
                      value="${draft.initialPayment}"
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Cantidad de cuotas <span class="required">*</span></label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      step="1"
                      class="form-control font-bold"
                      id="wiz-installments-count-input"
                      value="${draft.installmentsCount}"
                    />
                    <span class="form-hint" id="wiz-installment-each-hint">
                      ${draft.installmentsCount} cuota(s) de aprox. <strong>${Formatters.currency(perInstallment)}</strong>
                    </span>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Frecuencia</label>
                    <select class="form-control" id="wiz-frequency-select">
                      ${Config.INSTALLMENT_FREQUENCIES.map(
                        (f) =>
                          `<option value="${f.id}" ${draft.frequency === f.id ? 'selected' : ''}>${f.label}</option>`
                      ).join('')}
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Fecha primer vencimiento</label>
                    <input
                      type="date"
                      class="form-control"
                      id="wiz-due-date-input"
                      value="${draft.firstDueDate}"
                    />
                  </div>
                </div>

                ${renderMethodsPills()}
              `;
            }

            footerEl.innerHTML = `
              <button type="button" class="btn btn-secondary" id="wiz-prev-btn">
                ${Icons.get('chevronLeft')} Anterior
              </button>
              <div style="display:flex;gap:0.85rem;">
                <button type="button" class="btn btn-secondary" id="wiz-review-step4-btn">
                  Revisar resumen
                </button>
                <button type="button" class="btn btn-primary" id="wiz-direct-confirm-btn">
                  Confirmar Venta
                </button>
              </div>
            `;

            // Eventos de métodos de pago
            bodyEl.querySelectorAll('[data-method]').forEach((pill) => {
              pill.addEventListener('click', () => {
                draft.paymentMethod = pill.getAttribute('data-method');
                renderStep3Payment();
              });
            });

            const initInput = bodyEl.querySelector('#wiz-initial-payment-input');
            if (initInput) {
              initInput.addEventListener('input', () => {
                draft.initialPayment = Math.max(0, Validators.roundCurrency(initInput.value));
                const pending = Validators.roundCurrency(Math.max(0, total - draft.initialPayment));
                const delivEl = bodyEl.querySelector('#wiz-stat-delivered');
                const pendEl = bodyEl.querySelector('#wiz-stat-pending');
                const finEl = bodyEl.querySelector('#wiz-cuotas-financed');
                const eachHint = bodyEl.querySelector('#wiz-installment-each-hint');

                if (delivEl) delivEl.textContent = Formatters.currency(draft.initialPayment);
                if (pendEl) pendEl.textContent = Formatters.currency(pending);
                if (finEl) finEl.textContent = Formatters.currency(pending);
                if (eachHint) {
                  const each = Validators.roundCurrency(pending / Math.max(1, draft.installmentsCount));
                  eachHint.innerHTML = `${draft.installmentsCount} cuota(s) de aprox. <strong>${Formatters.currency(each)}</strong>`;
                }
              });
            }

            const countInput = bodyEl.querySelector('#wiz-installments-count-input');
            if (countInput) {
              countInput.addEventListener('input', () => {
                draft.installmentsCount = Math.max(1, Math.min(60, parseInt(countInput.value, 10) || 1));
                const pending = Validators.roundCurrency(Math.max(0, total - draft.initialPayment));
                const each = Validators.roundCurrency(pending / draft.installmentsCount);
                const eachHint = bodyEl.querySelector('#wiz-installment-each-hint');
                if (eachHint) {
                  eachHint.innerHTML = `${draft.installmentsCount} cuota(s) de aprox. <strong>${Formatters.currency(each)}</strong>`;
                }
              });
            }

            const freqSelect = bodyEl.querySelector('#wiz-frequency-select');
            if (freqSelect) {
              freqSelect.addEventListener('change', () => {
                draft.frequency = freqSelect.value;
              });
            }

            const dueInput = bodyEl.querySelector('#wiz-due-date-input');
            if (dueInput) {
              dueInput.addEventListener('change', () => {
                draft.firstDueDate = dueInput.value || Formatters.todayISO();
              });
            }

            const newCliBtn = bodyEl.querySelector('#wiz-step3-new-client-btn');
            if (newCliBtn) {
              newCliBtn.addEventListener('click', () => {
                global.ComerSys.Modules.Clients.openClientFormModal(null, (newClient) => {
                  draft.clientId = newClient.id;
                  renderStep3Payment();
                });
              });
            }

            footerEl.querySelector('#wiz-prev-btn').addEventListener('click', () => {
              draft.step = 2;
              renderWizard();
            });

            footerEl.querySelector('#wiz-review-step4-btn').addEventListener('click', () => {
              if (canAdvanceFromStep(3)) {
                draft.step = 4;
                renderWizard();
              }
            });

            footerEl.querySelector('#wiz-direct-confirm-btn').addEventListener('click', executeConfirmSale);
          };

          // PASO 4: CONFIRMACIÓN Y VISTA PREVIA DEL CRONOGRAMA
          const renderStep4Confirm = () => {
            const { total } = calcTotals();
            const clients = ClientsService.getClients();
            const currentClient = clients.find((c) => Number(c.id) === Number(draft.clientId));
            const clientLabel = currentClient ? currentClient.name : 'Consumidor Final';
            const paidNow = draft.paymentMode === 'completo' ? total : draft.initialPayment;
            const pending = Validators.roundCurrency(Math.max(0, total - paidNow));

            bodyEl.innerHTML = `
              <div class="client-kpis-3">
                <div class="client-kpi-box">
                  <div class="client-kpi-label">Total Operación</div>
                  <div class="client-kpi-val">${Formatters.currency(total)}</div>
                </div>
                <div class="client-kpi-box">
                  <div class="client-kpi-label">Cobro inmediato (${Validators.escapeHtml(draft.paymentMethod)})</div>
                  <div class="client-kpi-val text-success">${Formatters.currency(paidNow)}</div>
                </div>
                <div class="client-kpi-box ${pending > 0 ? 'danger-highlight' : ''}">
                  <div class="client-kpi-label">Saldo Financiado</div>
                  <div class="client-kpi-val">${Formatters.currency(pending)}</div>
                </div>
              </div>

              <div style="padding:1rem;background:var(--bg-surface-subtle);border:1px solid var(--border-color);border-radius:var(--radius-sm);font-size:0.87rem;">
                <p style="margin-bottom:0.45rem;"><strong>Cliente:</strong> ${Validators.escapeHtml(clientLabel)}</p>
                <p style="margin-bottom:0.45rem;"><strong>Artículos a descontar de stock:</strong> ${draft.items
                  .map((i) => `${Validators.escapeHtml(i.name)} (x${i.quantity})`)
                  .join(', ')}</p>
                ${
                  pending > 0
                    ? `<p style="margin:0;"><strong>Plan de pago:</strong> ${
                        draft.paymentMode === 'cuotas'
                          ? `${draft.installmentsCount} cuota(s) (${draft.frequency}) con 1º vencimiento el ${Formatters.date(draft.firstDueDate)}`
                          : `Pago parcial con vencimiento de saldo el ${Formatters.date(draft.firstDueDate)}`
                      }</p>`
                    : `<p style="margin:0;"><strong>Estado:</strong> Venta pagada al 100%.</p>`
                }
              </div>
            `;

            footerEl.innerHTML = `
              <button type="button" class="btn btn-secondary" id="wiz-prev-btn">
                ${Icons.get('chevronLeft')} Volver a Pago
              </button>
              <button type="button" class="btn btn-primary btn-lg" id="wiz-final-confirm-btn">
                ${Icons.get('check')} Confirmar Venta
              </button>
            `;

            footerEl.querySelector('#wiz-prev-btn').addEventListener('click', () => {
              draft.step = 3;
              renderWizard();
            });
            footerEl.querySelector('#wiz-final-confirm-btn').addEventListener('click', executeConfirmSale);
          };

          headerBackBtn.addEventListener('click', () => {
            if (draft.step > 1) {
              draft.step -= 1;
              renderWizard();
            } else {
              close();
            }
          });

          renderWizard();
        }
      });
    },

    /**
     * Modal: Detalle / Comprobante de una Venta registrada.
     */
    openSaleDetailModal(saleId) {
      const sale = SalesService.getSaleById(saleId);
      if (!sale) return;

      const modeLabels = {
        completo: 'Pago completo',
        parcial: 'Pago parcial',
        cuotas: 'En cuotas'
      };

      Components.openModal({
        title: `Comprobante de Venta ${sale.code}`,
        size: 'md',
        bodyHtml: `
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1rem;padding-bottom:0.85rem;border-bottom:1px solid var(--border-subtle);">
            <div>
              <div class="text-muted" style="font-size:0.78rem;">Cliente</div>
              <div class="font-bold" style="font-size:1rem;">${Validators.escapeHtml(sale.clientName)}</div>
            </div>
            <div>
              <div class="text-muted" style="font-size:0.78rem;">Fecha</div>
              <div class="font-semibold">${Formatters.date(sale.date)}</div>
            </div>
            <div>
              <div class="text-muted" style="font-size:0.78rem;">Modalidad</div>
              <div class="font-semibold">${Validators.escapeHtml(modeLabels[sale.paymentMode] || sale.paymentMode)}</div>
            </div>
            <div>
              <div class="text-muted" style="font-size:0.78rem;">Estado</div>
              <div>${Formatters.statusBadge(sale.computedStatus)}</div>
            </div>
          </div>

          <div class="table-responsive" style="border:1px solid var(--border-color);border-radius:var(--radius-sm);">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cant.</th>
                  <th>Precio Unit.</th>
                  <th class="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${sale.items
                  .map(
                    (i) => `
                  <tr>
                    <td>
                      <div class="font-semibold">${Validators.escapeHtml(i.name)}</div>
                      <div class="text-muted font-mono" style="font-size:0.75rem;">${Validators.escapeHtml(i.code)}</div>
                    </td>
                    <td>${i.quantity}</td>
                    <td>${Formatters.currency(i.unitPrice)}</td>
                    <td class="text-right font-semibold">${Formatters.currency(i.subtotal)}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>

          <div class="sale-totals-box">
            <div class="sale-total-row">
              <span>Subtotal</span>
              <span>${Formatters.currency(sale.subtotal)}</span>
            </div>
            ${
              sale.discount > 0
                ? `<div class="sale-total-row">
                    <span>Descuento</span>
                    <span>-${Formatters.currency(sale.discount)}</span>
                  </div>`
                : ''
            }
            <div class="sale-total-row grand-total">
              <span>Total Venta</span>
              <span>${Formatters.currency(sale.total)}</span>
            </div>
            <div class="sale-total-row">
              <span>Total Cobrado</span>
              <span class="text-success font-semibold">${Formatters.currency(sale.paidAmount)}</span>
            </div>
            <div class="sale-total-row">
              <span>Saldo Pendiente</span>
              <span class="${sale.pendingAmount > 0 ? 'text-danger font-bold' : 'text-muted'}">${Formatters.currency(sale.pendingAmount)}</span>
            </div>
          </div>
        `,
        footerHtml: `
          <button type="button" class="btn btn-secondary" data-modal-close>Cerrar</button>
          ${
            sale.pendingAmount > 0.009 && sale.debtId
              ? `<button type="button" class="btn btn-primary" id="sale-detail-pay-btn">
                  ${Icons.get('wallet')} Registrar Pago
                </button>`
              : ''
          }
        `,
        onMount(modalEl, close) {
          const payBtn = modalEl.querySelector('#sale-detail-pay-btn');
          if (payBtn) {
            payBtn.addEventListener('click', () => {
              close();
              global.ComerSys.Modules.Debts.openRegisterPaymentModal(
                { clientId: sale.clientId, debtId: sale.debtId },
                () => global.ComerSys.App.refreshCurrentView()
              );
            });
          }
        }
      });
    }
  };

  global.ComerSys.Modules.Sales = SalesModule;
})(window);
