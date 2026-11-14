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

  function customRequest(method, urlPath, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const reqHeaders = { ...headers };
      if (data) {
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(data);
      }
      const req = http.request(`${baseUrl}${urlPath}`, {
        method,
        headers: reqHeaders
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
      if (data) req.write(data);
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

  it('GET /api/admin/auth/login debe responder 405 Method Not Allowed con cabecera Allow', async () => {
    const res = await get('/api/admin/auth/login');
    assert.strictEqual(res.statusCode, 405, 'Debe responder 405 cuando el método HTTP no está permitido');
    assert.ok(res.headers['allow'], 'Debe enviar cabecera Allow');
    assert.ok(res.headers['allow'].includes('POST'), 'Cabecera Allow debe incluir POST');
    assert.ok(res.json.error.includes('Error 405'), 'El cuerpo JSON debe documentar el Error 405');
  });

  it('OPTIONS /api/admin/auth/login debe responder 204 con cabeceras CORS y métodos permitidos incluyendo PATCH', async () => {
    const res = await customRequest('OPTIONS', '/api/admin/auth/login');
    assert.strictEqual(res.statusCode, 204);
    assert.ok(res.headers['access-control-allow-methods'].includes('PATCH'), 'CORS debe soportar PATCH');
    assert.ok(res.headers['allow'].includes('POST'));
  });

  it('POST /api/admin/tenants debe responder 405 Method Not Allowed (solo GET permitido)', async () => {
    const res = await post('/api/admin/tenants', {});
    assert.strictEqual(res.statusCode, 405);
    assert.ok(res.headers['allow'].includes('GET'));
  });

  it('POST /api/admin/auth/login con credenciales válidas debe responder 200 y emitir token', async () => {
    const res = await post('/api/admin/auth/login', {
      username: 'administrador',
      password: 'admin123'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.json.token, 'Debe emitir un token');
    assert.strictEqual(res.json.role, 'SUPERADMINISTRADOR');
    superAdminToken = res.json.token;
  });

  it('GET /api/admin/tenants con token válido de SuperAdmin debe responder 200 con la lista de comercios', async () => {
    const res = await get('/api/admin/tenants', {
      Authorization: `Bearer ${superAdminToken}`
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.json && Array.isArray(res.json.tenants), 'Debe devolver un objeto con arreglo de comercios');
    assert.ok(res.json.metrics, 'Debe devolver métricas del sistema');
  });

  it('PATCH /api/admin/tenants/status debe permitir actualizar el estado del comercio mediante HTTP PATCH', async () => {
    const db = getDatabase();
    const targetTenantId = (db.tenants && db.tenants[0] && db.tenants[0].id) || 'tenant_demo';
    const res = await customRequest('PATCH', '/api/admin/tenants/status', {
      tenantId: targetTenantId,
      status: 'active'
    }, {
      Authorization: `Bearer ${superAdminToken}`
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json.ok, true);
    assert.strictEqual(res.json.status, 'active');
  });

  it('POST /api/admin/auth/logout debe revocar la sesión del SuperAdmin', async () => {
    const res = await post('/api/admin/auth/logout', {}, {
      Authorization: `Bearer ${superAdminToken}`
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json.ok, true);

    // Intentar acceder con el token revocado debe responder 401
    const checkRes = await get('/api/admin/tenants', {
      Authorization: `Bearer ${superAdminToken}`
    });
    assert.strictEqual(checkRes.statusCode, 401);
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
  // 6. COMPATIBILIDAD CON VERCEL SERVERLESS FUNCTIONS Y RESILIENCIA
  // ==========================================================================
  it('server.js y api/index.js deben ser funciones invocables compatibles con Vercel Serverless', () => {
    const serverlessHandler = require('../server.js');
    const apiIndex = require('../api/index.js');
    assert.strictEqual(typeof serverlessHandler, 'function', 'server.js debe exportar una función ejecutable');
    assert.strictEqual(typeof apiIndex, 'function', 'api/index.js debe exportar una función ejecutable');
  });

  it('GET /css/admin.css y /js/admin.js deben resolver al asset de Admin Central mediante fallback resiliente', async () => {
    const cssRes = await get('/css/admin.css');
    assert.strictEqual(cssRes.statusCode, 200, 'css/admin.css debe responder 200');
    assert.ok(cssRes.body.includes('--cs-'), 'Debe contener variables CSS corporativas');

    const jsRes = await get('/js/admin.js');
    assert.strictEqual(jsRes.statusCode, 200, 'js/admin.js debe responder 200');
    assert.ok(jsRes.body.includes('AdminApp'), 'Debe contener la aplicación AdminApp');
  });

  it('POST /api/admin/auth/login con credenciales maestras válidas debe tener prioridad y desbloquear cualquier rate limit previo', async () => {
    // 1. Simular intentos fallidos con usuario incorrecto
    for (let i = 0; i < 5; i++) {
      await post('/api/admin/auth/login', { username: 'intruso', password: 'wrongpassword' });
    }

    // 2. El SuperAdministrador legítimo debe poder acceder directamente con admin123
    const masterRes = await post('/api/admin/auth/login', {
      username: 'administrador',
      password: 'admin123'
    });
    assert.strictEqual(masterRes.statusCode, 200, 'El administrador maestro legítimo debe acceder sin quedar bloqueado');
    assert.ok(masterRes.json.token, 'Debe emitir token');

    // Limpiar sesión
    await post('/api/admin/auth/logout', {}, {
      Authorization: `Bearer ${masterRes.json.token}`
    });
  });

  it('POST /api/admin/restore debe validar la estructura del respaldo e importar la base de datos', async () => {
    // Login temporal para obtener token
    const loginRes = await post('/api/admin/auth/login', {
      username: 'administrador',
      password: 'admin123'
    });
    const token = loginRes.json.token;

    // 1. Intento con respaldo malformado
    const badRes = await post('/api/admin/restore', { corrupto: true }, {
      Authorization: `Bearer ${token}`
    });
    assert.strictEqual(badRes.statusCode, 400);

    // 2. Intento con respaldo válido
    const currentDb = getDatabase();
    const goodRes = await post('/api/admin/restore', currentDb, {
      Authorization: `Bearer ${token}`
    });
    assert.strictEqual(goodRes.statusCode, 200);
    assert.strictEqual(goodRes.json.ok, true);
    assert.ok(goodRes.json.tenantsCount >= 0);

    // Limpiar sesión
    await post('/api/admin/auth/logout', {}, {
      Authorization: `Bearer ${token}`
    });
  });
});
