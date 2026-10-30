/**
 * ============================================================================
 * COMERSYS — MÓDULO 6: CLIENTES Y FICHA INDIVIDUAL DEL CLIENTE
 * ============================================================================
 * - Padrón de clientes con validación anti-duplicados.
 * - Ficha individual ("Detalle del cliente") con:
 *   - Datos personales, Teléfono, Dirección, Documento.
 *   - Indicadores: Total comprado, Total pagado, Saldo pendiente.
 *   - Pestañas: Historial de compras, Cuotas, Pagos y Notas.
 */
(function (global) {
  'use strict';

  const { Validators, Formatters } = global.ComerSys.Core;
  const { ClientsService } = global.ComerSys.Services;
  const { Icons, Components } = global.ComerSys.UI;

  const ClientsModule = {
    state: {
      search: '',
      statusFilter: 'todos',
      currentPage: 1,
      pageSize: 8
    },

    render(container) {
      const filtered = ClientsService.getClients({
        search: this.state.search,
        status: this.state.statusFilter
      });

      const pagination = Components.renderPagination(
        filtered.length,
        this.state.currentPage,
        this.state.pageSize
      );
      this.state.currentPage = pagination.safePage;
      const pageItems = filtered.slice(pagination.startIdx, pagination.endIdx);

      container.innerHTML = `
        <div class="page-header">
          <div class="page-header-titles">
            <h1>Clientes</h1>
            <p>Lista de clientes registrados y estado de cuenta corriente</p>
          </div>
          <div class="page-header-actions">
            <button type="button" class="btn btn-primary" id="cli-new-client-btn">
              ${Icons.get('plus')} Nuevo Cliente
            </button>
          </div>
        </div>

        <div class="card">
          <div class="toolbar-row">
            <div class="search-box">
              ${Icons.get('search')}
              <input
                type="search"
                id="cli-search-input"
                placeholder="Buscar cliente por nombre, teléfono, dirección o documento..."
                value="${Validators.escapeHtml(this.state.search)}"
              />
            </div>
            <div class="toolbar-filters">
              <select class="form-control" id="cli-status-filter" style="width:auto;min-width:140px;">
                <option value="todos" ${this.state.statusFilter === 'todos' ? 'selected' : ''}>Todos los estados</option>
                <option value="al_dia" ${this.state.statusFilter === 'al_dia' ? 'selected' : ''}>Al día</option>
                <option value="pendiente" ${this.state.statusFilter === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                <option value="pago_parcial" ${this.state.statusFilter === 'pago_parcial' ? 'selected' : ''}>Pago parcial</option>
                <option value="atrasado" ${this.state.statusFilter === 'atrasado' ? 'selected' : ''}>Atrasado</option>
                <option value="cancelado" ${this.state.statusFilter === 'cancelado' ? 'selected' : ''}>Cancelado</option>
              </select>
            </div>
          </div>

          <div class="table-responsive">
            ${
              pageItems.length === 0
                ? `
                  <div class="empty-state">
                    <div class="empty-state-icon">${Icons.get('clients')}</div>
                    <div class="empty-state-title">
                      ${
                        this.state.search || this.state.statusFilter !== 'todos'
                          ? 'No se encontraron clientes con esos filtros'
                          : 'Aún no hay clientes registrados'
                      }
                    </div>
                    <p class="empty-state-desc">
                      Registra a tus clientes para llevar su historial de compras, pagos parciales, financiación en cuotas y saldo pendiente.
                    </p>
                    <button type="button" class="btn btn-primary" id="cli-empty-new-btn">
                      ${Icons.get('plus')} Nuevo Cliente
                    </button>
                  </div>
                `
                : `
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Teléfono</th>
                        <th>Dirección</th>
                        <th>Estado</th>
                        <th class="text-right">Saldo</th>
                        <th class="text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${pageItems
                        .map(
                          (c) => `
                        <tr style="cursor:pointer;" data-open-client="${c.id}">
                          <td>
                            <div class="font-semibold">${Validators.escapeHtml(c.name)}</div>
                            ${
                              c.documentId
                                ? `<div class="text-muted" style="font-size:0.75rem;">Doc: ${Validators.escapeHtml(c.documentId)}</div>`
                                : ''
                            }
                          </td>
                          <td>${Validators.escapeHtml(c.phone)}</td>
                          <td class="text-muted">${Validators.escapeHtml(c.address)}</td>
                          <td>${Formatters.statusBadge(c.status)}</td>
                          <td class="text-right font-bold ${c.pendingBalance > 0.009 ? 'text-danger' : ''}">
                            ${Formatters.currency(c.pendingBalance)}
                          </td>
                          <td class="text-right" data-stop-row>
                            <div class="action-btn-group">
                              <button
                                type="button"
                                class="icon-action-btn primary"
                                data-view-client="${c.id}"
                                title="Ver ficha completa del cliente"
                              >
                                ${Icons.get('eye')}
                              </button>
                              ${
                                c.pendingBalance > 0.009
                                  ? `<button
                                      type="button"
                                      class="icon-action-btn success"
                                      data-pay-client="${c.id}"
                                      title="Registrar pago"
                                    >
                                      ${Icons.get('wallet')}
                                    </button>`
                                  : ''
                              }
                              <button
                                type="button"
                                class="icon-action-btn"
                                data-edit-client="${c.id}"
                                title="Editar cliente"
                              >
                                ${Icons.get('edit')}
                              </button>
                              <button
                                type="button"
                                class="icon-action-btn danger"
                                data-delete-client="${c.id}"
                                title="Eliminar cliente"
                              >
                                ${Icons.get('trash')}
                              </button>
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

      // Búsqueda
      const searchInput = container.querySelector('#cli-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.state.search = e.target.value;
          this.state.currentPage = 1;
          this.render(container);
          const refocused = container.querySelector('#cli-search-input');
          if (refocused) {
            refocused.focus();
            refocused.setSelectionRange(refocused.value.length, refocused.value.length);
          }
        });
      }

      // Filtro por estado
      const statusSelect = container.querySelector('#cli-status-filter');
      if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
          this.state.statusFilter = e.target.value;
          this.state.currentPage = 1;
          this.render(container);
        });
      }

      // Nuevo cliente
      const newBtn = container.querySelector('#cli-new-client-btn');
      if (newBtn) {
        newBtn.addEventListener('click', () => this.openClientFormModal(null, () => this.render(container)));
      }
      const emptyNewBtn = container.querySelector('#cli-empty-new-btn');
      if (emptyNewBtn) {
        emptyNewBtn.addEventListener('click', () => this.openClientFormModal(null, () => this.render(container)));
      }

      // Paginación
      container.querySelectorAll('[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.state.currentPage = Number(btn.getAttribute('data-page'));
          this.render(container);
        });
      });

      // Abrir ficha al hacer clic en fila o botón ojo
      container.querySelectorAll('[data-open-client]').forEach((row) => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('[data-stop-row]')) return;
          const cid = Number(row.getAttribute('data-open-client'));
          this.openClientDetailModal(cid, () => this.render(container));
        });
      });

      container.querySelectorAll('[data-view-client]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = Number(btn.getAttribute('data-view-client'));
          this.openClientDetailModal(cid, () => this.render(container));
        });
      });

      // Registrar pago directo
      container.querySelectorAll('[data-pay-client]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = Number(btn.getAttribute('data-pay-client'));
          global.ComerSys.Modules.Debts.openRegisterPaymentModal({ clientId: cid }, () => this.render(container));
        });
      });

      // Editar cliente
      container.querySelectorAll('[data-edit-client]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = Number(btn.getAttribute('data-edit-client'));
          const detail = ClientsService.getClientDetail(cid);
          if (detail) this.openClientFormModal(detail, () => this.render(container));
        });
      });

      // Eliminar cliente
      container.querySelectorAll('[data-delete-client]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = Number(btn.getAttribute('data-delete-client'));
          const detail = ClientsService.getClientDetail(cid);
          if (!detail) return;
          Components.confirm({
            title: 'Eliminar cliente',
            message: `¿Confirmas eliminar la ficha de "${detail.name}"?`,
            confirmText: 'Eliminar',
            danger: true,
            onConfirm: () => {
              try {
                ClientsService.deleteClient(cid);
                Components.toast(`Cliente "${detail.name}" eliminado.`);
                this.render(container);
                global.ComerSys.App.refreshHeaderIndicators();
              } catch (err) {
                Components.toast(err.message, 'error');
              }
            }
          });
        });
      });
    },

    /**
     * Modal: Crear o Editar Cliente (con validación anti-duplicados).
     */
    openClientFormModal(clientToEdit = null, onSuccess = null) {
      const isEdit = Boolean(clientToEdit && clientToEdit.id);

      Components.openModal({
        title: isEdit ? `Editar Cliente: ${clientToEdit.name}` : 'Nuevo Cliente',
        size: 'md',
        bodyHtml: `
          <form id="client-modal-form" novalidate>
            <div class="form-grid">
              <div class="form-group full-width">
                <label class="form-label">Nombre y Apellido / Razón Social <span class="required">*</span></label>
                <input
                  type="text"
                  class="form-control"
                  id="cli-name-input"
                  placeholder="Ej. María López, Juan Pérez..."
                  value="${Validators.escapeHtml(isEdit ? clientToEdit.name : '')}"
                  required
                />
              </div>
              <div class="form-group">
                <label class="form-label">Teléfono <span class="required">*</span></label>
                <input
                  type="tel"
                  class="form-control"
                  id="cli-phone-input"
                  placeholder="Ej. 3564-445566"
                  value="${Validators.escapeHtml(isEdit ? clientToEdit.phone : '')}"
                  required
                />
              </div>
              <div class="form-group">
                <label class="form-label">DNI / CUIT (opcional)</label>
                <input
                  type="text"
                  class="form-control"
                  id="cli-doc-input"
                  placeholder="Documento o CUIT"
                  value="${Validators.escapeHtml(isEdit ? clientToEdit.documentId || '' : '')}"
                />
              </div>
              <div class="form-group full-width">
                <label class="form-label">Dirección / Localidad</label>
                <input
                  type="text"
                  class="form-control"
                  id="cli-address-input"
                  placeholder="Ej. Av. Libertador 450, Córdoba"
                  value="${Validators.escapeHtml(isEdit ? clientToEdit.address || '' : '')}"
                />
              </div>
              ${
                !isEdit
                  ? `
                <div class="form-group full-width" style="margin-bottom:0;">
                  <label class="form-label">Nota inicial (opcional)</label>
                  <input
                    type="text"
                    class="form-control"
                    id="cli-notes-input"
                    placeholder="Observaciones o referencias del cliente"
                  />
                </div>
              `
                  : ''
              }
            </div>
          </form>
        `,
        footerHtml: `
          <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
          <button type="button" class="btn btn-primary" id="cli-save-btn">
            ${isEdit ? 'Guardar cambios' : 'Registrar Cliente'}
          </button>
        `,
        onMount(modalEl, close) {
          const nameInput = modalEl.querySelector('#cli-name-input');
          const phoneInput = modalEl.querySelector('#cli-phone-input');
          const docInput = modalEl.querySelector('#cli-doc-input');
          const addressInput = modalEl.querySelector('#cli-address-input');
          const notesInput = modalEl.querySelector('#cli-notes-input');
          const saveBtn = modalEl.querySelector('#cli-save-btn');
          const form = modalEl.querySelector('#client-modal-form');

          setTimeout(() => nameInput && nameInput.focus(), 60);

          const submit = (e) => {
            if (e) e.preventDefault();
            try {
              const payload = {
                name: nameInput.value,
                phone: phoneInput.value,
                documentId: docInput.value,
                address: addressInput.value,
                notes: notesInput ? notesInput.value : ''
              };

              const saved = isEdit
                ? ClientsService.updateClient(clientToEdit.id, payload)
                : ClientsService.createClient(payload);

              Components.toast(
                isEdit
                  ? `Ficha de "${saved.name}" actualizada.`
                  : `Cliente "${saved.name}" registrado exitosamente.`
              );
              close();
              if (typeof onSuccess === 'function') onSuccess(saved);
              global.ComerSys.App.refreshHeaderIndicators();
            } catch (err) {
              Components.toast(err.message, 'error');
            }
          };

          saveBtn.addEventListener('click', submit);
          form.addEventListener('submit', submit);
        }
      });
    },

    /**
     * Modal: "Detalle del cliente" (Ficha integral con Historial de compras, Cuotas, Pagos y Notas).
     */
    openClientDetailModal(clientId, onUpdated = null) {
      const self = this;
      let activeTab = 'compras'; // 'compras' | 'cuotas' | 'pagos' | 'notas'

      const modalInstance = Components.openModal({
        size: 'lg',
        headerHtml: `
          <div class="modal-title-group">
            <button type="button" class="icon-action-btn" data-modal-close title="Volver">
              ${Icons.get('arrowLeft')}
            </button>
            <h3 class="modal-title">Detalle del cliente</h3>
          </div>
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <button type="button" class="btn btn-sm btn-secondary" id="detail-edit-client-btn">
              ${Icons.get('edit')} Editar cliente
            </button>
            <button type="button" class="modal-close-btn" data-modal-close aria-label="Cerrar">
              ${Icons.get('close')}
            </button>
          </div>
        `,
        bodyHtml: `<div id="client-detail-dynamic-body"></div>`,
        onMount(modalEl, close) {
          const bodyContainer = modalEl.querySelector('#client-detail-dynamic-body');
          const editBtn = modalEl.querySelector('#detail-edit-client-btn');

          const renderInside = () => {
            const detail = ClientsService.getClientDetail(clientId);
            if (!detail) {
              close();
              return;
            }

            bodyContainer.innerHTML = `
              <div class="client-profile-header">
                <div class="client-avatar-lg">${Validators.escapeHtml(Formatters.initials(detail.name))}</div>
                <div class="client-profile-info" style="flex:1;">
                  <div style="display:flex;align-items:center;gap:0.65rem;flex-wrap:wrap;">
                    <h3>${Validators.escapeHtml(detail.name)}</h3>
                    ${Formatters.statusBadge(detail.status)}
                  </div>
                  <div class="client-profile-meta">
                    <span>${Icons.get('phone')} ${Validators.escapeHtml(detail.phone)}</span>
                    <span>${Icons.get('mapPin')} ${Validators.escapeHtml(detail.address)}</span>
                    ${
                      detail.documentId
                        ? `<span>Doc: ${Validators.escapeHtml(detail.documentId)}</span>`
                        : ''
                    }
                  </div>
                </div>
                ${
                  detail.pendingBalance > 0.009
                    ? `
                  <button type="button" class="btn btn-primary btn-sm" id="detail-register-pay-btn">
                    ${Icons.get('wallet')} Registrar Pago
                  </button>
                `
                    : ''
                }
              </div>

              <!-- 3 Indicadores clave del cliente -->
              <div class="client-kpis-3">
                <div class="client-kpi-box">
                  <div class="client-kpi-label">Total comprado</div>
                  <div class="client-kpi-val">${Formatters.currency(detail.totalBought)}</div>
                </div>
                <div class="client-kpi-box">
                  <div class="client-kpi-label">Total pagado</div>
                  <div class="client-kpi-val">${Formatters.currency(detail.totalPaid)}</div>
                </div>
                <div class="client-kpi-box ${detail.pendingBalance > 0.009 ? 'danger-highlight' : ''}">
                  <div class="client-kpi-label">Saldo pendiente</div>
                  <div class="client-kpi-val">${Formatters.currency(detail.pendingBalance)}</div>
                </div>
              </div>

              <!-- Pestañas de la ficha -->
              <div class="tabs-nav">
                <button type="button" class="tab-btn ${activeTab === 'compras' ? 'active' : ''}" data-tab="compras">
                  Historial de compras (${detail.sales.length})
                </button>
                <button type="button" class="tab-btn ${activeTab === 'cuotas' ? 'active' : ''}" data-tab="cuotas">
                  Cuotas y Deudas (${detail.installments.length})
                </button>
                <button type="button" class="tab-btn ${activeTab === 'pagos' ? 'active' : ''}" data-tab="pagos">
                  Pagos (${detail.payments.length})
                </button>
                <button type="button" class="tab-btn ${activeTab === 'notas' ? 'active' : ''}" data-tab="notas">
                  Notas (${detail.notesList.length})
                </button>
              </div>

              <div id="client-tab-panel">
                ${self._renderClientTabContent(detail, activeTab)}
              </div>
            `;

            // Cambiar de pestaña
            bodyContainer.querySelectorAll('[data-tab]').forEach((tabBtn) => {
              tabBtn.addEventListener('click', () => {
                activeTab = tabBtn.getAttribute('data-tab');
                renderInside();
              });
            });

            // Botón superior Registrar Pago
            const payTopBtn = bodyContainer.querySelector('#detail-register-pay-btn');
            if (payTopBtn) {
              payTopBtn.addEventListener('click', () => {
                global.ComerSys.Modules.Debts.openRegisterPaymentModal(
                  { clientId: detail.id },
                  () => {
                    renderInside();
                    if (typeof onUpdated === 'function') onUpdated();
                  }
                );
              });
            }

            // Botón cobrar cuota individual desde la pestaña Cuotas
            bodyContainer.querySelectorAll('[data-pay-installment]').forEach((btn) => {
              btn.addEventListener('click', () => {
                const debtId = Number(btn.getAttribute('data-debt-id'));
                const instId = Number(btn.getAttribute('data-pay-installment'));
                global.ComerSys.Modules.Debts.openRegisterPaymentModal(
                  { clientId: detail.id, debtId, installmentId: instId },
                  () => {
                    renderInside();
                    if (typeof onUpdated === 'function') onUpdated();
                  }
                );
              });
            });

            // Agregar Nota
            const noteForm = bodyContainer.querySelector('#client-add-note-form');
            if (noteForm) {
              noteForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const input = bodyContainer.querySelector('#client-new-note-input');
                try {
                  ClientsService.addClientNote(detail.id, input.value);
                  Components.toast('Nota guardada en la ficha del cliente.');
                  renderInside();
                } catch (err) {
                  Components.toast(err.message, 'error');
                }
              });
            }

            // Eliminar Nota
            bodyContainer.querySelectorAll('[data-delete-note]').forEach((btn) => {
              btn.addEventListener('click', () => {
                const nid = Number(btn.getAttribute('data-delete-note'));
                ClientsService.deleteClientNote(detail.id, nid);
                renderInside();
              });
            });
          };

          editBtn.addEventListener('click', () => {
            const detail = ClientsService.getClientDetail(clientId);
            if (!detail) return;
            self.openClientFormModal(detail, () => {
              renderInside();
              if (typeof onUpdated === 'function') onUpdated();
            });
          });

          renderInside();
        }
      });

      return modalInstance;
    },

    _renderClientTabContent(detail, activeTab) {
      if (activeTab === 'compras') {
        if (detail.sales.length === 0) {
          return `<div class="empty-state" style="padding:1.8rem;"><p class="text-muted">Este cliente aún no registra compras.</p></div>`;
        }
        return `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${detail.sales
                  .map(
                    (s) => `
                  <tr>
                    <td class="text-muted">${Formatters.date(s.date)}</td>
                    <td class="font-semibold">${Validators.escapeHtml(s.summaryConcept)}</td>
                    <td class="font-bold">${Formatters.currency(s.total)}</td>
                    <td>${Formatters.statusBadge(s.computedStatus)}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      if (activeTab === 'cuotas') {
        if (detail.installments.length === 0) {
          return `<div class="empty-state" style="padding:1.8rem;"><p class="text-muted">El cliente no tiene cuotas ni saldos financiados.</p></div>`;
        }
        return `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Cuota / Concepto</th>
                  <th>Vencimiento</th>
                  <th>Importe</th>
                  <th>Pagado</th>
                  <th>Pendiente</th>
                  <th>Estado</th>
                  <th class="text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                ${detail.installments
                  .map(
                    (inst) => `
                  <tr>
                    <td>
                      <div class="font-semibold">Cuota #${inst.number}/${inst.totalInstallments}</div>
                      <div class="text-muted" style="font-size:0.75rem;">${Validators.escapeHtml(inst.concept)}</div>
                    </td>
                    <td>${Formatters.date(inst.dueDate)}</td>
                    <td>${Formatters.currency(inst.amount)}</td>
                    <td class="text-success">${Formatters.currency(inst.paidAmount)}</td>
                    <td class="font-bold ${inst.pendingAmount > 0 ? 'text-danger' : ''}">${Formatters.currency(inst.pendingAmount)}</td>
                    <td>${Formatters.statusBadge(inst.status)}</td>
                    <td class="text-right">
                      ${
                        inst.pendingAmount > 0.009
                          ? `<button type="button" class="btn btn-sm btn-primary" data-pay-installment="${inst.id}" data-debt-id="${inst.debtId}">
                              Cobrar
                            </button>`
                          : `<span class="text-muted" style="font-size:0.78rem;">Pagada</span>`
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
      }

      if (activeTab === 'pagos') {
        if (detail.payments.length === 0) {
          return `<div class="empty-state" style="padding:1.8rem;"><p class="text-muted">No se han registrado pagos de este cliente todavía.</p></div>`;
        }
        return `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Método</th>
                  <th class="text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                ${detail.payments
                  .map(
                    (p) => `
                  <tr>
                    <td class="text-muted">${Formatters.date(p.date)}</td>
                    <td>${Validators.escapeHtml(p.notes || 'Pago registrado')}</td>
                    <td style="text-transform:capitalize;">${Validators.escapeHtml(p.paymentMethod)}</td>
                    <td class="text-right font-bold text-success">${Formatters.currency(p.amount)}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      // Pestaña Notas
      return `
        <form id="client-add-note-form" style="display:flex;gap:0.85rem;margin-bottom:1.15rem;">
          <input
            type="text"
            class="form-control"
            id="client-new-note-input"
            placeholder="Escribir una nueva nota u observación para este cliente..."
          />
          <button type="submit" class="btn btn-primary">Guardar nota</button>
        </form>
        ${
          detail.notesList.length === 0
            ? `<p class="text-muted" style="font-size:0.85rem;padding:0.5rem 0;">Sin notas registradas.</p>`
            : `<div style="display:flex;flex-direction:column;gap:0.55rem;">
                ${detail.notesList
                  .map(
                    (n) => `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;background:var(--bg-surface-subtle);border:1px solid var(--border-color);border-radius:var(--radius-sm);">
                    <div>
                      <div style="font-size:0.87rem;color:var(--text-primary);">${Validators.escapeHtml(n.text)}</div>
                      <div style="font-size:0.74rem;color:var(--text-muted);margin-top:2px;">${Formatters.date(n.date)}</div>
                    </div>
                    <button type="button" class="icon-action-btn danger" data-delete-note="${n.id}" title="Eliminar nota">
                      ${Icons.get('trash')}
                    </button>
                  </div>
                `
                  )
                  .join('')}
              </div>`
        }
      `;
    }
  };

  global.ComerSys.Modules.Clients = ClientsModule;
})(window);
