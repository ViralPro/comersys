/**
 * ============================================================================
 * COMERSYS — MOTOR DE ALMACENAMIENTO TRANSACCIONAL (ACID LOCAL ENGINE)
 * ============================================================================
 * Gestiona la base de datos relacional en localStorage sin datos ficticios
 * iniciales y garantiza consistencia atómica en operaciones multi-tabla
 * (ej. Ventas + Descuento de Stock + Deudas + Cuotas + Pagos + Finanzas).
 */
(function (global) {
  'use strict';

  const { Config } = global.ComerSys;

  /**
   * Estructura inicial limpia: CERO datos comerciales ficticios.
   * Solo incluye la cuenta de administración y la configuración base del sistema.
   */
  function createEmptyDatabase() {
    const now = new Date().toISOString();
    return {
      meta: {
        version: Config.APP_VERSION,
        createdAt: now,
        updatedAt: now,
        sequences: {
          groups: 0,
          products: 0,
          clients: 0,
          sales: 0,
          debts: 0,
          installments: 0,
          payments: 0,
          movements: 0
        }
      },
      users: [
        {
          id: 1,
          username: 'administrador',
          passwordHash: 'admin123',
          displayName: 'Administrador',
          role: 'admin',
          createdAt: now
        },
        {
          id: 2,
          username: 'admin',
          passwordHash: 'admin123',
          displayName: 'Administrador',
          role: 'admin',
          createdAt: now
        }
      ],
      settings: Object.assign({}, Config.DEFAULT_SETTINGS),
      groups: [],         // Grupos dinámicos de inventario
      products: [],       // Productos vinculados a grupos
      clients: [],        // Clientes y sus notas
      sales: [],          // Cabecera y detalle de ventas
      debts: [],          // Cuentas financiadas / saldos pendientes
      installments: [],   // Cronograma de cuotas generadas por deuda
      payments: [],       // Cobros recibidos (ventas contado, entregas, cuotas)
      movements: []       // Libro diario financiero (ingresos, cobros, compras de stock, egresos)
    };
  }

  const Storage = {
    _cache: null,
    _currentTenantId: null,

    getCurrentTenantId() {
      if (this._currentTenantId) return this._currentTenantId;
      try {
        const raw = localStorage.getItem(Config.SESSION_KEY);
        if (raw) {
          const sess = JSON.parse(raw);
          if (sess && sess.tenantId) {
            this._currentTenantId = sess.tenantId;
            return this._currentTenantId;
          }
        }
      } catch (e) {}
      return 'tenant_principal';
    },

    getStorageKey() {
      const tid = this.getCurrentTenantId();
      return `${Config.STORAGE_KEY}_${tid}`;
    },

    switchTenant(tenantId, tenantData) {
      this._currentTenantId = tenantId;
      const key = `${Config.STORAGE_KEY}_${tenantId}`;
      if (tenantData) {
        this._ensureSchemaIntegrity(tenantData);
        this._cache = tenantData;
        localStorage.setItem(key, JSON.stringify(tenantData));
        return tenantData;
      }
      this._cache = null;
      return this.init();
    },

    /**
     * Inicializa o recupera la base de datos desde localStorage.
     */
    init() {
      try {
        const storageKey = this.getStorageKey();
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
          const initialDb = createEmptyDatabase();
          this._saveRaw(initialDb);
          this._cache = initialDb;
          return initialDb;
        }
        const parsed = JSON.parse(raw);
        this._ensureSchemaIntegrity(parsed);
        this._cache = parsed;
        return parsed;
      } catch (err) {
        console.error('[ComerSys.Storage] Error al inicializar almacenamiento:', err);
        const fallback = createEmptyDatabase();
        this._cache = fallback;
        return fallback;
      }
    },

    /**
     * Asegura que todas las colecciones existan aunque se importe un respaldo parcial.
     */
    _ensureSchemaIntegrity(db) {
      const template = createEmptyDatabase();
      if (!db.meta) db.meta = template.meta;
      if (!db.meta.sequences) db.meta.sequences = template.meta.sequences;
      if (!Array.isArray(db.users) || db.users.length === 0) {
        db.users = template.users;
      } else {
        const hasAdmin = db.users.some(u => u.username === 'administrador' || u.username === 'admin');
        if (!hasAdmin) {
          db.users.unshift(template.users[0]);
        }
      }
      if (!db.settings) db.settings = template.settings;
      const collections = ['groups', 'products', 'clients', 'sales', 'debts', 'installments', 'payments', 'movements'];
      collections.forEach((col) => {
        if (!Array.isArray(db[col])) db[col] = [];
        if (typeof db.meta.sequences[col] !== 'number') {
          const maxId = db[col].reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
          db.meta.sequences[col] = maxId;
        }
      });
    },

    _saveRaw(db) {
      db.meta.updatedAt = new Date().toISOString();
      const storageKey = this.getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(db));
      this._syncWithServer(db);
    },

    _syncWithServer(db) {
      const tid = this.getCurrentTenantId();
      if (!tid) return;
      try {
        let token = '';
        try {
          const sessionRaw = localStorage.getItem(Config.SESSION_KEY);
          if (sessionRaw) {
            const parsed = JSON.parse(sessionRaw);
            token = parsed.token || '';
          }
        } catch (_) {}

        const headers = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        fetch('/api/v1/tenant/sync', {
          method: 'POST',
          headers,
          body: JSON.stringify({ tenantId: tid, data: db })
        }).catch(() => {});
      } catch (e) {}
    },

    /**
     * Obtiene una copia profunda del estado o la referencia controlada.
     */
    getState() {
      if (!this._cache) {
        this.init();
      }
      return this._cache;
    },

    /**
     * Genera el siguiente ID numérico autoincremental para una tabla.
     */
    nextId(collectionName) {
      const db = this.getState();
      if (typeof db.meta.sequences[collectionName] !== 'number') {
        db.meta.sequences[collectionName] = 0;
      }
      db.meta.sequences[collectionName] += 1;
      return db.meta.sequences[collectionName];
    },

    /**
     * Ejecuta una transacción atómica sobre la base de datos.
     * Si ocurre cualquier error o validación fallida dentro de `workFn`,
     * se revierte (rollback) el estado completo al instante previo y no
     * se persiste ningún cambio parcial (por ejemplo, nunca descuenta stock
     * si falla el registro de la venta o de las cuotas).
     */
    transaction(workFn) {
      const currentDb = this.getState();
      const snapshot = JSON.stringify(currentDb);
      try {
        const result = workFn(currentDb, this);
        this._saveRaw(currentDb);
        return result;
      } catch (error) {
        this._cache = JSON.parse(snapshot);
        localStorage.setItem(Config.STORAGE_KEY, snapshot);
        throw error;
      }
    },

    /**
     * Exporta toda la base de datos en JSON para respaldo.
     */
    exportBackup() {
      const db = this.getState();
      return JSON.stringify(db, null, 2);
    },

    /**
     * Importa y valida un archivo de respaldo JSON.
     */
    importBackup(jsonString) {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('El archivo de respaldo no tiene un formato JSON válido.');
      }
      this._ensureSchemaIntegrity(parsed);
      this._cache = parsed;
      this._saveRaw(parsed);
      return true;
    },

    /**
     * Reinicia la base de datos a cero manteniendo el usuario administrador.
     */
    resetDatabase() {
      const fresh = createEmptyDatabase();
      this._cache = fresh;
      this._saveRaw(fresh);
      return fresh;
    }
  };

  global.ComerSys.Core.Storage = Storage;
})(window);
