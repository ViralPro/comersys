/**
 * ============================================================================
 * COMERSYS — SERVICIO DE AUTENTICACIÓN, SESIÓN Y CONFIGURACIÓN
 * ============================================================================
 */
(function (global) {
  'use strict';

  const { Config } = global.ComerSys;
  const { Storage, Validators } = global.ComerSys.Core;

  const AuthService = {
    /**
     * Inicia sesión verificando credenciales contra los usuarios registrados.
     */
    login(username, password) {
      const cleanUser = Validators.normalizeText(username);
      const rawPass = String(password || '');

      if (!cleanUser || !rawPass) {
        throw new Error('Por favor ingrese su usuario y contraseña.');
      }

      const db = Storage.getState();
      const user = db.users.find(
        (u) => Validators.normalizeText(u.username) === cleanUser && u.passwordHash === rawPass
      );

      if (!user) {
        throw new Error('Usuario o contraseña incorrectos.');
      }

      const session = {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        loggedInAt: new Date().toISOString()
      };

      localStorage.setItem(Config.SESSION_KEY, JSON.stringify(session));
      return session;
    },

    /**
     * Cierra la sesión activa.
     */
    logout() {
      localStorage.removeItem(Config.SESSION_KEY);
    },

    /**
     * Obtiene la sesión activa o null si no ha iniciado sesión.
     */
    getSession() {
      try {
        const raw = localStorage.getItem(Config.SESSION_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    },

    /**
     * Cambia la contraseña del usuario activo.
     */
    changePassword(currentPassword, newPassword, confirmPassword) {
      if (!currentPassword || !newPassword) {
        throw new Error('Complete la contraseña actual y la nueva contraseña.');
      }
      if (newPassword.length < 4) {
        throw new Error('La nueva contraseña debe tener al menos 4 caracteres.');
      }
      if (newPassword !== confirmPassword) {
        throw new Error('La confirmación de contraseña no coincide.');
      }

      const session = this.getSession();
      if (!session) {
        throw new Error('No hay una sesión activa.');
      }

      return Storage.transaction((db) => {
        const user = db.users.find((u) => Number(u.id) === Number(session.userId)) || db.users[0];
        if (!user || user.passwordHash !== String(currentPassword)) {
          throw new Error('La contraseña actual ingresada es incorrecta.');
        }
        user.passwordHash = String(newPassword);
        user.updatedAt = new Date().toISOString();
        return true;
      });
    },

    /**
     * Obtiene la configuración actual del sistema.
     */
    getSettings() {
      const db = Storage.getState();
      return Object.assign({}, Config.DEFAULT_SETTINGS, db.settings || {});
    },

    /**
     * Guarda cambios en la configuración del sistema.
     */
    updateSettings(newSettings) {
      return Storage.transaction((db) => {
        const businessName = String(newSettings.businessName || '').trim();
        if (!businessName) {
          throw new Error('El nombre del negocio no puede quedar vacío.');
        }
        db.settings = Object.assign({}, db.settings, {
          businessName,
          taxId: String(newSettings.taxId || '').trim(),
          phone: String(newSettings.phone || '').trim(),
          address: String(newSettings.address || '').trim(),
          currencySymbol: String(newSettings.currencySymbol || '$').trim(),
          dateFormat: newSettings.dateFormat === 'YYYY-MM-DD' ? 'YYYY-MM-DD' : 'DD/MM/YYYY',
          lowStockThreshold: Math.max(0, parseInt(newSettings.lowStockThreshold, 10) || 0),
          darkMode: Boolean(newSettings.darkMode)
        });
        return db.settings;
      });
    }
  };

  global.ComerSys.Services.AuthService = AuthService;
})(window);
