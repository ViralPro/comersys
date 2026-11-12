/**
 * ============================================================================
 * COMERSYS — MÓDULOS 2, 3 Y 4: INVENTARIO DINÁMICO, GRUPOS Y PRODUCTOS
 * ============================================================================
 * - Los grupos se crean dinámicamente desde el sistema.
 * - Lista vertical profesional de grupos.
 * - Al entrar en un grupo: tabla con todos sus productos (Nombre, Código,
 *   Stock, Precio de compra, Precio de venta, Ganancia, Acciones).
 * - Modal directo de "Registrar salida de producto" conectado a Ventas.
 */
(function (global) {
  'use strict';

  const { Validators, Formatters } = global.ComerSys.Core;
  const { InventoryService, AuthService } = global.ComerSys.Services;
  const { Icons, Components } = global.ComerSys.UI;

  const InventoryModule = {
    state: {
      activeGroupId: null,
      groupSearch: '',
      productSearch: '',
      currentPage: 1,
      pageSize: 8
    },

    /**
     * Permite abrir directamente un grupo desde el buscador global.
     */
    openGroup(groupId) {
      this.state.activeGroupId = Number(groupId);
      this.state.productSearch = '';
      this.state.currentPage = 1;
      global.ComerSys.App.navigate('inventory');
    },

    render(container) {
      if (this.state.activeGroupId !== null) {
        const group = InventoryService.getGroupById(this.state.activeGroupId);
        if (!group) {
          this.state.activeGroupId = null;
        } else {
          this._renderGroupProductsView(container, group);
          return;
        }
      }
      this._renderGroupsListView(container);
    },

    /**
     * Vista 1: Lista vertical profesional de Grupos Dinámicos.
     */
    _renderGroupsListView(container) {
      const groups = InventoryService.getGroups(this.state.groupSearch);
      const allGroupsCount = InventoryService.getGroups().length;

      container.innerHTML = `
        <div class="page-header">
          <div class="page-header-titles">
            <h1>Inventario</h1>
            <p>Gestiona tus grupos y productos</p>
          </div>
          <div class="page-header-actions">
            ${
              allGroupsCount > 0
                ? `<button type="button" class="btn btn-secondary" id="inv-new-product-top-btn">
                    ${Icons.get('plus')} Nuevo Producto
                  </button>`
                : ''
            }
            <button type="button" class="btn btn-primary" id="inv-new-group-btn">
              ${Icons.get('plus')} Nuevo Grupo
            </button>
          </div>
        </div>

        <div class="card">
          <div class="toolbar-row">
            <div class="search-box">
              ${Icons.get('search')}
              <input
                type="search"
                id="inv-group-search-input"
                placeholder="Buscar grupo o producto..."
                value="${Validators.escapeHtml(this.state.groupSearch)}"
              />
            </div>
            <div class="text-muted" style="font-size:0.83rem;">
              <strong>${groups.length}</strong> grupo(s) disponible(s)
            </div>
          </div>

          <div class="groups-vertical-list" id="inv-groups-list">
            ${
              groups.length === 0
                ? `
                  <div class="empty-state">
                    <div class="empty-state-title">
                      ${
                        this.state.groupSearch
                          ? 'No se encontraron grupos para tu búsqueda'
                          : 'Aún no has creado ningún grupo de inventario'
                      }
                    </div>
                    <p class="empty-state-desc">
                      Los grupos te permiten organizar tus productos por categoría (por ejemplo: Grupo de teléfonos, Grupo de cocina).
                    </p>
                    <button type="button" class="btn btn-primary" id="inv-empty-create-group-btn">
                      ${Icons.get('plus')} Crear primer grupo
                    </button>
                  </div>
                `
                : groups
                    .map(
                      (g) => `
                  <div class="group-list-item" data-enter-group="${g.id}">
                    <div class="group-item-left">
                      <div class="kpi-icon-box blue">${Icons.get('layers')}</div>
                      <div class="group-item-info">
                        <div class="group-item-name">${Validators.escapeHtml(g.name)}</div>
                        <div class="group-item-meta">
                          ${g.productCount} ${g.productCount === 1 ? 'producto' : 'productos'}${g.description ? ` · ${Validators.escapeHtml(g.description)}` : ''}
                        </div>
                      </div>
                    </div>
                    <div class="group-item-right">
                      <div class="action-btn-group" data-stop-propagation>
                        <button type="button" class="btn btn-sm btn-secondary" data-enter-group-btn="${g.id}">
                          Ver productos ${Icons.get('chevronRight')}
                        </button>
                        <button type="button" class="icon-action-btn" data-edit-group="${g.id}" title="Editar grupo">
                          ${Icons.get('edit')}
                        </button>
                        <button type="button" class="icon-action-btn danger" data-delete-group="${g.id}" title="Eliminar grupo">
                          ${Icons.get('trash')}
                        </button>
                      </div>
                    </div>
                  </div>
                `
                    )
                    .join('')
            }
          </div>
        </div>
      `;

      // Búsqueda en vivo de grupos
      const searchInput = container.querySelector('#inv-group-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.state.groupSearch = e.target.value;
          this.render(container);
          const refocused = container.querySelector('#inv-group-search-input');
          if (refocused) {
            refocused.focus();
            refocused.setSelectionRange(refocused.value.length, refocused.value.length);
          }
        });
      }

      const newGroupBtn = container.querySelector('#inv-new-group-btn');
      if (newGroupBtn) {
        newGroupBtn.addEventListener('click', () => this.openGroupModal( null, () => this.render(container) ));
      }

      const emptyNewGroupBtn = container.querySelector('#inv-empty-create-group-btn');
      if (emptyNewGroupBtn) {
        emptyNewGroupBtn.addEventListener('click', () => this.openGroupModal( null, () => this.render(container) ));
      }

      const newProductTopBtn = container.querySelector('#inv-new-product-top-btn');
      if (newProductTopBtn) {
        newProductTopBtn.addEventListener('click', () =>
          this.openProductModal({ groupId: groups[0] ? groups[0].id : null }, () => this.render(container))
        );
      }

      // Entrar a un grupo
      container.querySelectorAll('[data-enter-group]').forEach((row) => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('[data-stop-propagation]')) return;
          this.state.activeGroupId = Number(row.getAttribute('data-enter-group'));
          this.state.productSearch = '';
          this.state.currentPage = 1;
          this.render(container);
        });
      });

      container.querySelectorAll('[data-enter-group-btn]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.state.activeGroupId = Number(btn.getAttribute('data-enter-group-btn'));
          this.state.productSearch = '';
          this.state.currentPage = 1;
          this.render(container);
        });
      });

      // Editar grupo
      container.querySelectorAll('[data-edit-group]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const gid = Number(btn.getAttribute('data-edit-group'));
          const grp = InventoryService.getGroupById(gid);
          if (grp) this.openGroupModal(grp, () => this.render(container));
        });
      });

      // Eliminar grupo
      container.querySelectorAll('[data-delete-group]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const gid = Number(btn.getAttribute('data-delete-group'));
          const grp = InventoryService.getGroupById(gid);
          if (!grp) return;
          Components.confirm({
            title: 'Eliminar grupo',
            message: `¿Desea eliminar el grupo "${grp.name}"?`,
            confirmText: 'Eliminar',
            danger: true,
            onConfirm: () => {
              try {
                InventoryService.deleteGroup(gid);
                Components.toast(`Grupo "${grp.name}" eliminado.`);
                this.render(container);
              } catch (err) {
                Components.toast(err.message, 'error');
              }
            }
          });
        });
      });
    },

    /**
     * Vista 2: Tabla de productos dentro de un grupo.
     */
    _renderGroupProductsView(container, group) {
      const settings = AuthService.getSettings();
      const allGroupProducts = InventoryService.getProducts(group.id, '');
      const filteredProducts = InventoryService.getProducts(group.id, this.state.productSearch);
      const pagination = Components.renderPagination(
        filteredProducts.length,
        this.state.currentPage,
        this.state.pageSize
      );
      this.state.currentPage = pagination.safePage;
      const pageItems = filteredProducts.slice(pagination.startIdx, pagination.endIdx);

      container.innerHTML = `
        <div class="page-header">
          <div class="page-header-titles">
            <h1>${Validators.escapeHtml(group.name)}</h1>
            <p>${allGroupProducts.length} ${allGroupProducts.length === 1 ? 'producto registrado en este grupo' : 'productos registrados en este grupo'}</p>
          </div>
          <div class="page-header-actions">
            <button type="button" class="btn btn-secondary" id="inv-back-to-groups-btn">
              ${Icons.get('chevronLeft')} Volver a Grupos
            </button>
            <button type="button" class="btn btn-primary" id="inv-add-product-btn">
              ${Icons.get('plus')} Agregar Producto
            </button>
          </div>
        </div>

        <div class="card">
          <div class="toolbar-row">
            <div class="search-box">
              ${Icons.get('search')}
              <input
                type="search"
                id="inv-product-search-input"
                placeholder="Buscar producto por nombre o código..."
                value="${Validators.escapeHtml(this.state.productSearch)}"
              />
            </div>
            <div class="text-muted" style="font-size:0.84rem;">
              Usa el botón de salida en las acciones para vender un producto directamente
            </div>
          </div>

          <div class="table-responsive">
            ${
              pageItems.length === 0
                ? `
                  <div class="empty-state">
                    <div class="empty-state-icon">${Icons.get('box')}</div>
                    <div class="empty-state-title">
                      ${
                        this.state.productSearch
                          ? 'No hay productos que coincidan con la búsqueda'
                          : `El grupo "${Validators.escapeHtml(group.name)}" aún no tiene productos`
                      }
                    </div>
                    <p class="empty-state-desc">
                      Registra productos indicando código, stock inicial, precio de compra y precio de venta para calcular la ganancia automáticamente.
                    </p>
                    <button type="button" class="btn btn-primary" id="inv-empty-add-product-btn">
                      ${Icons.get('plus')} Agregar Producto
                    </button>
                  </div>
                `
                : `
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Código</th>
                        <th>Stock</th>
                        <th class="text-right">Compra</th>
                        <th class="text-right">Venta</th>
                        <th class="text-right">Ganancia</th>
                        <th class="text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${pageItems
                        .map((p) => {
                          const isOut = p.stock <= 0;
                          const isLow = !isOut && p.stock <= settings.lowStockThreshold;
                          const stockBadge = isOut
                            ? `<span class="badge badge-danger">0 (Sin stock)</span>`
                            : isLow
                            ? `<span class="badge badge-warning">${p.stock} (Bajo)</span>`
                            : `<span class="font-bold">${p.stock}</span>`;

                          return `
                            <tr>
                              <td class="font-semibold">${Validators.escapeHtml(p.name)}</td>
                              <td class="font-mono text-muted" style="font-size:0.82rem;">${Validators.escapeHtml(p.code)}</td>
                              <td>${stockBadge}</td>
                              <td class="text-right">${Formatters.currency(p.purchasePrice)}</td>
                              <td class="text-right font-semibold">${Formatters.currency(p.salePrice)}</td>
                              <td class="text-right ${p.profit >= 0 ? 'text-success' : 'text-danger'} font-semibold">
                                ${Formatters.currency(p.profit)}
                              </td>
                              <td class="text-right">
                                <div class="action-btn-group">
                                  <button
                                    type="button"
                                    class="icon-action-btn primary"
                                    data-quick-sale="${p.id}"
                                    title="Registrar salida / Vender producto"
                                    ${isOut ? 'disabled' : ''}
                                  >
                                    ${Icons.get('outflow')}
                                  </button>
                                  <button
                                    type="button"
                                    class="icon-action-btn success"
                                    data-restock-product="${p.id}"
                                    title="Ingresar / Reponer stock"
                                  >
                                    ${Icons.get('restock')}
                                  </button>
                                  <button
                                    type="button"
                                    class="icon-action-btn"
                                    data-edit-product="${p.id}"
                                    title="Editar producto"
                                  >
                                    ${Icons.get('edit')}
                                  </button>
                                  <button
                                    type="button"
                                    class="icon-action-btn danger"
                                    data-delete-product="${p.id}"
                                    title="Eliminar producto"
                                  >
                                    ${Icons.get('trash')}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          `;
                        })
                        .join('')}
                    </tbody>
                  </table>
                `
            }
          </div>

          ${pagination.html}
        </div>
      `;

      // Volver a la lista de grupos
      const backBtn = container.querySelector('#inv-back-to-groups-btn');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          this.state.activeGroupId = null;
          this.render(container);
        });
      }

      // Buscar producto
      const searchInput = container.querySelector('#inv-product-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.state.productSearch = e.target.value;
          this.state.currentPage = 1;
          this.render(container);
          const refocused = container.querySelector('#inv-product-search-input');
          if (refocused) {
            refocused.focus();
            refocused.setSelectionRange(refocused.value.length, refocused.value.length);
          }
        });
      }

      // Agregar producto
      const addBtn = container.querySelector('#inv-add-product-btn');
      if (addBtn) {
        addBtn.addEventListener('click', () =>
          this.openProductModal({ groupId: group.id }, () => this.render(container))
        );
      }

      const emptyAddBtn = container.querySelector('#inv-empty-add-product-btn');
      if (emptyAddBtn) {
        emptyAddBtn.addEventListener('click', () =>
          this.openProductModal({ groupId: group.id }, () => this.render(container))
        );
      }

      // Paginación
      container.querySelectorAll('[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.state.currentPage = Number(btn.getAttribute('data-page'));
          this.render(container);
        });
      });

      // Salida rápida de producto ("Registrar salida de producto")
      container.querySelectorAll('[data-quick-sale]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pid = Number(btn.getAttribute('data-quick-sale'));
          this.openProductOutflowModal(pid, () => this.render(container));
        });
      });

      // Reposición de stock
      container.querySelectorAll('[data-restock-product]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pid = Number(btn.getAttribute('data-restock-product'));
          this.openRestockModal(pid, () => this.render(container));
        });
      });

      // Editar producto
      container.querySelectorAll('[data-edit-product]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pid = Number(btn.getAttribute('data-edit-product'));
          const prod = InventoryService.getProductById(pid);
          if (prod) this.openProductModal(prod, () => this.render(container));
        });
      });

      // Eliminar producto
      container.querySelectorAll('[data-delete-product]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pid = Number(btn.getAttribute('data-delete-product'));
          const prod = InventoryService.getProductById(pid);
          if (!prod) return;
          Components.confirm({
            title: 'Eliminar producto',
            message: `¿Confirmas eliminar el producto "${prod.name}" (${prod.code}) del inventario?`,
            confirmText: 'Eliminar producto',
            danger: true,
            onConfirm: () => {
              try {
                InventoryService.deleteProduct(pid);
                Components.toast(`Producto "${prod.name}" eliminado.`);
                this.render(container);
              } catch (err) {
                Components.toast(err.message, 'error');
              }
            }
          });
        });
      });
    },

    /**
     * Modal: Crear o Editar Grupo Dinámico.
     */
    openGroupModal(groupToEdit = null, onSuccess = null) {
      const isEdit = Boolean(groupToEdit && groupToEdit.id);

      Components.openModal({
        title: isEdit ? 'Editar Grupo' : 'Nuevo Grupo de Inventario',
        size: 'sm',
        bodyHtml: `
          <form id="group-modal-form" novalidate>
            <div class="form-group">
              <label class="form-label">Nombre del grupo <span class="required">*</span></label>
              <input
                type="text"
                class="form-control"
                id="group-name-input"
                placeholder="Ej. Grupo de teléfonos, Grupo de cocina..."
                value="${Validators.escapeHtml(isEdit ? groupToEdit.name : '')}"
                required
              />
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">Descripción (opcional)</label>
              <input
                type="text"
                class="form-control"
                id="group-desc-input"
                placeholder="Breve nota sobre este grupo"
                value="${Validators.escapeHtml(isEdit ? groupToEdit.description || '' : '')}"
              />
            </div>
          </form>
        `,
        footerHtml: `
          <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
          <button type="button" class="btn btn-primary" id="group-save-btn">
            ${isEdit ? 'Guardar cambios' : 'Crear Grupo'}
          </button>
        `,
        onMount(modalEl, close) {
          const nameInput = modalEl.querySelector('#group-name-input');
          const descInput = modalEl.querySelector('#group-desc-input');
          const saveBtn = modalEl.querySelector('#group-save-btn');
          const form = modalEl.querySelector('#group-modal-form');

          setTimeout(() => nameInput && nameInput.focus(), 60);

          const submit = (e) => {
            if (e) e.preventDefault();
            try {
              const payload = {
                name: nameInput.value,
                description: descInput.value
              };
              const saved = isEdit
                ? InventoryService.updateGroup(groupToEdit.id, payload)
                : InventoryService.createGroup(payload);

              Components.toast(
                isEdit ? `Grupo "${saved.name}" actualizado.` : `Grupo "${saved.name}" creado correctamente.`
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
     * Modal: Registrar o Editar Producto (con cálculo en vivo de Ganancia y Margen).
     */
    openProductModal(productOrDefaults = {}, onSuccess = null) {
      const isEdit = Boolean(productOrDefaults && productOrDefaults.id);
      const groups = InventoryService.getGroups();

      if (groups.length === 0) {
        Components.toast('Primero debe crear al menos un grupo de inventario.', 'warning');
        this.openGroupModal(null, (createdGroup) => {
          this.openProductModal({ groupId: createdGroup.id }, onSuccess);
        });
        return;
      }

      const selectedGroupId = Number(productOrDefaults.groupId || groups[0].id);
      const suggestedCode = isEdit
        ? productOrDefaults.code
        : InventoryService.suggestProductCode(selectedGroupId);

      Components.openModal({
        title: isEdit ? `Editar Producto: ${productOrDefaults.name}` : 'Registrar Producto',
        size: 'md',
        bodyHtml: `
          <form id="product-modal-form" novalidate>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Grupo <span class="required">*</span></label>
                <select class="form-control" id="prod-group-select" required>
                  ${groups
                    .map(
                      (g) =>
                        `<option value="${g.id}" ${Number(g.id) === selectedGroupId ? 'selected' : ''}>${Validators.escapeHtml(g.name)}</option>`
                    )
                    .join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Código <span class="required">*</span></label>
                <input
                  type="text"
                  class="form-control font-mono"
                  id="prod-code-input"
                  value="${Validators.escapeHtml(suggestedCode)}"
                  placeholder="Ej. HT-001"
                  required
                />
              </div>
              <div class="form-group full-width">
                <label class="form-label">Nombre del producto <span class="required">*</span></label>
                <input
                  type="text"
                  class="form-control"
                  id="prod-name-input"
                  value="${Validators.escapeHtml(isEdit ? productOrDefaults.name : '')}"
                  placeholder="Ej. Martillo profesional, Taladro percutor, Llave inglesa..."
                  required
                />
              </div>
              <div class="form-group">
                <label class="form-label">Stock ${isEdit ? 'actual' : 'inicial'} <span class="required">*</span></label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  class="form-control"
                  id="prod-stock-input"
                  value="${isEdit ? Number(productOrDefaults.stock) : 1}"
                  required
                />
              </div>
              <div class="form-group">
                <label class="form-label">Precio de compra <span class="required">*</span></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control"
                  id="prod-purchase-input"
                  value="${isEdit ? productOrDefaults.purchasePrice : ''}"
                  placeholder="0.00"
                  required
                />
              </div>
              <div class="form-group">
                <label class="form-label">Precio de venta <span class="required">*</span></label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  class="form-control"
                  id="prod-sale-input"
                  value="${isEdit ? productOrDefaults.salePrice : ''}"
                  placeholder="0.00"
                  required
                />
              </div>
              <div class="form-group">
                <label class="form-label">Ganancia unitaria calculada</label>
                <input
                  type="text"
                  class="form-control font-bold"
                  id="prod-profit-preview"
                  readonly
                  style="background:var(--bg-surface-subtle);"
                  value="$0"
                />
              </div>
            </div>
          </form>
        `,
        footerHtml: `
          <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
          <button type="button" class="btn btn-primary" id="prod-save-btn">
            ${isEdit ? 'Guardar cambios' : 'Registrar Producto'}
          </button>
        `,
        onMount(modalEl, close) {
          const groupSelect = modalEl.querySelector('#prod-group-select');
          const codeInput = modalEl.querySelector('#prod-code-input');
          const nameInput = modalEl.querySelector('#prod-name-input');
          const stockInput = modalEl.querySelector('#prod-stock-input');
          const purchaseInput = modalEl.querySelector('#prod-purchase-input');
          const saleInput = modalEl.querySelector('#prod-sale-input');
          const profitPreview = modalEl.querySelector('#prod-profit-preview');
          const saveBtn = modalEl.querySelector('#prod-save-btn');
          const form = modalEl.querySelector('#product-modal-form');

          const updateProfitPreview = () => {
            const buy = Number(purchaseInput.value) || 0;
            const sell = Number(saleInput.value) || 0;
            const profit = Validators.roundCurrency(sell - buy);
            const pct = buy > 0 ? Math.round(((sell - buy) / buy) * 100) : 0;
            profitPreview.value = `${Formatters.currency(profit)} (${pct >= 0 ? '+' : ''}${pct}%)`;
            profitPreview.style.color = profit >= 0 ? 'var(--success-600)' : 'var(--danger-600)';
          };

          purchaseInput.addEventListener('input', updateProfitPreview);
          saleInput.addEventListener('input', updateProfitPreview);
          updateProfitPreview();

          if (!isEdit) {
            groupSelect.addEventListener('change', () => {
              codeInput.value = InventoryService.suggestProductCode(Number(groupSelect.value));
            });
          }

          setTimeout(() => nameInput && nameInput.focus(), 60);

          const submit = (e) => {
            if (e) e.preventDefault();
            try {
              const payload = {
                groupId: Number(groupSelect.value),
                code: codeInput.value,
                name: nameInput.value,
                stock: Number(stockInput.value),
                purchasePrice: Number(purchaseInput.value),
                salePrice: Number(saleInput.value)
              };

              const saved = isEdit
                ? InventoryService.updateProduct(productOrDefaults.id, payload)
                : InventoryService.createProduct(payload);

              Components.toast(
                isEdit
                  ? `Producto "${saved.name}" actualizado.`
                  : `Producto "${saved.name}" registrado en el inventario.`
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
     * Modal: Reponer / Ingresar compra de stock de un producto existente.
     */
    openRestockModal(productId, onSuccess = null) {
      const product = InventoryService.getProductById(productId);
      if (!product) return;

      Components.openModal({
        title: 'Ingresar / Reponer Stock',
        size: 'sm',
        bodyHtml: `
          <div class="product-summary-banner">
            <div>
              <div class="font-bold">${Validators.escapeHtml(product.name)}</div>
              <div class="text-muted" style="font-size:0.78rem;">
                Código: ${Validators.escapeHtml(product.code)} &nbsp;|&nbsp; Stock actual: <strong>${product.stock}</strong>
              </div>
            </div>
          </div>

          <form id="restock-form" novalidate>
            <div class="form-group">
              <label class="form-label">Cantidad de unidades a sumar <span class="required">*</span></label>
              <input type="number" min="1" step="1" class="form-control" id="restock-qty-input" value="1" required />
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Costo de compra unit.</label>
                <input type="number" min="0" step="0.01" class="form-control" id="restock-cost-input" value="${product.purchasePrice}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Precio de venta unit.</label>
                <input type="number" min="0.01" step="0.01" class="form-control" id="restock-sale-input" value="${product.salePrice}" required />
              </div>
            </div>
          </form>
        `,
        footerHtml: `
          <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
          <button type="button" class="btn btn-primary" id="restock-confirm-btn">Confirmar ingreso</button>
        `,
        onMount(modalEl, close) {
          const qtyInput = modalEl.querySelector('#restock-qty-input');
          const costInput = modalEl.querySelector('#restock-cost-input');
          const saleInput = modalEl.querySelector('#restock-sale-input');
          const confirmBtn = modalEl.querySelector('#restock-confirm-btn');

          const submit = (e) => {
            if (e) e.preventDefault();
            try {
              const updated = InventoryService.restockProduct(product.id, {
                quantity: Number(qtyInput.value),
                purchasePrice: Number(costInput.value),
                salePrice: Number(saleInput.value),
                recordPurchase: true
              });
              Components.toast(`Stock de "${updated.name}" actualizado a ${updated.stock} unidades.`);
              close();
              if (typeof onSuccess === 'function') onSuccess(updated);
              global.ComerSys.App.refreshHeaderIndicators();
            } catch (err) {
              Components.toast(err.message, 'error');
            }
          };

          confirmBtn.addEventListener('click', submit);
          modalEl.querySelector('#restock-form').addEventListener('submit', submit);
        }
      });
    },

    /**
     * Modal: "Registrar salida de producto" (Diseño exacto de la referencia visual).
     * Permite elegir la cantidad a vender y cómo realiza el pago (Pago completo,
     * Pago una parte, Pagará en cuotas) conectándose directamente al asistente de venta.
     */
    openProductOutflowModal(productId, onCompleted = null) {
      const product = InventoryService.getProductById(productId);
      if (!product) return;

      if (product.stock <= 0) {
        Components.toast(`El producto "${product.name}" no tiene stock disponible.`, 'warning');
        return;
      }

      let selectedQty = 1;
      let selectedMode = 'completo'; // 'completo' | 'parcial' | 'cuotas'

      Components.openModal({
        title: 'Registrar salida de producto',
        size: 'sm',
        bodyHtml: `
          <div class="product-summary-banner">
            <div>
              <div class="font-bold" style="font-size:0.96rem;">${Validators.escapeHtml(product.name)}</div>
              <div class="text-muted" style="font-size:0.79rem;">
                Código: ${Validators.escapeHtml(product.code)} &nbsp;·&nbsp; Stock actual: <strong>${product.stock}</strong> &nbsp;·&nbsp; ${Formatters.currency(product.salePrice)} c/u
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Cantidad a vender</label>
            <div class="qty-stepper-control">
              <button type="button" class="qty-stepper-btn" id="outflow-qty-minus">−</button>
              <input
                type="number"
                class="qty-stepper-input"
                id="outflow-qty-input"
                min="1"
                max="${product.stock}"
                value="1"
              />
              <button type="button" class="qty-stepper-btn" id="outflow-qty-plus">+</button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">¿Cómo realiza el pago?</label>
            <div class="payment-mode-options">
              <div class="payment-mode-card mode-full selected" data-mode="completo">
                <div class="payment-mode-radio">${Icons.get('check')}</div>
                <div>
                  <div class="payment-mode-title">Pago completo</div>
                  <div class="payment-mode-desc">Se registra la venta como pagada.</div>
                </div>
              </div>

              <div class="payment-mode-card mode-partial" data-mode="parcial">
                <div class="payment-mode-radio"></div>
                <div>
                  <div class="payment-mode-title">Pago una parte</div>
                  <div class="payment-mode-desc">Se registra el importe entregado y queda un saldo pendiente.</div>
                </div>
              </div>

              <div class="payment-mode-card mode-installments" data-mode="cuotas">
                <div class="payment-mode-radio"></div>
                <div>
                  <div class="payment-mode-title">Pagará en cuotas</div>
                  <div class="payment-mode-desc">Se genera una cuenta con vencimientos y cuotas.</div>
                </div>
              </div>
            </div>
          </div>
        `,
        footerHtml: `
          <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
          <button type="button" class="btn btn-primary" id="outflow-confirm-btn">Confirmar</button>
        `,
        onMount(modalEl, close) {
          const minusBtn = modalEl.querySelector('#outflow-qty-minus');
          const plusBtn = modalEl.querySelector('#outflow-qty-plus');
          const qtyInput = modalEl.querySelector('#outflow-qty-input');
          const modeCards = modalEl.querySelectorAll('.payment-mode-card');
          const confirmBtn = modalEl.querySelector('#outflow-confirm-btn');

          const syncQty = (val) => {
            const parsed = Math.max(1, Math.min(product.stock, parseInt(val, 10) || 1));
            selectedQty = parsed;
            qtyInput.value = parsed;
          };

          minusBtn.addEventListener('click', () => syncQty(selectedQty - 1));
          plusBtn.addEventListener('click', () => syncQty(selectedQty + 1));
          qtyInput.addEventListener('change', () => syncQty(qtyInput.value));

          modeCards.forEach((card) => {
            card.addEventListener('click', () => {
              selectedMode = card.getAttribute('data-mode');
              modeCards.forEach((c) => {
                c.classList.remove('selected');
                c.querySelector('.payment-mode-radio').innerHTML = '';
              });
              card.classList.add('selected');
              card.querySelector('.payment-mode-radio').innerHTML = Icons.get('check');
            });
          });

          confirmBtn.addEventListener('click', () => {
            syncQty(qtyInput.value);
            close();
            // Abre el Asistente de Venta precargado con el producto, cantidad y modalidad elegida
            global.ComerSys.Modules.Sales.openSaleWizard({
              initialItems: [{ productId: product.id, quantity: selectedQty }],
              paymentMode: selectedMode,
              startStep: selectedMode === 'completo' ? 3 : 2,
              onSaleConfirmed: onCompleted
            });
          });
        }
      });
    }
  };

  global.ComerSys.Modules.Inventory = InventoryModule;
})(window);
