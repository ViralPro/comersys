/**
 * ============================================================================
 * COMERSYS CENTRAL ADMIN — CONTROLADOR DEL PANEL GENERAL (ADMINISTRADOR GENERAL)
 * ============================================================================
 * Diseño Empresarial Profesional: Cero emojis, Iconografía SVG vectorial estricta,
 * Vistas integradas de Comercios, Auditoría y Diagnóstico de Infraestructura.
 */
(function () {
  'use strict';

  const API_BASE = '/api/admin';
  const SESSION_KEY = 'comersys_superadmin_session_v1';

  const AdminApp = {
    session: null,
    tenants: [],
    filter: 'all',
    searchQuery: '',
    activeTab: 'tenants',
    auditLogs: [],
    auditFilter: 'all',
    auditSearchQuery: '',

    init() {
      this.bindEvents();
      this.checkSession();
    },

    bindEvents() {
      // Formulario de login
      const loginForm = document.getElementById('adm-login-form');
      if (loginForm) {
        loginForm.addEventListener('submit', (e) => this.handleLogin(e));
      }

      // Alternar visualización de contraseña en login
      const togglePassBtn = document.getElementById('adm-toggle-pass-btn');
      const passInput = document.getElementById('adm-input-pass');
      if (togglePassBtn && passInput) {
        togglePassBtn.addEventListener('click', () => {
          const isPassword = passInput.type === 'password';
          passInput.type = isPassword ? 'text' : 'password';
        });
      }

      // Logout
      const logoutBtn = document.getElementById('adm-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => this.handleLogout());
      }

      // Menú móvil (Sidebar Drawer)
      const mobileBtn = document.getElementById('adm-mobile-menu-btn');
      const sidebar = document.getElementById('adm-sidebar');
      const backdrop = document.getElementById('adm-sidebar-backdrop');
      const closeSidebarBtn = document.getElementById('adm-sidebar-close-btn');

      const openMobileMenu = () => {
        if (sidebar) sidebar.classList.add('open');
        if (backdrop) backdrop.classList.add('active');
      };

      const closeMobileMenu = () => {
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('active');
      };

      if (mobileBtn) mobileBtn.addEventListener('click', openMobileMenu);
      if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeMobileMenu);
      if (backdrop) backdrop.addEventListener('click', closeMobileMenu);

      // Navegación de Vistas del Sidebar
      const navTenants = document.getElementById('adm-nav-tenants-btn');
      if (navTenants) {
        navTenants.addEventListener('click', () => {
          closeMobileMenu();
          this.switchTab('tenants');
        });
      }

      const navAudit = document.getElementById('adm-nav-audit-link');
      if (navAudit) {
        navAudit.addEventListener('click', () => {
          closeMobileMenu();
          this.switchTab('audit');
        });
      }

      const navSystem = document.getElementById('adm-nav-system-link');
      if (navSystem) {
        navSystem.addEventListener('click', () => {
          closeMobileMenu();
          this.switchTab('system');
        });
      }

      // Botón actualizar comercios
      const refreshTenantsBtn = document.getElementById('adm-refresh-tenants-btn');
      if (refreshTenantsBtn) {
        refreshTenantsBtn.addEventListener('click', () => this.loadTenants());
      }

      // Botón actualizar auditoría
      const refreshAuditBtn = document.getElementById('adm-refresh-audit-btn');
      if (refreshAuditBtn) {
        refreshAuditBtn.addEventListener('click', () => this.loadAuditRecords());
      }

      // Botón descargar respaldo en vista sistema
      const sysExportBtn = document.getElementById('adm-sys-export-btn');
      if (sysExportBtn) {
        sysExportBtn.addEventListener('click', () => this.handleExportBackup());
      }

      // Cambio obligatorio de contraseña
      const forcePassForm = document.getElementById('adm-force-pass-form');
      if (forcePassForm) {
        forcePassForm.addEventListener('submit', (e) => this.handleForceChangePassword(e));
      }

      // Modal crear nuevo negocio
      const openCreateBtn = document.getElementById('adm-open-create-btn');
      const openCreateHeroBtn = document.getElementById('adm-open-create-hero-btn');
      const openCreateModal = () => {
        document.getElementById('adm-create-form').reset();
        document.getElementById('new-biz-pass').value = 'clave123';
        this.hideElement('adm-create-error');
        this.showElement('adm-create-modal');
      };

      if (openCreateBtn) openCreateBtn.addEventListener('click', openCreateModal);
      if (openCreateHeroBtn) openCreateHeroBtn.addEventListener('click', openCreateModal);

      const createForm = document.getElementById('adm-create-form');
      if (createForm) {
        createForm.addEventListener('submit', (e) => this.handleCreateTenant(e));
      }

      // Formulario de suscripción
      const subForm = document.getElementById('adm-sub-form');
      if (subForm) {
        subForm.addEventListener('submit', (e) => this.handleSaveSubscription(e));
      }

      // Botón suspender por falta de pago en modal de suscripción
      const btnSuspendUnpaid = document.getElementById('sub-btn-suspend-unpaid');
      if (btnSuspendUnpaid) {
        btnSuspendUnpaid.addEventListener('click', () => this.handleSuspendForNonPayment());
      }

      // Búsqueda en Comercios
      const searchInput = document.getElementById('adm-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.searchQuery = e.target.value.toLowerCase().trim();
          this.renderTenants();
        });
      }

      // Filtros de estado de comercios (Pills)
      document.querySelectorAll('.adm-pill[data-filter]').forEach((pill) => {
        pill.addEventListener('click', (e) => {
          document.querySelectorAll('.adm-pill[data-filter]').forEach((p) => p.classList.remove('active'));
          e.target.classList.add('active');
          this.filter = e.target.getAttribute('data-filter');
          this.renderTenants();
        });
      });

      // Búsqueda en Auditoría
      const auditSearchInput = document.getElementById('adm-audit-search-input');
      if (auditSearchInput) {
        auditSearchInput.addEventListener('input', (e) => {
          this.auditSearchQuery = e.target.value.toLowerCase().trim();
          this.renderAuditRecords();
        });
      }

      // Filtros de categoría de Auditoría (Pills)
      document.querySelectorAll('#adm-audit-filters .adm-pill[data-audit-filter]').forEach((pill) => {
        pill.addEventListener('click', (e) => {
          document.querySelectorAll('#adm-audit-filters .adm-pill[data-audit-filter]').forEach((p) => p.classList.remove('active'));
          e.target.classList.add('active');
          this.auditFilter = e.target.getAttribute('data-audit-filter');
          this.renderAuditRecords();
        });
      });

      // Cerrar modales con [data-close-modal]
      document.querySelectorAll('[data-close-modal]').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.adm-modal-backdrop:not(#adm-force-pass-modal)').forEach((m) => {
            m.classList.add('hidden');
          });
        });
      });
    },

    switchTab(tabName) {
      this.activeTab = tabName;

      // Actualizar active en nav-items
      document.querySelectorAll('.adm-sidebar-nav .adm-nav-item').forEach((item) => {
        const itemTab = item.getAttribute('data-view');
        if (itemTab === tabName) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      // Alternar vistas
      const viewTenants = document.getElementById('adm-view-tenants');
      const viewAudit = document.getElementById('adm-view-audit');
      const viewSystem = document.getElementById('adm-view-system');

      if (viewTenants) viewTenants.classList.toggle('hidden', tabName !== 'tenants');
      if (viewAudit) viewAudit.classList.toggle('hidden', tabName !== 'audit');
      if (viewSystem) viewSystem.classList.toggle('hidden', tabName !== 'system');

      // Actualizar breadcrumb
      const bcCurrent = document.querySelector('.adm-breadcrumb-current');
      if (bcCurrent) {
        if (tabName === 'tenants') bcCurrent.textContent = 'Directorio de Comercios';
        if (tabName === 'audit') bcCurrent.textContent = 'Auditoría & Seguridad';
        if (tabName === 'system') bcCurrent.textContent = 'Salud del Sistema & Respaldo';
      }

      if (tabName === 'audit') {
        this.loadAuditRecords();
      } else if (tabName === 'system') {
        this.updateSystemView();
      }
    },

    checkSession() {
      // Soporte para visualización directa mediante parámetro de URL
      if (window.location.search.includes('view=force-pass')) {
        this.showLogin();
        document.getElementById('force-curr-pass').value = '811';
        this.showElement('adm-force-pass-modal');
        return;
      }
      if (window.location.search.includes('view=create-modal')) {
        this.session = { username: 'administrador', email: 'admin@comersys.local', token: 'demo-token', mustChangePassword: false };
        this.showDashboard();
        this.showElement('adm-create-modal');
        return;
      }

      try {
        const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
        if (raw) {
          this.session = JSON.parse(raw);
          if (this.session && this.session.token) {
            this.showDashboard();
            return;
          }
        }
      } catch (err) {
        console.error('Error al recuperar sesión de administración:', err);
      }
      this.showLogin();
    },

    showLogin() {
      this.session = null;
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      this.showElement('adm-login-view');
      this.hideElement('adm-app-shell');
      this.hideElement('adm-force-pass-modal');
    },

    showDashboard() {
      this.hideElement('adm-login-view');
      this.showElement('adm-app-shell');

      const navUser = document.getElementById('adm-nav-display-name');
      const navEmail = document.getElementById('adm-nav-email');
      const navRole = document.getElementById('adm-nav-role');

      if (this.session) {
        if (navUser) navUser.textContent = this.session.displayName || 'Administrador General';
        if (navEmail) navEmail.textContent = this.session.email || 'admin@comersys.local';
        if (navRole) navRole.textContent = 'SUPERADMINISTRADOR \u2022 Propietario';
      }

      this.switchTab('tenants');
      this.loadTenants();
    },

    async handleLogin(e) {
      e.preventDefault();
      const user = document.getElementById('adm-input-user').value.trim();
      const pass = document.getElementById('adm-input-pass').value.trim();
      const errBox = document.getElementById('adm-login-error');

      this.hideElement('adm-login-error');

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ username: user, password: pass })
        });

        const contentType = res.headers.get('content-type') || '';
        let data = null;
        if (contentType.includes('application/json')) {
          try { data = await res.json(); } catch (_) {}
        }

        if (!res.ok) {
          throw new Error((data && data.error) || `Error ${res.status}: Credenciales inválidas o servidor no disponible.`);
        }

        if (!data || !data.token) {
          throw new Error('Respuesta inválida del servidor central.');
        }

        this.session = data;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));

        if (data.mustChangePassword) {
          document.getElementById('force-curr-pass').value = pass;
          document.getElementById('force-new-pass').value = '';
          document.getElementById('force-conf-pass').value = '';
          this.hideElement('adm-force-pass-error');
          this.showElement('adm-force-pass-modal');
        } else {
          this.showDashboard();
        }
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      }
    },

    async handleForceChangePassword(e) {
      e.preventDefault();
      const curr = document.getElementById('force-curr-pass').value;
      const newP = document.getElementById('force-new-pass').value;
      const conf = document.getElementById('force-conf-pass').value;
      const errBox = document.getElementById('adm-force-pass-error');

      this.hideElement('adm-force-pass-error');

      if (newP !== conf) {
        errBox.textContent = 'Las nuevas contraseñas no coinciden.';
        errBox.classList.remove('hidden');
        return;
      }

      if (newP.length < 4) {
        errBox.textContent = 'La nueva contraseña debe tener al menos 4 caracteres.';
        errBox.classList.remove('hidden');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/change-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.session.token}`
          },
          body: JSON.stringify({ currentPassword: curr, newPassword: newP })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo cambiar la contraseña');
        }

        this.session.mustChangePassword = false;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
        this.hideElement('adm-force-pass-modal');
        alert('Contraseña actualizada con éxito. Bienvenido al panel de Administración Central.');
        this.showDashboard();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      }
    },

    async handleLogout() {
      if (confirm('¿Desea cerrar la sesión de administración central?')) {
        try {
          if (this.session && this.session.token) {
            await fetch(`${API_BASE}/auth/logout`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${this.session.token}` }
            }).catch(() => {});
          }
        } catch (_) {}
        this.showLogin();
      }
    },

    async loadTenants() {
      try {
        const res = await fetch(`${API_BASE}/tenants`, {
          headers: { 'Authorization': `Bearer ${this.session.token}` }
        });

        if (res.status === 401 || res.status === 403) {
          this.showLogin();
          return;
        }

        const data = await res.json();
        this.tenants = data.tenants || [];
        this.updateKpis(data.metrics || {});
        this.renderTenants();
        this.updateSystemView();
      } catch (err) {
        console.error('Error cargando negocios:', err);
      }
    },

    updateKpis(metrics) {
      const total = metrics.totalTenants !== undefined ? metrics.totalTenants : this.tenants.length;
      const active = metrics.activeTenants !== undefined ? metrics.activeTenants : this.tenants.filter(t => t.status === 'active').length;
      const suspended = metrics.suspendedTenants !== undefined ? metrics.suspendedTenants : this.tenants.filter(t => t.status === 'suspended').length;
      const rev = metrics.globalRevenue || 0;

      const elTotal = document.getElementById('kpi-total-tenants');
      const elActive = document.getElementById('kpi-active-tenants');
      const elSuspended = document.getElementById('kpi-suspended-tenants');
      const elRevenue = document.getElementById('kpi-global-revenue');
      const elNavBadge = document.getElementById('adm-nav-count-badge');

      if (elTotal) elTotal.textContent = total;
      if (elActive) elActive.textContent = active;
      if (elSuspended) elSuspended.textContent = suspended;
      if (elRevenue) elRevenue.textContent = '$' + Number(rev).toLocaleString('es-AR');
      if (elNavBadge) elNavBadge.textContent = total;
    },

    renderTenants() {
      const tbody = document.getElementById('adm-tenants-tbody');
      if (!tbody) return;

      let filtered = this.tenants;

      if (this.filter !== 'all') {
        filtered = filtered.filter((t) => t.status === this.filter);
      }

      if (this.searchQuery) {
        const q = this.searchQuery;
        filtered = filtered.filter((t) => {
          return (
            (t.businessName && t.businessName.toLowerCase().includes(q)) ||
            (t.ownerName && t.ownerName.toLowerCase().includes(q)) ||
            (t.username && t.username.toLowerCase().includes(q)) ||
            (t.taxId && t.taxId.toLowerCase().includes(q))
          );
        });
      }

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 48px 20px; color: var(--cs-text-muted);">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="margin: 0 auto 10px; display: block; opacity: 0.5;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              No se encontraron comercios registrados con los criterios especificados.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = filtered.map((t, idx) => {
        const isSuspended = t.status === 'suspended';
        const isClosed = t.status === 'closed';
        const isUnpaid = t.suspensionReason === 'FALTA_DE_PAGO';

        const statusMap = {
          active: { label: 'Activo', class: 'active' },
          suspended: { label: isUnpaid ? 'Suspendido (Falta de Pago)' : 'Suspendido', class: 'suspended' },
          closed: { label: 'Cerrado', class: 'closed' }
        };
        const st = statusMap[t.status] || { label: t.status, class: 'suspended' };
        const dateStr = t.createdAt ? new Date(t.createdAt).toLocaleDateString('es-AR') : '-';
        const productsCount = t.stats ? t.stats.products : 0;
        const salesCount = t.stats ? t.stats.sales : 0;
        const revenue = t.stats ? '$' + Number(t.stats.revenue || 0).toLocaleString('es-AR') : '$0';

        const subPlan = (t.subscription && t.subscription.plan) || 'Profesional';
        const subPaymentStatus = (t.subscription && t.subscription.paymentStatus) || 'paid';
        const subStatusMap = {
          paid: { label: 'Al día', class: 'adm-sub-paid' },
          pending: { label: 'Pendiente', class: 'adm-sub-pending' },
          overdue: { label: 'Impago / Vencido', class: 'adm-sub-overdue' }
        };
        const subBadge = subStatusMap[subPaymentStatus] || subStatusMap.paid;

        // Iniciales comerciales limpias para el avatar
        const words = (t.businessName || 'Comercio').trim().split(/\s+/);
        const initials = words.length > 1
          ? (words[0][0] + words[1][0]).toUpperCase()
          : words[0].slice(0, 2).toUpperCase();

        const avatarClass = (idx % 3 === 1) ? 'alt-1' : ((idx % 3 === 2) ? 'alt-2' : '');

        return `
          <tr data-tenant-id="${t.id}">
            <td data-label="Comercio & Titular">
              <div class="adm-biz-row-cell">
                <div class="adm-avatar-circle ${avatarClass}" aria-hidden="true">${this.escapeHtml(initials)}</div>
                <div class="adm-biz-info">
                  <span class="adm-biz-name">${this.escapeHtml(t.businessName)}</span>
                  <span class="adm-biz-owner">${this.escapeHtml(t.ownerName || 'Sin titular registrado')}${t.taxId ? ' \u2022 CUIT: ' + this.escapeHtml(t.taxId) : ''}</span>
                </div>
              </div>
            </td>
            <td data-label="Acceso & Contacto">
              <div class="adm-user-contact">
                <span class="adm-user-handle">@${this.escapeHtml(t.username || '-')}</span>
                <span class="adm-user-detail">${this.escapeHtml(t.phone || t.email || 'Sin contacto')}</span>
              </div>
            </td>
            <td data-label="Fecha de Alta">
              <span style="font-variant-numeric: tabular-nums; font-size: 13px; color: var(--cs-text-secondary);">${dateStr}</span>
            </td>
            <td data-label="Estado & Suscripción">
              <div>
                <span class="adm-badge ${st.class}">${st.label}</span>
              </div>
              <div style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">
                <span class="adm-plan-pill">${this.escapeHtml(subPlan)}</span>
                <span class="adm-sub-badge ${subBadge.class}">${subBadge.label}</span>
              </div>
            </td>
            <td data-label="Actividad Comercial" style="text-align: right;">
              <div style="font-size: 12.5px; line-height: 1.4;">
                <span style="color: var(--cs-text-secondary);"><strong>${productsCount}</strong> prods \u2022 <strong>${salesCount}</strong> ventas</span><br>
                <span style="color: var(--cs-primary); font-weight: 700; font-variant-numeric: tabular-nums;">${revenue}</span>
              </div>
            </td>
            <td data-label="Acciones de Control" style="text-align: right;">
              <div class="adm-row-actions">
                <button type="button" class="btn-row-action" title="Supervisar catálogo y operaciones" onclick="AdminApp.inspectTenant('${t.id}')">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h5l3 7 4-14 3 7h5"/></svg>
                  <span>Supervisar</span>
                </button>
                <button type="button" class="btn-row-action" title="Gestionar suscripción y vencimiento" onclick="AdminApp.openSubscriptionModal('${t.id}')">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                  <span>Suscripción</span>
                </button>
                ${!isClosed ? `
                  <button type="button" class="btn-row-action ${isSuspended ? 'success' : 'warning'}" onclick="AdminApp.toggleStatus('${t.id}', '${isSuspended ? 'active' : 'suspended'}')">
                    ${isSuspended ? `
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                      <span>Activar</span>
                    ` : `
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="4" height="16" x="6" y="4" rx="1"/><rect width="4" height="16" x="14" y="4" rx="1"/></svg>
                      <span>Suspender</span>
                    `}
                  </button>
                  <button type="button" class="btn-row-action" title="Restablecer clave de acceso" onclick="AdminApp.promptResetPassword('${t.id}', '${this.escapeHtml(t.businessName)}')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                    <span>Clave</span>
                  </button>
                  <button type="button" class="btn-row-action danger" title="Cierre definitivo de cuenta" onclick="AdminApp.closeAccount('${t.id}')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span>Cerrar</span>
                  </button>
                ` : `
                  <span style="font-size: 11.5px; color: var(--cs-text-muted); font-weight: 500;">Cuenta cerrada</span>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    },

    async handleCreateTenant(e) {
      e.preventDefault();
      const errBox = document.getElementById('adm-create-error');
      this.hideElement('adm-create-error');

      const payload = {
        businessName: document.getElementById('new-biz-name').value.trim(),
        ownerName: document.getElementById('new-biz-owner').value.trim(),
        taxId: document.getElementById('new-biz-taxid').value.trim(),
        phone: document.getElementById('new-biz-phone').value.trim(),
        email: document.getElementById('new-biz-email').value.trim(),
        plan: (document.getElementById('new-biz-plan') && document.getElementById('new-biz-plan').value) || 'Profesional',
        price: (document.getElementById('new-biz-price') && Number(document.getElementById('new-biz-price').value)) || 35000,
        username: document.getElementById('new-biz-user').value.trim(),
        password: document.getElementById('new-biz-pass').value.trim(),
        notes: document.getElementById('new-biz-notes').value.trim()
      };

      try {
        const res = await fetch(`${API_BASE}/tenants/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.session.token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo crear el comercio');
        }

        this.hideElement('adm-create-modal');
        alert(`Comercio "${payload.businessName}" creado exitosamente.\n\nEl titular ya puede ingresar al sistema comercial con:\nUsuario: ${payload.username}\nContraseña: ${payload.password}\nPlan asignado: ${payload.plan}`);
        this.loadTenants();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      }
    },

    async toggleStatus(tenantId, newStatus) {
      const verb = newStatus === 'active' ? 'reactivar' : 'suspender';
      if (!confirm(`¿Confirma que desea ${verb} este comercio?\n${newStatus === 'suspended' ? 'El comercio no podrá ingresar al sistema hasta que sea reactivado.' : 'El acceso al sistema comercial quedará restaurado inmediatamente.'}`)) {
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/tenants/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.session.token}`
          },
          body: JSON.stringify({ tenantId, status: newStatus })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al cambiar estado');

        this.loadTenants();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    },

    openSubscriptionModal(tenantId) {
      const t = this.tenants.find(x => x.id === tenantId);
      if (!t) return;

      document.getElementById('sub-tenant-id').value = t.id;
      document.getElementById('sub-modal-title').textContent = `Suscripción: ${t.businessName}`;
      document.getElementById('sub-biz-desc').textContent = `Configuración comercial para @${t.username || t.businessName} (${t.ownerName || 'Titular'}).`;

      const sub = t.subscription || {};
      document.getElementById('sub-plan-select').value = sub.plan || 'Profesional';
      document.getElementById('sub-price-input').value = sub.price !== undefined ? sub.price : 35000;
      document.getElementById('sub-status-select').value = sub.paymentStatus || 'paid';
      document.getElementById('sub-renewal-input').value = sub.renewalDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      document.getElementById('sub-notes-input').value = sub.notes || '';

      this.hideElement('adm-sub-error');
      this.showElement('adm-sub-modal');
    },

    async handleSaveSubscription(e) {
      e.preventDefault();
      const errBox = document.getElementById('adm-sub-error');
      this.hideElement('adm-sub-error');

      const tenantId = document.getElementById('sub-tenant-id').value;
      const payload = {
        tenantId,
        plan: document.getElementById('sub-plan-select').value,
        price: Number(document.getElementById('sub-price-input').value) || 0,
        paymentStatus: document.getElementById('sub-status-select').value,
        renewalDate: document.getElementById('sub-renewal-input').value,
        notes: document.getElementById('sub-notes-input').value.trim()
      };

      try {
        const res = await fetch(`${API_BASE}/tenants/subscription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.session.token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar suscripción');

        this.hideElement('adm-sub-modal');
        alert('Suscripción comercial actualizada exitosamente.');
        this.loadTenants();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      }
    },

    async handleSuspendForNonPayment() {
      const tenantId = document.getElementById('sub-tenant-id').value;
      const t = this.tenants.find(x => x.id === tenantId);
      const bizName = t ? t.businessName : 'este comercio';

      if (!confirm(`¿Confirma la SUSPENSIÓN POR FALTA DE PAGO para "${bizName}"?\n\nEl comercio tendrá denegado el acceso al sistema comercial hasta que el administrador general regularice la cuenta.`)) {
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/tenants/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.session.token}`
          },
          body: JSON.stringify({
            tenantId,
            status: 'suspended',
            reason: 'FALTA_DE_PAGO'
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al suspender por falta de pago');

        this.hideElement('adm-sub-modal');
        alert(`La cuenta de "${bizName}" ha sido suspendida por falta de pago.`);
        this.loadTenants();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    },

    async inspectTenant(tenantId) {
      try {
        const res = await fetch(`${API_BASE}/tenants/inspect?tenantId=${encodeURIComponent(tenantId)}`, {
          headers: { 'Authorization': `Bearer ${this.session.token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo obtener información del comercio');

        const { tenant, stats, recentSales } = data;
        const container = document.getElementById('inspect-modal-body');
        document.getElementById('inspect-modal-title').textContent = `Supervisión: ${tenant.businessName}`;

        container.innerHTML = `
          <div class="adm-inspect-summary-grid">
            <div class="adm-inspect-stat-card">
              <div class="adm-inspect-stat-val">${stats.productsCount}</div>
              <div class="adm-inspect-stat-lbl">Productos en Catálogo</div>
            </div>
            <div class="adm-inspect-stat-card">
              <div class="adm-inspect-stat-val">${stats.clientsCount}</div>
              <div class="adm-inspect-stat-lbl">Clientes Registrados</div>
            </div>
            <div class="adm-inspect-stat-card">
              <div class="adm-inspect-stat-val">${stats.salesCount}</div>
              <div class="adm-inspect-stat-lbl">Operaciones Realizadas</div>
            </div>
            <div class="adm-inspect-stat-card">
              <div class="adm-inspect-stat-val" style="color: var(--cs-primary);">$${Number(stats.totalRevenue || 0).toLocaleString('es-AR')}</div>
              <div class="adm-inspect-stat-lbl">Facturación Acumulada</div>
            </div>
          </div>

          <div style="margin-bottom: 16px;">
            <h4 style="font-size: 13px; font-weight: 700; color: var(--cs-text-primary); margin-bottom: 8px;">Ficha Técnica del Comercio</h4>
            <div style="background: var(--cs-bg-main); border: 1px solid var(--cs-border); border-radius: var(--cs-radius-sm); padding: 12px; font-size: 12.5px; line-height: 1.6;">
              <strong>Titular:</strong> ${this.escapeHtml(tenant.ownerName || '-')} \u2022 
              <strong>Usuario de acceso:</strong> @${this.escapeHtml(tenant.username || '-')} \u2022 
              <strong>Contacto:</strong> ${this.escapeHtml(tenant.phone || tenant.email || 'Sin datos')} \u2022 
              <strong>CUIT:</strong> ${this.escapeHtml(tenant.taxId || 'No informado')} \u2022 
              <strong>Plan:</strong> ${this.escapeHtml((tenant.subscription && tenant.subscription.plan) || 'Profesional')}
            </div>
          </div>

          <div>
            <h4 style="font-size: 13px; font-weight: 700; color: var(--cs-text-primary); margin-bottom: 8px;">Últimas Transacciones Registradas</h4>
            <div style="max-height: 220px; overflow-y: auto; border: 1px solid var(--cs-border); border-radius: var(--cs-radius-sm);">
              <table class="adm-table" style="font-size: 12px; margin: 0;">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Nº Venta</th>
                    <th>Cliente</th>
                    <th>Método</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentSales && recentSales.length ? recentSales.map(s => `
                    <tr>
                      <td style="white-space:nowrap; font-variant-numeric: tabular-nums;">${new Date(s.date).toLocaleDateString('es-AR')}</td>
                      <td><strong>#${s.id}</strong></td>
                      <td>${this.escapeHtml(s.clientName || 'Consumidor Final')}</td>
                      <td><span class="adm-plan-pill">${this.escapeHtml(s.paymentMethod || 'Efectivo')}</span></td>
                      <td style="text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--cs-primary);">$${Number(s.total || 0).toLocaleString('es-AR')}</td>
                    </tr>
                  `).join('') : `
                    <tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--cs-text-muted);">El comercio aún no registra ventas en su historial.</td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        `;

        this.showElement('adm-inspect-modal');
      } catch (err) {
        alert('Error al supervisar comercio: ' + err.message);
      }
    },

    async promptResetPassword(tenantId, bizName) {
      const newPass = prompt(`Ingrese la nueva contraseña de acceso para "${bizName}":`, 'clave123');
      if (!newPass || !newPass.trim()) return;

      try {
        const res = await fetch(`${API_BASE}/tenants/reset-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.session.token}`
          },
          body: JSON.stringify({ tenantId, newPassword: newPass.trim() })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al restablecer contraseña');

        alert(`Contraseña restablecida exitosamente para "${bizName}".\nNueva clave: ${newPass.trim()}`);
      } catch (err) {
        alert('Error: ' + err.message);
      }
    },

    async closeAccount(tenantId) {
      if (!confirm('¿CONFIRMA EL CIERRE DEFINITIVO de esta cuenta?\nEsta acción revoca todos los accesos del comercio. Los datos se conservarán en auditoría.')) {
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/tenants/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.session.token}`
          },
          body: JSON.stringify({ tenantId, status: 'closed' })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al cerrar cuenta');

        this.loadTenants();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    },

    // ------------------------------------------------------------------------
    // MÓDULO DE AUDITORÍA Y SEGURIDAD INTEGRADO
    // ------------------------------------------------------------------------
    async loadAuditRecords() {
      try {
        const res = await fetch(`${API_BASE}/audit`, {
          headers: { 'Authorization': `Bearer ${this.session.token}` }
        });

        const data = await res.json();
        this.auditLogs = data.logs || [];
        this.renderAuditRecords();
      } catch (err) {
        console.error('No se pudo cargar la auditoría:', err);
      }
    },

    renderAuditRecords() {
      const tbody = document.getElementById('adm-audit-full-tbody');
      if (!tbody) return;

      let filtered = this.auditLogs;

      // Filtro por categoría
      if (this.auditFilter !== 'all') {
        filtered = filtered.filter(l => (l.action || '').toUpperCase().includes(this.auditFilter));
      }

      // Búsqueda por texto
      if (this.auditSearchQuery) {
        const q = this.auditSearchQuery;
        filtered = filtered.filter(l => {
          return (
            (l.actor && l.actor.toLowerCase().includes(q)) ||
            (l.action && l.action.toLowerCase().includes(q)) ||
            (l.targetTenantId && l.targetTenantId.toLowerCase().includes(q)) ||
            (l.details && l.details.toLowerCase().includes(q))
          );
        });
      }

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center; padding: 36px 20px; color: var(--cs-text-muted);">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="margin: 0 auto 8px; display: block; opacity: 0.5;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              No se encontraron registros de auditoría coincidentes.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = filtered.map(l => {
        const act = (l.action || '').toUpperCase();
        let badgeClass = 'adm-audit-login';

        if (act.includes('LOGIN')) badgeClass = 'adm-audit-login';
        else if (act.includes('CREATED') || act.includes('TENANT_CREATED')) badgeClass = 'adm-audit-tenant';
        else if (act.includes('STATUS')) badgeClass = 'adm-audit-status';
        else if (act.includes('PASSWORD')) badgeClass = 'adm-audit-password';
        else if (act.includes('SECURITY') || act.includes('BLOCKED')) badgeClass = 'adm-audit-security';

        const dateStr = l.timestamp ? new Date(l.timestamp).toLocaleString('es-AR') : '-';

        return `
          <tr>
            <td data-label="Fecha y Hora" style="white-space:nowrap; font-variant-numeric: tabular-nums; font-size: 12.5px; color: var(--cs-text-secondary);">${dateStr}</td>
            <td data-label="Responsable"><strong>${this.escapeHtml(l.actor || 'Sistema')}</strong></td>
            <td data-label="Acción"><span class="adm-audit-badge ${badgeClass}">${this.escapeHtml(l.action || '-')}</span></td>
            <td data-label="Comercio Objetivo"><span style="font-family: monospace; font-size: 11.5px; color: var(--cs-text-muted);">${this.escapeHtml(l.targetTenantId || '-')}</span></td>
            <td data-label="Detalle Operación" style="color: var(--cs-text-secondary); line-height: 1.45;">${this.escapeHtml(l.details || '-')}</td>
          </tr>
        `;
      }).join('');
    },

    // ------------------------------------------------------------------------
    // MÓDULO DE SALUD DE SISTEMA
    // ------------------------------------------------------------------------
    updateSystemView() {
      const elTenants = document.getElementById('sys-total-tenants');
      const elLastSync = document.getElementById('sys-last-sync');

      if (elTenants) elTenants.textContent = `${this.tenants.length} espacios activos`;
      if (elLastSync) elLastSync.textContent = new Date().toLocaleTimeString('es-AR') + ' (Transaccional)';
    },

    async handleExportBackup() {
      try {
        const res = await fetch(`${API_BASE}/backup`, {
          headers: { 'Authorization': `Bearer ${this.session.token}` }
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comersys_global_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        alert('Error al exportar respaldo: ' + err.message);
      }
    },

    showElement(id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('hidden');
    },

    hideElement(id) {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    },

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  };

  window.AdminApp = AdminApp;
  document.addEventListener('DOMContentLoaded', () => AdminApp.init());
})();
