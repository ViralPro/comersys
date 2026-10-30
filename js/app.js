/**
 * ============================================================================
 * COMERSYS — CONTROLADOR PRINCIPAL, ROUTER SPA Y BUSCADOR GLOBAL
 * ============================================================================
 */
(function (global) {
  'use strict';

  const { Storage, Validators, Formatters } = global.ComerSys.Core;
  const { AuthService, InventoryService, ClientsService, SalesService, DebtsService } =
    global.ComerSys.Services;
  const { Icons, Components } = global.ComerSys.UI;

  const App = {
    currentRoute: 'dashboard',

    init() {
      Storage.init();
      const settings = AuthService.getSettings();
      this.applyTheme(settings.darkMode);

      this._setupAuthEvents();
      this._setupShellEvents();

      const session = AuthService.getSession();
      if (session) {
        this._showAppShell(session);
      } else {
        this._showLoginScreen();
      }
    },

    applyTheme(isDark) {
      if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    },

    _showLoginScreen() {
      const authScreen = document.getElementById('auth-screen');
      const appShell = document.getElementById('app-shell');
      if (authScreen) authScreen.classList.remove('hidden');
      if (appShell) appShell.classList.add('hidden');
    },

    _showAppShell(session) {
      const authScreen = document.getElementById('auth-screen');
      const appShell = document.getElementById('app-shell');
      if (authScreen) authScreen.classList.add('hidden');
      if (appShell) appShell.classList.remove('hidden');

      const nameEl = document.getElementById('header-user-name');
      const roleEl = document.getElementById('header-user-role');
      const avatarEl = document.getElementById('header-user-avatar');

      if (nameEl) nameEl.textContent = session.displayName || 'Administrador';
      if (roleEl) roleEl.textContent = session.role || 'admin';
      if (avatarEl) avatarEl.textContent = Formatters.initials(session.displayName || 'Admin');

      this.refreshHeaderIndicators();
      this.navigate(this.currentRoute || 'dashboard');
    },

    logout() {
      AuthService.logout();
      this._showLoginScreen();
      Components.toast('Sesión cerrada correctamente.', 'info');
    },

    /**
     * Navega hacia uno de los módulos principales con transición suave.
     */
    navigate(route) {
      const isRouteChange = this.currentRoute !== route;
      this.currentRoute = route;
      const contentEl = document.getElementById('app-content');
      if (!contentEl) return;

      // Actualizar estado activo del menú lateral
      document.querySelectorAll('.nav-item[data-route]').forEach((btn) => {
        const r = btn.getAttribute('data-route');
        btn.classList.toggle('active', r === route);
      });

      // Cerrar menú móvil si estaba abierto
      this._closeMobileSidebar();

      // Renderizar el módulo correspondiente
      const modulesMap = {
        dashboard: global.ComerSys.Modules.Dashboard,
        inventory: global.ComerSys.Modules.Inventory,
        clients: global.ComerSys.Modules.Clients,
        sales: global.ComerSys.Modules.Sales,
        debts: global.ComerSys.Modules.Debts
      };

      const targetModule = modulesMap[route] || modulesMap.dashboard;
      if (targetModule !== modulesMap[route]) {
        this.currentRoute = 'dashboard';
      }
      targetModule.render(contentEl);

      // Activar micro-transición fluida al cambiar de apartado
      if (isRouteChange) {
        contentEl.classList.remove('view-transition-enter');
        requestAnimationFrame(() => {
          contentEl.classList.add('view-transition-enter');
        });
      }

      this.refreshHeaderIndicators();
    },

    /**
     * Re-renderiza la vista actual tras una operación modal (ej. Venta o Cobro).
     */
    refreshCurrentView() {
      this.navigate(this.currentRoute || 'dashboard');
    },

    /**
     * Actualiza nombre del negocio en sidebar y contador de cuentas activas en el menú.
     */
    refreshHeaderIndicators() {
      const settings = AuthService.getSettings();
      const bizNameEl = document.getElementById('sidebar-business-name');
      if (bizNameEl) {
        bizNameEl.textContent = settings.businessName || 'ComerSys';
      }

      const debts = DebtsService.getAllDebts();
      const activeDebts = debts.filter((d) => d.pendingAmount > 0.009);

      const navDebtBadge = document.getElementById('nav-debts-badge');
      if (navDebtBadge) {
        if (activeDebts.length > 0) {
          navDebtBadge.textContent = String(activeDebts.length);
          navDebtBadge.classList.remove('hidden');
        } else {
          navDebtBadge.classList.add('hidden');
        }
      }
    },

    _setupAuthEvents() {
      const loginForm = document.getElementById('login-form');
      const togglePassBtn = document.getElementById('login-toggle-password');
      const passInput = document.getElementById('login-password');

      if (togglePassBtn && passInput) {
        togglePassBtn.addEventListener('click', () => {
          const isPass = passInput.type === 'password';
          passInput.type = isPass ? 'text' : 'password';
          togglePassBtn.innerHTML = isPass ? Icons.get('eyeOff') : Icons.get('eye');
        });
      }

      if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const user = document.getElementById('login-username').value;
          const pass = document.getElementById('login-password').value;
          const errEl = document.getElementById('login-error-msg');
          try {
            if (errEl) errEl.classList.add('hidden');
            const session = AuthService.login(user, pass);
            this._showAppShell(session);
            Components.toast(`Bienvenido a ComerSys, ${session.displayName}.`);
          } catch (err) {
            if (errEl) {
              errEl.textContent = err.message;
              errEl.classList.remove('hidden');
            } else {
              Components.toast(err.message, 'error');
            }
          }
        });
      }
    },

    _setupShellEvents() {
      // Navegación del menú lateral
      document.querySelectorAll('.nav-item[data-route]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const route = btn.getAttribute('data-route');
          if (route === 'inventory') {
            global.ComerSys.Modules.Inventory.state.activeGroupId = null;
          }
          this.navigate(route);
        });
      });

      // Clic en el logo del sidebar lleva a Inicio
      const brandEl = document.getElementById('sidebar-brand-link');
      if (brandEl) {
        brandEl.addEventListener('click', () => this.navigate('dashboard'));
      }

      // Menú móvil
      const mobileBtn = document.getElementById('mobile-menu-btn');
      const closeSidebarBtn = document.getElementById('sidebar-close-btn');
      const backdrop = document.getElementById('sidebar-backdrop');

      if (mobileBtn) {
        mobileBtn.addEventListener('click', () => {
          document.getElementById('app-sidebar').classList.add('open');
          backdrop.classList.add('active');
        });
      }
      if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => this._closeMobileSidebar());
      }
      if (backdrop) {
        backdrop.addEventListener('click', () => this._closeMobileSidebar());
      }

      // Botón de cierre de sesión en el pie del menú lateral
      const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
      if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', () => this.logout());
      }

      // Cerrar ventana modal activa con tecla Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          Components.closeTopModal();
        }
      });
    },

    _closeMobileSidebar() {
      const sb = document.getElementById('app-sidebar');
      const bd = document.getElementById('sidebar-backdrop');
      if (sb) sb.classList.remove('open');
      if (bd) bd.classList.remove('active');
    }
  };

  global.ComerSys.App = App;

  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });
})(window);
