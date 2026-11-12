/**
 * ============================================================================
 * COMERSYS — SISTEMA DE MODALES APILABLES, CONFIRMACIONES Y NOTIFICACIONES
 * ============================================================================
 */
(function (global) {
  'use strict';

  const { Validators } = global.ComerSys.Core;
  const { Icons } = global.ComerSys.UI;

  const Components = {
    _modalStack: [],

    /**
     * Muestra una notificación Toast discreta, fluida y con icono semántico.
     */
    toast(message, type = 'success', duration = 3400) {
      let container = document.getElementById('comersys-toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'comersys-toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
      }

      const iconMap = {
        success: Icons.get('check'),
        error: Icons.get('alertTriangle'),
        warning: Icons.get('alertTriangle'),
        info: Icons.get('receipt')
      };

      const toastEl = document.createElement('div');
      toastEl.className = `toast toast-${type}`;
      toastEl.innerHTML = `
        <div class="toast-icon-badge">${iconMap[type] || iconMap.info}</div>
        <div class="toast-content">${Validators.escapeHtml(message)}</div>
        <button type="button" class="modal-close-btn" style="width:22px;height:22px;" aria-label="Cerrar">
          ${Icons.get('close')}
        </button>
      `;

      const closeBtn = toastEl.querySelector('button');
      let isRemoved = false;
      const removeToast = () => {
        if (isRemoved) return;
        isRemoved = true;
        toastEl.classList.add('toast-leaving');
        setTimeout(() => {
          if (toastEl.parentNode) {
            toastEl.parentNode.removeChild(toastEl);
          }
        }, 180);
      };
      closeBtn.addEventListener('click', removeToast);

      container.appendChild(toastEl);
      if (duration > 0) {
        setTimeout(removeToast, duration);
      }
    },

    /**
     * Abre una ventana modal profesional. Soporta apilamiento (ej. crear cliente dentro del asistente de venta).
     */
    openModal(options = {}) {
      const {
        title = '',
        size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
        headerHtml = null,
        subHeaderHtml = '',
        bodyHtml = '',
        footerHtml = '',
        onMount = null,
        onClose = null
      } = options;

      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.style.zIndex = String(200 + this._modalStack.length * 10);

      const headerContent = headerHtml
        ? headerHtml
        : `
          <div class="modal-title-group">
            <h3 class="modal-title">${Validators.escapeHtml(title)}</h3>
          </div>
          <button type="button" class="modal-close-btn" data-modal-close aria-label="Cerrar">
            ${Icons.get('close')}
          </button>
        `;

      backdrop.innerHTML = `
        <div class="modal-dialog modal-${size}" role="dialog" aria-modal="true">
          <div class="modal-header">${headerContent}</div>
          ${subHeaderHtml ? `<div class="modal-subheader">${subHeaderHtml}</div>` : ''}
          <div class="modal-body">${bodyHtml}</div>
          ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
        </div>
      `;

      document.body.appendChild(backdrop);

      const close = () => {
        backdrop.classList.remove('open');
        const idx = this._modalStack.indexOf(modalInstance);
        if (idx !== -1) this._modalStack.splice(idx, 1);
        setTimeout(() => {
          if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
          if (typeof onClose === 'function') onClose();
        }, 180);
      };

      const modalInstance = { backdrop, close };
      this._modalStack.push(modalInstance);

      backdrop.querySelectorAll('[data-modal-close]').forEach((btn) => {
        btn.addEventListener('click', close);
      });

      backdrop.addEventListener('mousedown', (e) => {
        if (e.target === backdrop) {
          close();
        }
      });

      requestAnimationFrame(() => {
        backdrop.classList.add('open');
      });

      if (typeof onMount === 'function') {
        onMount(backdrop, close);
      }

      return modalInstance;
    },

    /**
     * Cierra el modal superior activo.
     */
    closeTopModal() {
      if (this._modalStack.length > 0) {
        const top = this._modalStack[this._modalStack.length - 1];
        top.close();
      }
    },

    /**
     * Cuadro de confirmación empresarial antes de acciones críticas (ej. eliminar o reiniciar).
     */
    confirm({
      title = 'Confirmar operación',
      message = '¿Está seguro de que desea continuar?',
      confirmText = 'Confirmar',
      cancelText = 'Cancelar',
      danger = false,
      onConfirm
    }) {
      return this.openModal({
        title,
        size: 'sm',
        bodyHtml: `
          <div style="display:flex;align-items:flex-start;gap:0.95rem;">
            <div class="kpi-icon-box ${danger ? 'red' : 'blue'}" style="width:30px;height:30px;">
              ${Icons.get(danger ? 'alertTriangle' : 'check')}
            </div>
            <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.55;flex:1;padding-top:0.15rem;">
              ${Validators.escapeHtml(message)}
            </p>
          </div>
        `,
        footerHtml: `
          <button type="button" class="btn btn-secondary" data-modal-close>${Validators.escapeHtml(cancelText)}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm-action-btn">${Validators.escapeHtml(confirmText)}</button>
        `,
        onMount(modalEl, close) {
          const btn = modalEl.querySelector('#modal-confirm-action-btn');
          if (btn) {
            btn.addEventListener('click', () => {
              close();
              if (typeof onConfirm === 'function') onConfirm();
            });
          }
        }
      });
    },

    /**
     * Renderiza controles de paginación para tablas.
     */
    renderPagination(totalItems, currentPage, pageSize = 8) {
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const safePage = Math.min(Math.max(1, currentPage), totalPages);
      const startIdx = (safePage - 1) * pageSize;
      const endIdx = Math.min(startIdx + pageSize, totalItems);

      let buttonsHtml = `
        <button type="button" class="page-btn" data-page="${safePage - 1}" ${safePage <= 1 ? 'disabled' : ''} aria-label="Página anterior">
          ${Icons.get('chevronLeft')}
        </button>
      `;

      for (let p = 1; p <= totalPages; p++) {
        buttonsHtml += `
          <button type="button" class="page-btn ${p === safePage ? 'active' : ''}" data-page="${p}">
            ${p}
          </button>
        `;
      }

      buttonsHtml += `
        <button type="button" class="page-btn" data-page="${safePage + 1}" ${safePage >= totalPages ? 'disabled' : ''} aria-label="Página siguiente">
          ${Icons.get('chevronRight')}
        </button>
      `;

      return {
        safePage,
        startIdx,
        endIdx,
        html:
          totalItems > 0
            ? `
          <div class="table-footer">
            <span>Mostrando <strong>${startIdx + 1}–${endIdx}</strong> de <strong>${totalItems}</strong> registro(s)</span>
            <div class="pagination">${buttonsHtml}</div>
          </div>
        `
            : ''
      };
    }
  };

  global.ComerSys.UI.Components = Components;
})(window);
