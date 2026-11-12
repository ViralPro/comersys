const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { requestHandler, getDatabase, saveDatabase } = require('../server.js');

const DATA_PATH = path.join(__dirname, '..', 'data', 'comersys_platform.json');

describe('Suite de Resistencia, Carga y Estabilidad ComerSys', () => {
  let server8000;
  let server8001;
  let port8000;
  let port8001;
  let superAdminToken;
  let originalDbState;

  before((t, done) => {
    // Guardamos estado original de la base de datos para restaurarlo al finalizar
    originalDbState = JSON.parse(JSON.stringify(getDatabase()));

    // Obtenemos o generamos un token de superadmin válido para pruebas
    superAdminToken = Object.keys(originalDbState.sessions || {})[0];
    if (!superAdminToken) {
      superAdminToken = 'test_resilience_admin_token';
      originalDbState.sessions[superAdminToken] = {
        role: 'superadmin',
        username: 'administrador',
        email: 'admin@comersys.local',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };
      saveDatabase(originalDbState);
    }

    let serversStarted = 0;
    const onStart = () => {
      serversStarted++;
      if (serversStarted === 2) done();
    };

    server8000 = http.createServer((req, res) => requestHandler(req, res, port8000));
    server8000.listen(0, '127.0.0.1', () => {
      port8000 = server8000.address().port;
      onStart();
    });

    server8001 = http.createServer((req, res) => requestHandler(req, res, port8001));
    server8001.listen(0, '127.0.0.1', () => {
      port8001 = server8001.address().port;
      onStart();
    });
  });

  after((t, done) => {
    // Restaurar el estado original intacto de la base de datos
    saveDatabase(originalDbState);

    let serversClosed = 0;
    const onClose = () => {
      serversClosed++;
      if (serversClosed === 2) done();
    };
    server8000.close(onClose);
    server8001.close(onClose);
  });

  function makeRequest(port, urlPath, method = 'GET', body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const payload = body ? JSON.stringify(body) : null;
      const reqHeaders = {
        'Connection': 'close',
        ...headers
      };
      if (payload) {
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: reqHeaders,
        agent: false
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          const duration = performance.now() - startTime;
          let json = null;
          try { json = JSON.parse(raw); } catch {}
          resolve({ statusCode: res.statusCode, headers: res.headers, body: raw, json, duration });
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  // ==========================================================================
  // 1. MÚLTIPLES COMERCIOS TRABAJANDO SIMULTÁNEAMENTE Y AISLAMIENTO DE DATOS
  // ==========================================================================
  it('Múltiples comercios trabajando simultáneamente mantienen aislamiento absoluto de datos', async () => {
    const db = getDatabase();
    // Preparamos dos tokens de sesión aislados para dos comercios
    const tokenA = 'token_tenant_a_' + Date.now();
    const tokenB = 'token_tenant_b_' + Date.now();

    db.sessions[tokenA] = {
      role: 'tenant_user',
      tenantId: 'tenant_concurrency_a',
      username: 'usuario_a',
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    };
    db.sessions[tokenB] = {
      role: 'tenant_user',
      tenantId: 'tenant_concurrency_b',
      username: 'usuario_b',
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    };
    db.tenants.push({ id: 'tenant_concurrency_a', businessName: 'Comercio A', status: 'active' });
    db.tenants.push({ id: 'tenant_concurrency_b', businessName: 'Comercio B', status: 'active' });
    saveDatabase(db);

    // Ejecutamos 20 operaciones concurrentes (10 para comercio A y 10 para comercio B)
    const operations = [];
    for (let i = 1; i <= 10; i++) {
      operations.push(
        makeRequest(port8000, '/api/v1/tenant/sync', 'POST', {
          tenantId: 'tenant_concurrency_a',
          data: { products: [{ id: `prod_a_${i}`, name: `Producto A ${i}` }], sales: [] }
        }, { Authorization: `Bearer ${tokenA}` })
      );
      operations.push(
        makeRequest(port8000, '/api/v1/tenant/sync', 'POST', {
          tenantId: 'tenant_concurrency_b',
          data: { products: [{ id: `prod_b_${i}`, name: `Producto B ${i}` }], sales: [] }
        }, { Authorization: `Bearer ${tokenB}` })
      );
    }

    const results = await Promise.all(operations);
    assert.strictEqual(results.length, 20);
    for (const r of results) {
      assert.strictEqual(r.statusCode, 200, 'Toda operación simultánea debe responder 200');
    }

    // Verificamos el aislamiento en la base de datos
    const updatedDb = getDatabase();
    const dataA = updatedDb.tenantData['tenant_concurrency_a'];
    const dataB = updatedDb.tenantData['tenant_concurrency_b'];

    assert.ok(dataA && dataA.products);
    assert.ok(dataB && dataB.products);
    assert.ok(dataA.products[0].id.startsWith('prod_a_'), 'Los datos de A no deben tener datos de B');
    assert.ok(dataB.products[0].id.startsWith('prod_b_'), 'Los datos de B no deben tener datos de A');
  });

  // ==========================================================================
  // 2. MÚLTIPLES USUARIOS CONECTADOS SIMULTÁNEAMENTE (CONCURRENCIA)
  // ==========================================================================
  it('Soporta múltiples usuarios conectados concurrentemente sin fallas ni caídas', async () => {
    const concurrentUsers = 30;
    const requests = [];

    for (let i = 0; i < concurrentUsers; i++) {
      const endpoint = (i % 2 === 0) ? '/api/health' : '/api/admin/tenants';
      const headers = (endpoint === '/api/admin/tenants') ? { Authorization: `Bearer ${superAdminToken}` } : {};
      requests.push(makeRequest(port8000, endpoint, 'GET', null, headers));
    }

    const responses = await Promise.all(requests);
    assert.strictEqual(responses.length, concurrentUsers);

    for (const res of responses) {
      assert.strictEqual(res.statusCode, 200);
    }
  });

  // ==========================================================================
  // 3. PERSISTENCIA TRAS REINICIO DE SERVIDOR
  // ==========================================================================
  it('Las ventas y movimientos persisten íntegramente tras destruir y reiniciar el servidor', async () => {
    const db = getDatabase();
    const testSaleId = 'sale_resilience_' + Date.now();
    const token = 'token_persist_' + Date.now();

    db.sessions[token] = {
      role: 'tenant_user',
      tenantId: 'tenant_ff1f6cbd',
      username: 'boutiquebella',
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    };
    saveDatabase(db);

    const testSale = {
      id: testSaleId,
      total: 15500,
      createdAt: new Date().toISOString(),
      items: [{ name: 'Prenda de prueba', price: 15500, quantity: 1 }]
    };

    // Sincronizamos la venta con el servidor
    const syncRes = await makeRequest(port8000, '/api/v1/tenant/sync', 'POST', {
      tenantId: 'tenant_ff1f6cbd',
      data: { sales: [testSale] }
    }, { Authorization: `Bearer ${token}` });
    assert.strictEqual(syncRes.statusCode, 200);

    // Destruimos el servidor 8000 completamente simulando reinicio/caída
    await new Promise(res => server8000.close(res));
    await new Promise(res => setTimeout(res, 50));

    // Comprobamos la persistencia física en el archivo de disco
    const diskDb = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const savedSales = diskDb.tenantData['tenant_ff1f6cbd'].sales;
    assert.ok(Array.isArray(savedSales));
    assert.ok(savedSales.some(s => s.id === testSaleId), 'La venta debe estar en el archivo de disco');

    // Levantamos un nuevo servidor desde cero
    await new Promise(res => {
      server8000 = http.createServer((req, res) => requestHandler(req, res, port8000));
      server8000.listen(port8000, '127.0.0.1', res);
    });

    // Verificamos que el nuevo servidor sirve los datos persistidos a través de la API
    const inspectRes = await makeRequest(port8000, `/api/admin/tenants/inspect?tenantId=tenant_ff1f6cbd`, 'GET', null, {
      Authorization: `Bearer ${superAdminToken}`
    });
    assert.strictEqual(inspectRes.statusCode, 200);
    assert.ok(inspectRes.json.recentSales.some(s => s.id === testSaleId), 'El nuevo servidor debe recuperar la venta');
  });

  // ==========================================================================
  // 4. RESTAURACIÓN REAL DE COPIAS DE SEGURIDAD (.bak)
  // ==========================================================================
  it('Comprueba la restauración real de copias de seguridad automáticas (.bak)', () => {
    const dbBefore = getDatabase();
    const originalMetaUpdated = dbBefore.meta.updatedAt;

    // saveDatabase genera automáticamente la copia .bak
    saveDatabase(dbBefore);
    const bakPath = `${DATA_PATH}.bak`;
    assert.ok(fs.existsSync(bakPath), 'El archivo .bak debe existir');

    const bakContent = fs.readFileSync(bakPath, 'utf8');
    const parsedBak = JSON.parse(bakContent);
    assert.strictEqual(parsedBak.meta.updatedAt, originalMetaUpdated);

    // Simulamos corrupción intencional en la base de datos principal
    fs.writeFileSync(DATA_PATH, JSON.stringify({ corrupted: true }));
    assert.strictEqual(getDatabase().corrupted, true);

    // Ejecutamos la restauración real desde .bak
    fs.copyFileSync(bakPath, DATA_PATH);
    const restoredDb = getDatabase();
    assert.strictEqual(restoredDb.corrupted, undefined);
    assert.ok(restoredDb.superadmin, 'El superadmin debe estar restaurado');
    assert.ok(Array.isArray(restoredDb.tenants), 'Los tenants deben estar restaurados');
  });

  // ==========================================================================
  // 5. ESTABILIDAD SIMULTÁNEA DE PUERTOS 8000 Y 8001
  // ==========================================================================
  it('Ráfaga cruzada de 100 peticiones simultáneas entre puertos 8000 y 8001', async () => {
    const burstRequests = [];
    for (let i = 0; i < 50; i++) {
      // 50 peticiones a puerto 8000
      burstRequests.push(makeRequest(port8000, '/api/health'));
      // 50 peticiones a puerto 8001
      burstRequests.push(makeRequest(port8001, '/api/admin/tenants', 'GET', null, {
        Authorization: `Bearer ${superAdminToken}`
      }));
    }

    const burstResults = await Promise.all(burstRequests);
    assert.strictEqual(burstResults.length, 100);

    let failures = 0;
    for (const r of burstResults) {
      if (r.statusCode !== 200) failures++;
    }
    assert.strictEqual(failures, 0, 'Ninguna petición debe fallar en ráfaga cruzada');
  });

  // ==========================================================================
  // 6. RENDIMIENTO Y TIEMPOS DE RESPUESTA BAJO CARGA
  // ==========================================================================
  it('Medición de latencia y tiempos de respuesta bajo carga (Promedio, P95, P99)', async () => {
    const sampleSize = 100;
    const latencies = [];

    for (let i = 0; i < sampleSize; i++) {
      const res = await makeRequest(port8000, '/api/health');
      latencies.push(res.duration);
    }

    latencies.sort((a, b) => a - b);
    const sum = latencies.reduce((acc, v) => acc + v, 0);
    const avg = sum / sampleSize;
    const min = latencies[0];
    const max = latencies[latencies.length - 1];
    const p95 = latencies[Math.floor(sampleSize * 0.95)];
    const p99 = latencies[Math.floor(sampleSize * 0.99)];

    console.log(`\n  [MÉTRICAS DE RENDIMIENTO COMERSYS]`);
    console.log(`  -> Muestras:      ${sampleSize} peticiones HTTP`);
    console.log(`  -> Mínimo:        ${min.toFixed(2)} ms`);
    console.log(`  -> Promedio:      ${avg.toFixed(2)} ms`);
    console.log(`  -> Percentil 95:  ${p95.toFixed(2)} ms`);
    console.log(`  -> Percentil 99:  ${p99.toFixed(2)} ms`);
    console.log(`  -> Máximo:        ${max.toFixed(2)} ms\n`);

    assert.ok(avg < 50, `El promedio (${avg.toFixed(2)}ms) debe ser menor a 50ms`);
    assert.ok(p95 < 100, `El P95 (${p95.toFixed(2)}ms) debe ser menor a 100ms`);
  });
});
