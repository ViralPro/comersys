/**
 * ============================================================================
 * COMERSYS — CAPA DE ABSTRACCIÓN DE DATOS / GATEWAY API (PREPARADA PHP+MYSQL)
 * ============================================================================
 * Permite operar de forma transparente contra el motor transaccional local o
 * contra un backend PHP + MySQL mediante contratos homogéneos.
 */
(function (global) {
  'use strict';

  const { Config } = global.ComerSys;
  const { Storage } = global.ComerSys.Core;

  const Api = {
    /**
     * Devuelve el modo de conexión activo.
     */
    getDriver() {
      return Config.DATA_DRIVER;
    },

    /**
     * Obtiene todos los registros de una colección.
     */
    getAll(collection) {
      const db = Storage.getState();
      return Array.isArray(db[collection]) ? db[collection] : [];
    },

    /**
     * Busca un registro por su ID primario.
     */
    getById(collection, id) {
      const numId = Number(id);
      return this.getAll(collection).find((item) => Number(item.id) === numId) || null;
    },

    /**
     * Ejecuta una unidad de trabajo transaccional (ACID).
     */
    runTransaction(callback) {
      return Storage.transaction(callback);
    },

    /**
     * Método preparado para peticiones HTTP asíncronas cuando `DATA_DRIVER === 'PHP_MYSQL'`.
     */
    async requestRemote(endpoint, method = 'GET', payload = null) {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };
      if (payload && method !== 'GET') {
        options.body = JSON.stringify(payload);
      }
      const response = await fetch(`${Config.API_BASE_URL}${endpoint}`, options);
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.message || 'Error en la comunicación con el servidor PHP/MySQL.');
      }
      return data;
    }
  };

  global.ComerSys.Core.Api = Api;
})(window);
