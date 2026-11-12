const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { getDatabase, DATA_PATH } = require('../server.js');

describe('Integridad de Base de Datos Multi-Tenant', () => {
  it('el archivo de base de datos debe existir en la ruta configurada', () => {
    assert.strictEqual(fs.existsSync(DATA_PATH), true, `El archivo ${DATA_PATH} debe existir`);
  });

  it('debe cargar la base de datos como objeto JSON válido', () => {
    const db = getDatabase();
    assert.strictEqual(typeof db, 'object', 'db debe ser un objeto');
    assert.notStrictEqual(db, null, 'db no debe ser null');
  });

  it('debe poseer una cuenta de SuperAdministrador configurada', () => {
    const db = getDatabase();
    assert.ok(db.superadmin, 'Debe existir la entidad superadmin');
    assert.ok(db.superadmin.email, 'superadmin debe tener un correo electrónico');
    assert.ok(db.superadmin.passwordHash, 'superadmin debe tener un hash de contraseña');
    assert.strictEqual(db.superadmin.role, 'SUPERADMINISTRADOR');
  });

  it('debe contener el directorio de comercios (tenants) con estructura válida', () => {
    const db = getDatabase();
    assert.ok(Array.isArray(db.tenants), 'db.tenants debe ser un array');
    assert.ok(db.tenants.length > 0, 'Debe haber al menos un comercio registrado');

    for (const tenant of db.tenants) {
      assert.ok(tenant.id, `El tenant ${tenant.businessName || 'desconocido'} debe tener id`);
      assert.ok(tenant.businessName, `El tenant ${tenant.id} debe tener businessName`);
      assert.ok(['active', 'suspended', 'pending', 'activo', 'suspendido'].includes(tenant.status), `Estado inválido para tenant ${tenant.id}: ${tenant.status}`);
      assert.ok(tenant.subscription && tenant.subscription.plan, `El tenant ${tenant.id} debe tener plan asignado en subscription`);
    }
  });

  it('debe mantener un registro cronológico de auditoría (auditLogs)', () => {
    const db = getDatabase();
    assert.ok(Array.isArray(db.auditLogs), 'db.auditLogs debe ser un array');
  });

  it('debe contener particiones de datos por comercio (tenantData)', () => {
    const db = getDatabase();
    assert.ok(typeof db.tenantData === 'object', 'db.tenantData debe ser un objeto');
  });
});
