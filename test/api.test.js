const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { requestHandler, getDatabase, saveDatabase, DATA_PATH } = require('../server.js');

describe('Suite de Integración y Seguridad Avanzada ComerSys (8000 y 8001)', () => {
  let testServer;
  let testPort;
  let baseUrl;
  let activeTenantToken;
  let superAdminToken;

  before((t, done) => {
    testServer = http.createServer((req, res) => requestHandler(req, res, testPort));
    testServer.listen(0, '127.0.0.1', () => {
      testPort = testServer.address().port;
      baseUrl = `http://127.0.0.1:${testPort}`;
      done();
    });
  });

  after((t, done) => {
    testServer.close(done);
  });

  function get(urlPath, headers = {}) {
    return new Promise((resolve, reject) => {
      http.get(`${baseUrl}${urlPath}`, { headers }, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch {
            // Contenido no JSON
          }
          resolve({ statusCode: res.statusCode, headers: res.headers, body: rawData, json });
        });
      }).on('error', reject);
    });
  }

  function post(urlPath, body = {}, headers = {}) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request(`${baseUrl}${urlPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers
        }
      }, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch {
            // Contenido no JSON
          }
          resolve({ statusCode: res.statusCode, headers: res.headers, body: rawData, json });
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  // ==========================================================================
  // 1. SALUD DEL SISTEMA Y CABECERAS DE SEGURIDAD
  // ==========================================================================
  it('GET /api/health debe responder 200 con cabeceras de seguridad CSP, nosniff y SAMEORIGIN', async () => {
    const res = await get('/api/health');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json.status, 'ok');
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
    assert.ok(res.headers['content-security-policy'], 'Debe enviar Content-Security-Policy');
    assert.ok(res.headers['content-security-policy'].includes("default-src 'self'"));
  });

  // ==========================================================================
  // 2. BLOQUEO DE ARCHIVOS SENSIBLES (CWE-200 / EXPOSICIÓN NO AUTORIZADA)
  // ==========================================================================
  it('GET /data/comersys_platform.json debe ser BLOQUEADO con 403 Forbidden', async () => {
    const res = await get('/data/comersys_platform.json');
    assert.strictEqual(res.statusCode, 403);
    assert.ok(res.body.includes('403 Prohibido'));
  });

  it('GET /server.js debe ser BLOQUEADO con 403 Forbidden', async () => {
    const res = await get('/server.js');
    assert.strictEqual(res.statusCode, 403);
    assert.ok(res.body.includes('403 Prohibido'));
  });

  it('GET /.git/config debe ser BLOQUEADO con 403 Forbidden', async () => {
    const res = await get('/.git/config');
    assert.strictEqual(res.statusCode, 403);
  });

  it('GET /package.json debe ser BLOQUEADO con 403 Forbidden', async () => {
    const res = await get('/package.json');
    assert.strictEqual(res.statusCode, 403);
  });

  it('GET /.env.example debe ser BLOQUEADO con 403 Forbidden', async () => {
    const res = await get('/.env.example');
    assert.strictEqual(res.statusCode, 403);
  });

  it('GET archivos públicos permitidos (index.html, css/layout.css, js/app.js) deben responder 200', async () => {
    const r1 = await get('/');
    assert.strictEqual(r1.statusCode, 200);
    const r2 = await get('/css/layout.css');
    assert.strictEqual(r2.statusCode, 200);
    const r3 = await get('/js/app.js');
    assert.strictEqual(r3.statusCode, 200);
  });

  // ==========================================================================
  // 3. SEGURIDAD Y CONTROL DE SESIONES SUPERADMIN
  // ==========================================================================
  it('POST /api/admin/auth/login con credenciales inválidas debe responder 401', async () => {
    const res = await post('/api/admin/auth/login', {
      username: 'administrador',
      password: 'credencial_invalida_xyz'
    });
    assert.strictEqual(res.statusCode, 401);
  });

  it('GET /api/admin/tenants sin token debe responder 401 Unauthorized', async () => {
    const res = await get('/api/admin/tenants');
    assert.strictEqual(res.statusCode, 401);
  });

  it('GET /api/admin/tenants con token revocado o expirado debe responder 401', async () => {
    const res = await get('/api/admin/tenants', {
      Authorization: 'Bearer token_completamente_inexistente_o_expirado'
    });
    assert.strictEqual(res.statusCode, 401);
  });

  // ==========================================================================
  // 4. AUTENTICACIÓN Y AISLAMIENTO MULTI-TENANT
  // ==========================================================================
  it('POST /api/v1/auth/login con boutiquebella debe generar token de sesión con TTL', async () => {
    const res = await post('/api/v1/auth/login', {
      username: 'boutiquebella',
      password: 'clave123'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.json.session.token);
    assert.ok(res.json.session.expiresAt);
    activeTenantToken = res.json.session.token;
  });

  it('POST /api/v1/tenant/sync SIN token de autorización debe ser RECHAZADO con 401', async () => {
    const res = await post('/api/v1/tenant/sync', {
      tenantId: 'tenant_ff1f6cbd',
      data: {}
    });
    assert.strictEqual(res.statusCode, 401, 'Sync sin token debe devolver 401');
    assert.ok(res.json.error.includes('token de sesión'));
  });

  it('POST /api/v1/tenant/sync con token de otro comercio (intento IDOR) debe ser RECHAZADO con 401/403', async () => {
    // El token pertenece a tenant_ff1f6cbd, pero intenta sincronizar tenant_principal
    const res = await post('/api/v1/tenant/sync', {
      tenantId: 'tenant_principal',
      data: {}
    }, {
      Authorization: `Bearer ${activeTenantToken}`
    });
    assert.ok([401, 403].includes(res.statusCode), 'Intento de alterar datos de otro comercio debe ser bloqueado');
  });

  it('POST /api/v1/tenant/sync con token legítimo y propio tenantId debe ser ACEPTADO con 200', async () => {
    const db = getDatabase();
    const currentData = (db.tenantData && db.tenantData['tenant_ff1f6cbd']) || {};
    const res = await post('/api/v1/tenant/sync', {
      tenantId: 'tenant_ff1f6cbd',
      data: currentData
    }, {
      Authorization: `Bearer ${activeTenantToken}`
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json.ok, true);
  });

  it('POST /api/v1/auth/logout debe revocar el token del comercio', async () => {
    const res = await post('/api/v1/auth/logout', {}, {
      Authorization: `Bearer ${activeTenantToken}`
    });
    assert.strictEqual(res.statusCode, 200);

    // Tras logout, un nuevo intento de sync con el mismo token debe ser 401
    const syncRes = await post('/api/v1/tenant/sync', {
      tenantId: 'tenant_ff1f6cbd',
      data: {}
    }, {
      Authorization: `Bearer ${activeTenantToken}`
    });
    assert.strictEqual(syncRes.statusCode, 401);
  });

  // ==========================================================================
  // 5. RESPALDO AUTOMÁTICO ROTATIVO (.bak)
  // ==========================================================================
  it('saveDatabase debe actualizar la base de datos y generar automáticamente copia .bak', () => {
    const db = getDatabase();
    saveDatabase(db);
    const backupPath = `${DATA_PATH}.bak`;
    assert.strictEqual(fs.existsSync(backupPath), true, 'Debe existir la copia de respaldo rotativa .bak');
    const backupStat = fs.statSync(backupPath);
    assert.ok(backupStat.size > 0, 'La copia .bak no debe estar vacía');
  });

  // ==========================================================================
  // 6. COMPATIBILIDAD CON VERCEL SERVERLESS FUNCTIONS
  // ==========================================================================
  it('server.js y api/index.js deben ser funciones invocables compatibles con Vercel Serverless', () => {
    const serverlessHandler = require('../server.js');
    const apiIndex = require('../api/index.js');
    assert.strictEqual(typeof serverlessHandler, 'function', 'server.js debe exportar una función ejecutable');
    assert.strictEqual(typeof apiIndex, 'function', 'api/index.js debe exportar una función ejecutable');
  });
});
