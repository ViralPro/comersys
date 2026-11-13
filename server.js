/**
 * ============================================================================
 * COMERSYS PLATFORM — SERVIDOR DE PRODUCCIÓN (NODE.JS)
 * ============================================================================
 * Servidor HTTP robusto, multi-tenant y de alto rendimiento.
 * Compatible con cualquier proveedor de nube (Render, Railway, Fly.io, VPS, Docker).
 * Implementa 100% de paridad con server.ps1 sin dependencias externas.
 * Criptografía segura PBKDF2 (SHA-256 + 10.000 iteraciones + Salt 128-bit).
 * ============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ----------------------------------------------------------------------------
// 1. CONFIGURACIÓN Y RUTAS BASE
// ----------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '8000', 10);
const ADMIN_PORT = parseInt(process.env.ADMIN_PORT || '8001', 10);
const ROOT_DIR = __dirname;
const ADMIN_DIR = path.join(ROOT_DIR, 'admin-central');
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const defaultDataPath = isServerless
  ? path.join('/tmp', 'comersys_platform.json')
  : path.join(ROOT_DIR, 'data', 'comersys_platform.json');
const DATA_PATH = process.env.DATA_PATH
  ? path.resolve(ROOT_DIR, process.env.DATA_PATH)
  : defaultDataPath;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp'
};

// ----------------------------------------------------------------------------
// 2. CRIPTOGRAFÍA SEGURA PBKDF2 (COMPATIBLE AL 100% CON RFC 2898 / .NET)
// ----------------------------------------------------------------------------
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256');
  const saltHex = salt.toString('hex').toUpperCase();
  const hashHex = derivedKey.toString('hex').toUpperCase();
  return `${saltHex}:${hashHex}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string' || !password || typeof password !== 'string') {
    return false;
  }
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    // Comparación segura en tiempo constante para hashes heredados
    const a = crypto.createHash('sha256').update(password).digest();
    const b = crypto.createHash('sha256').update(storedHash).digest();
    return crypto.timingSafeEqual(a, b);
  }

  const saltHex = parts[0];
  const expectedHashHex = parts[1];
  if (saltHex.length !== 32) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const derivedKey = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256');
  const derivedHex = derivedKey.toString('hex').toUpperCase();

  return crypto.timingSafeEqual(
    Buffer.from(derivedHex, 'utf8'),
    Buffer.from(expectedHashHex, 'utf8')
  );
}

// ----------------------------------------------------------------------------
// 3. PERSISTENCIA Y TRANSACCIONES ATÓMICAS MULTI-TENANT CON RESPALDO ROTATIVO
// ----------------------------------------------------------------------------
function getDatabase() {
  if (!fs.existsSync(DATA_PATH)) {
    const candidates = [
      path.join(__dirname, 'data', 'comersys_platform.json'),
      path.join(__dirname, 'data', 'comersys_platform.template.json')
    ];
    const sourcePath = candidates.find((p) => fs.existsSync(p));
    if (sourcePath) {
      const dir = path.dirname(DATA_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(sourcePath, DATA_PATH);
    } else {
      throw new Error(`Base de datos no encontrada en: ${DATA_PATH}`);
    }
  }
  let raw = fs.readFileSync(DATA_PATH, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) {
    raw = raw.slice(1);
  }
  return JSON.parse(raw);
}

function saveDatabase(db) {
  if (!db.meta) db.meta = {};
  db.meta.updatedAt = new Date().toISOString();
  const json = JSON.stringify(db, null, 2);

  // Respaldo de seguridad rotativo antes de sobrescribir
  if (fs.existsSync(DATA_PATH)) {
    const backupPath = `${DATA_PATH}.bak`;
    try {
      fs.copyFileSync(DATA_PATH, backupPath);
    } catch (e) {
      console.warn('[ComerSys.Backup] Advertencia creando copia .bak:', e.message);
    }
  }

  // Guardado atómico con reintentos para mitigar bloqueos efímeros de SO (Windows/Linux/AV)
  const tempPath = `${DATA_PATH}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tempPath, json, 'utf8');

    let retries = 5;
    while (retries > 0) {
      try {
        fs.renameSync(tempPath, DATA_PATH);
        break;
      } catch (err) {
        retries--;
        if (retries === 0) {
          try {
            fs.copyFileSync(tempPath, DATA_PATH);
            try { fs.unlinkSync(tempPath); } catch {}
            break;
          } catch (fallbackErr) {
            throw err;
          }
        }
        const pause = Date.now();
        while (Date.now() - pause < 10) {}
      }
    }
  } finally {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
  }
}

function addAuditLog(db, actor, action, targetTenantId, details) {
  if (!Array.isArray(db.auditLogs)) db.auditLogs = [];
  const log = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    actor: actor || 'Sistema',
    action: action || 'ACTION',
    targetTenantId: targetTenantId || '-',
    details: details || ''
  };
  db.auditLogs.unshift(log);
}

// ----------------------------------------------------------------------------
// 4. CONTROL DE SESIONES, EXPIRACIÓN (TTL) Y AISLAMIENTO MULTI-TENANT
// ----------------------------------------------------------------------------
const SUPERADMIN_SESSION_TTL_MS = 12 * 3600 * 1000; // 12 horas
const TENANT_SESSION_TTL_MS = 24 * 3600 * 1000;     // 24 horas

function purgeExpiredSessions(db) {
  if (!db.sessions || typeof db.sessions !== 'object') return;
  const now = Date.now();
  let changed = false;
  for (const token of Object.keys(db.sessions)) {
    const s = db.sessions[token];
    if (s && s.expiresAt && new Date(s.expiresAt).getTime() < now) {
      delete db.sessions[token];
      changed = true;
    }
  }
  if (changed) {
    saveDatabase(db);
  }
}

function validateSuperAdmin(req, db) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token || !db.sessions) return null;

  const session = db.sessions[token];
  if (!session || session.role !== 'superadmin') return null;

  // Comprobar expiración TTL
  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    delete db.sessions[token];
    saveDatabase(db);
    return null;
  }
  return session;
}

function validateTenantSession(req, db, requiredTenantId) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token || !db.sessions) return null;

  const session = db.sessions[token];
  if (!session) return null;

  // Comprobar expiración TTL
  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    delete db.sessions[token];
    saveDatabase(db);
    return null;
  }

  // SuperAdmin cuenta con acceso maestro de supervisión
  if (session.role === 'superadmin') return session;

  // Aislamiento estricto multi-tenant: el usuario debe pertenecer al comercio solicitado
  if (session.role === 'tenant_user' && session.tenantId === requiredTenantId) {
    return session;
  }

  return null;
}

// ----------------------------------------------------------------------------
// 5. PROTECCIÓN CONTRA FUERZA BRUTA (RATE LIMITING EN MEMORIA)
// ----------------------------------------------------------------------------
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || '127.0.0.1';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };

  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, remainingSec };
  }

  if (now - record.firstAttempt > LOCKOUT_WINDOW_MS) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_WINDOW_MS;
    const remainingSec = Math.ceil(LOCKOUT_WINDOW_MS / 1000);
    return { allowed: false, remainingSec };
  }

  return { allowed: true };
}

function recordFailedLogin(ip) {
  const now = Date.now();
  let record = loginAttempts.get(ip);
  if (!record || (now - record.firstAttempt > LOCKOUT_WINDOW_MS && !record.lockedUntil)) {
    record = { count: 1, firstAttempt: now, lockedUntil: null };
  } else {
    record.count += 1;
    if (record.count >= MAX_LOGIN_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_WINDOW_MS;
    }
  }
  loginAttempts.set(ip, record);
}

function resetLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

// ----------------------------------------------------------------------------
// 6. LISTA BLANCA DE ARCHIVOS ESTÁTICOS (PREVENCIÓN DE EXPOSICIÓN SENSIBLE)
// ----------------------------------------------------------------------------
const ALLOWED_ROOT_FILES = new Set(['index.html', 'favicon.svg', 'favicon.ico', 'robots.txt']);
const ALLOWED_PUBLIC_PREFIXES = ['css/', 'js/', 'assets/'];
const FORBIDDEN_EXTENSIONS = new Set([
  '.json', '.ps1', '.bat', '.cmd', '.sh', '.yml', '.yaml', '.md', '.tmp', '.bak', '.example', '.sql'
]);

function isStaticFileAllowed(relPath, isAdmin = false) {
  if (!relPath) return false;
  // Anti Path Traversal
  if (relPath.includes('..') || relPath.startsWith('.') || relPath.includes('/.')) {
    return false;
  }
  // Anti acceso a carpetas privadas del servidor
  const forbiddenDirs = ['data', '.git', '.github', 'node_modules', 'test', 'scripts', 'backend-php-mysql', '.gemini'];
  const firstSegment = relPath.split('/')[0].toLowerCase();
  if (forbiddenDirs.includes(firstSegment)) {
    return false;
  }

  const ext = path.extname(relPath).toLowerCase();
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return false;
  }

  if (isAdmin) {
    if (ALLOWED_ROOT_FILES.has(relPath)) return true;
    if (ALLOWED_PUBLIC_PREFIXES.some((prefix) => relPath.startsWith(prefix))) return true;
    return false;
  }

  // En el cliente, no permitir archivos .js directamente en la raíz (ej. server.js)
  if (!relPath.includes('/') && ext === '.js') {
    return false;
  }

  if (ALLOWED_ROOT_FILES.has(relPath)) return true;
  if (ALLOWED_PUBLIC_PREFIXES.some((prefix) => relPath.startsWith(prefix))) return true;
  return false;
}

// ----------------------------------------------------------------------------
// 7. HELPERS HTTP (RESPUESTAS, CABECERAS DE SEGURIDAD Y ARCHIVOS)
// ----------------------------------------------------------------------------
function sendResponse(res, statusCode, contentType, body, headers = {}) {
  const req = res._req;
  const isHttps = (req && req.socket && req.socket.encrypted) ||
                  ((req && req.headers && req.headers['x-forwarded-proto']) || '').toLowerCase() === 'https';

  const defaultHeaders = {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'self';"
  };

  if (isHttps) {
    defaultHeaders['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }

  res.writeHead(statusCode, { ...defaultHeaders, ...headers });
  if (body) {
    res.end(body);
  } else {
    res.end();
  }
}

function sendJson(res, statusCode, data, headers = {}) {
  const json = JSON.stringify(data);
  sendResponse(res, statusCode, 'application/json; charset=utf-8', json, headers);
}

function sendFile(res, filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      sendResponse(res, 404, 'text/plain; charset=utf-8', '404 No Encontrado');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);
    sendResponse(res, 200, contentType, content);
  } catch (err) {
    sendResponse(res, 500, 'text/plain; charset=utf-8', `500 Error de servidor: ${err.message}`);
  }
}

const MAX_PAYLOAD_SIZE = 2 * 1024 * 1024; // Límite de seguridad: 2 MB (Mitigación DoS)

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_PAYLOAD_SIZE) {
        req.destroy();
        const err = new Error('Payload Too Large');
        err.statusCode = 413;
        reject(err);
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', (err) => reject(err));
  });
}

// ----------------------------------------------------------------------------
// 8. MANEJADOR PRINCIPAL DE SOLICITUDES
// ----------------------------------------------------------------------------
async function requestHandler(req, res, targetPort) {
  res._req = req;
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = parsedUrl.pathname;
    const method = req.method;

    // Manejo CORS preflight
    if (method === 'OPTIONS') {
      sendResponse(res, 204, 'text/plain', null);
      return;
    }

    // Ruta de comprobación de salud para cloud (Render, Railway, Kubernetes)
    if (pathname === '/health' || pathname === '/api/health') {
      sendJson(res, 200, {
        status: 'ok',
        platform: 'ComerSys',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Detección de contexto: ¿Es Admin Central?
    const isSubdomainAdmin = (req.headers.host || '').toLowerCase().startsWith('admin.');
    const isPortAdmin = targetPort === ADMIN_PORT;
    const isApiAdmin = pathname.startsWith('/api/admin');
    const isPathAdmin = pathname.startsWith('/admin/') || pathname === '/admin';

    const isAdminContext = isPortAdmin || isSubdomainAdmin || isPathAdmin || isApiAdmin;

    // Si entra por /admin o /admin/, normalizamos el pathname para los archivos estáticos
    if (isPathAdmin) {
      if (pathname === '/admin') {
        res.writeHead(301, { Location: '/admin/' });
        res.end();
        return;
      }
      pathname = pathname.slice(6); // Quitar '/admin'
      if (!pathname || pathname === '/') pathname = '/index.html';
    }

    // ========================================================================
    // A) MÓDULO DE ADMINISTRACIÓN CENTRAL (SUPERADMIN)
    // ========================================================================
    if (isAdminContext) {
      // 1. Login Oficial de SuperAdmin
      if (pathname === '/api/admin/auth/login' && method === 'POST') {
        const clientIp = getClientIp(req);
        const rateCheck = checkRateLimit(clientIp);
        if (!rateCheck.allowed) {
          sendJson(res, 429, {
            error: `Demasiados intentos fallidos. Acceso bloqueado temporalmente. Intente nuevamente en ${rateCheck.remainingSec} segundos.`
          }, { 'Retry-After': String(rateCheck.remainingSec) });
          return;
        }

        const bodyStr = await readBody(req);
        const body = JSON.parse(bodyStr || '{}');
        const db = getDatabase();
        purgeExpiredSessions(db);

        const user = (body.username || '').trim().toLowerCase();
        const pass = body.password || '';

        const masterUser = (db.superadmin.username || 'administrador').toLowerCase();
        const masterEmail = (db.superadmin.email || 'admin@comersys.local').toLowerCase();

        const isMaster = user === masterUser || user === masterEmail;
        if (isMaster && verifyPassword(pass, db.superadmin.passwordHash)) {
          resetLoginAttempts(clientIp);
          const token = crypto.randomBytes(24).toString('hex');
          if (!db.sessions) db.sessions = {};
          const now = new Date();
          const expiresAt = new Date(now.getTime() + SUPERADMIN_SESSION_TTL_MS).toISOString();

          db.sessions[token] = {
            role: 'superadmin',
            username: db.superadmin.username,
            email: masterEmail,
            displayName: db.superadmin.displayName,
            isOwner: true,
            createdAt: now.toISOString(),
            expiresAt
          };
          db.superadmin.lastLoginAt = now.toISOString();
          addAuditLog(
            db,
            db.superadmin.username,
            'SUPERADMIN_LOGIN',
            'SYSTEM',
            `Inicio de sesión oficial del Administrador General (${masterEmail}).`
          );
          saveDatabase(db);

          sendJson(res, 200, {
            token,
            username: db.superadmin.username,
            email: masterEmail,
            displayName: db.superadmin.displayName,
            role: 'SUPERADMINISTRADOR',
            isOwner: true,
            expiresAt,
            mustChangePassword: Boolean(db.superadmin.mustChangePassword)
          });
        } else {
          recordFailedLogin(clientIp);
          sendJson(res, 401, { error: 'Credenciales de Administrador General inválidas.' });
        }
        return;
      }

      // 1.b Revocación de Sesión de SuperAdmin (Logout)
      if (pathname === '/api/admin/auth/logout' && method === 'POST') {
        const auth = req.headers['authorization'];
        if (auth && auth.startsWith('Bearer ')) {
          const token = auth.slice(7).trim();
          const db = getDatabase();
          if (db.sessions && db.sessions[token]) {
            const actor = db.sessions[token].username || 'SuperAdmin';
            delete db.sessions[token];
            addAuditLog(db, actor, 'SUPERADMIN_LOGOUT', 'SYSTEM', 'Cierre de sesión seguro en administración central.');
            saveDatabase(db);
          }
        }
        sendJson(res, 200, { ok: true, message: 'Sesión cerrada exitosamente.' });
        return;
      }

      // Seguridad: Verificación obligatoria de Token para cualquier otra API /api/admin/*
      if (pathname.startsWith('/api/admin/')) {
        const db = getDatabase();
        const superSession = validateSuperAdmin(req, db);
        if (!superSession) {
          sendJson(res, 401, {
            error: 'Acceso denegado. Se requiere autenticación válida y vigente de SuperAdministrador.'
          });
          return;
        }

        // 2. Cambio Obligatorio de Contraseña de SuperAdmin
        if (pathname === '/api/admin/auth/change-password' && method === 'POST') {
          const body = JSON.parse((await readBody(req)) || '{}');
          if (!verifyPassword(body.currentPassword, db.superadmin.passwordHash)) {
            sendJson(res, 400, { error: 'La contraseña actual no es correcta.' });
            return;
          }
          if (!body.newPassword || body.newPassword.length < 8) {
            sendJson(res, 400, { error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
            return;
          }
          db.superadmin.passwordHash = hashPassword(body.newPassword);
          db.superadmin.mustChangePassword = false;
          addAuditLog(
            db,
            db.superadmin.username,
            'SUPERADMIN_PASSWORD_CHANGED',
            'SYSTEM',
            'Contraseña de SuperAdmin actualizada con éxito (PBKDF2).'
          );
          saveDatabase(db);
          sendJson(res, 200, { ok: true, message: 'Contraseña actualizada correctamente.' });
          return;
        }

        // 3. Listado de Comercios y Métricas
        if (pathname === '/api/admin/tenants' && method === 'GET') {
          let globalRevenue = 0;
          const resultList = (db.tenants || []).map((t) => {
            const tData = db.tenantData ? db.tenantData[t.id] : null;
            let prodsCount = 0;
            let salesCount = 0;
            let rev = 0;

            if (tData) {
              if (Array.isArray(tData.products)) prodsCount = tData.products.length;
              if (Array.isArray(tData.sales)) {
                salesCount = tData.sales.length;
                tData.sales.forEach((s) => {
                  rev += Number(s.total || 0);
                });
              }
            }
            globalRevenue += rev;

            const tUser = (db.users || []).find((u) => u.tenantId === t.id);
            const sub = t.subscription || {
              plan: 'Profesional',
              price: 35000,
              paymentStatus: 'paid',
              renewalDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
              notes: ''
            };

            return {
              id: t.id,
              businessName: t.businessName,
              ownerName: t.ownerName,
              taxId: t.taxId,
              phone: t.phone,
              email: t.email,
              status: t.status,
              suspensionReason: t.suspensionReason || '',
              subscription: sub,
              createdAt: t.createdAt,
              username: tUser ? tUser.username : '',
              stats: {
                products: prodsCount,
                sales: salesCount,
                revenue: rev
              }
            };
          });

          sendJson(res, 200, {
            tenants: resultList,
            metrics: {
              totalTenants: (db.tenants || []).length,
              activeTenants: (db.tenants || []).filter((t) => t.status === 'active').length,
              suspendedTenants: (db.tenants || []).filter((t) => t.status === 'suspended').length,
              closedTenants: (db.tenants || []).filter((t) => t.status === 'closed').length,
              globalRevenue
            }
          });
          return;
        }

        // 4. Crear Nuevo Comercio con Validación Estricta
        if (pathname === '/api/admin/tenants/create' && method === 'POST') {
          const body = JSON.parse((await readBody(req)) || '{}');
          const cleanUser = (body.username || '').trim().toLowerCase();

          if (!cleanUser || cleanUser.length < 3 || cleanUser.length > 50) {
            sendJson(res, 400, { error: 'El nombre de usuario debe tener entre 3 y 50 caracteres.' });
            return;
          }

          if (['administrador', 'admin', 'superadmin', 'superadministrador'].includes(cleanUser)) {
            sendJson(res, 400, {
              error: `El nombre de usuario '@${cleanUser}' está reservado exclusivamente para la Administración General.`
            });
            return;
          }

          if (
            body.email &&
            body.email.trim().toLowerCase() === (db.superadmin.email || '').toLowerCase()
          ) {
            sendJson(res, 400, {
              error: 'El correo electrónico pertenece a la cuenta maestra del propietario de ComerSys.'
            });
            return;
          }

          const rawPass = String(body.password || '').trim();
          if (!rawPass || rawPass.length < 6) {
            sendJson(res, 400, {
              error: 'Debe especificar una contraseña segura para el nuevo comercio (mínimo 6 caracteres).'
            });
            return;
          }

          const exists = (db.users || []).some((u) => u.username.toLowerCase() === cleanUser);
          if (exists) {
            sendJson(res, 400, {
              error: `El nombre de usuario '@${cleanUser}' ya se encuentra registrado.`
            });
            return;
          }

          const cleanBizName = String(body.businessName || '').trim().slice(0, 100);
          if (!cleanBizName) {
            sendJson(res, 400, { error: 'La razón social o nombre del comercio es obligatoria.' });
            return;
          }

          const tId = 'tenant_' + crypto.randomBytes(4).toString('hex');
          const now = new Date().toISOString();
          const plan = body.plan || 'Profesional';
          const price = Number(body.price || 35000);

          const newTenant = {
            id: tId,
            businessName: cleanBizName,
            ownerName: String(body.ownerName || '').trim().slice(0, 100),
            taxId: String(body.taxId || '').trim().slice(0, 30),
            phone: String(body.phone || '').trim().slice(0, 30),
            email: String(body.email || '').trim().slice(0, 100),
            status: 'active',
            suspensionReason: '',
            subscription: {
              plan,
              price,
              paymentStatus: 'paid',
              renewalDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
              notes: String(body.notes || '').trim().slice(0, 500)
            },
            createdAt: now,
            updatedAt: now,
            notes: String(body.notes || '').trim().slice(0, 500)
          };

          const newUser = {
            id: (db.users || []).length + 1,
            tenantId: tId,
            username: cleanUser,
            passwordHash: hashPassword(rawPass),
            displayName: cleanBizName,
            role: 'admin',
            createdAt: now
          };

          const newTenantData = {
            meta: {
              version: '1.0.0',
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
            settings: {
              businessName: cleanBizName,
              taxId: newTenant.taxId,
              phone: newTenant.phone,
              address: '',
              currencySymbol: '$',
              currencyCode: 'ARS',
              dateFormat: 'DD/MM/YYYY',
              lowStockThreshold: 5,
              darkMode: false
            },
            groups: [],
            products: [],
            clients: [],
            sales: [],
            debts: [],
            installments: [],
            payments: [],
            movements: []
          };

          if (!Array.isArray(db.tenants)) db.tenants = [];
          if (!Array.isArray(db.users)) db.users = [];
          if (!db.tenantData) db.tenantData = {};

          db.tenants.push(newTenant);
          db.users.push(newUser);
          db.tenantData[tId] = newTenantData;

          addAuditLog(
            db,
            db.superadmin.username,
            'TENANT_CREATED',
            tId,
            `Nuevo negocio registrado: ${cleanBizName} (Usuario: @${cleanUser} / Plan: ${plan})`
          );
          saveDatabase(db);

          sendJson(res, 201, {
            ok: true,
            tenantId: tId,
            message: 'Negocio comercial creado exitosamente.'
          });
          return;
        }

        // 5. Cambiar Estado de Cuenta
        if (pathname === '/api/admin/tenants/status' && method === 'POST') {
          const body = JSON.parse((await readBody(req)) || '{}');
          const target = (db.tenants || []).find((t) => t.id === body.tenantId);
          if (!target) {
            sendJson(res, 404, { error: 'Negocio no encontrado.' });
            return;
          }

          const oldStatus = target.status;
          target.status = body.status;
          target.updatedAt = new Date().toISOString();

          if (body.status === 'active') {
            target.suspensionReason = '';
            if (target.subscription) target.subscription.paymentStatus = 'paid';
            addAuditLog(
              db,
              db.superadmin.username,
              'TENANT_STATUS_CHANGED',
              target.id,
              `Cuenta reactivada: ${target.businessName} (Acceso restaurado)`
            );
          } else if (body.status === 'suspended') {
            const reason = body.reason || 'MANUAL';
            target.suspensionReason = reason;
            if (reason === 'FALTA_DE_PAGO' && target.subscription) {
              target.subscription.paymentStatus = 'overdue';
            }
            addAuditLog(
              db,
              db.superadmin.username,
              'TENANT_STATUS_CHANGED',
              target.id,
              `Cuenta suspendida: ${target.businessName} (Motivo: ${reason})`
            );
          } else {
            addAuditLog(
              db,
              db.superadmin.username,
              'TENANT_STATUS_CHANGED',
              target.id,
              `Cambio de estado en ${target.businessName}: ${oldStatus} -> ${body.status}`
            );
          }

          saveDatabase(db);
          sendJson(res, 200, {
            ok: true,
            status: target.status,
            reason: target.suspensionReason
          });
          return;
        }

        // 6. Control de Suscripción
        if (pathname === '/api/admin/tenants/subscription' && method === 'POST') {
          const body = JSON.parse((await readBody(req)) || '{}');
          const target = (db.tenants || []).find((t) => t.id === body.tenantId);
          if (!target) {
            sendJson(res, 404, { error: 'Comercio no encontrado.' });
            return;
          }

          if (!target.subscription) target.subscription = {};
          target.subscription.plan = body.plan;
          target.subscription.price = Number(body.price || 0);
          target.subscription.paymentStatus = body.paymentStatus;
          target.subscription.renewalDate = body.renewalDate;
          target.subscription.notes = String(body.notes || '').slice(0, 500);
          target.updatedAt = new Date().toISOString();

          if (body.paymentStatus === 'overdue') {
            target.suspensionReason = 'FALTA_DE_PAGO';
          }

          addAuditLog(
            db,
            db.superadmin.username,
            'TENANT_SUBSCRIPTION_UPDATED',
            target.id,
            `Suscripción actualizada para ${target.businessName}: Plan ${body.plan} / Estado: ${body.paymentStatus}`
          );
          saveDatabase(db);
          sendJson(res, 200, { ok: true, subscription: target.subscription });
          return;
        }

        // 7. Inspeccionar Comercio (Supervisión)
        if (pathname === '/api/admin/tenants/inspect' && method === 'GET') {
          const tId = parsedUrl.searchParams.get('tenantId');
          const target = (db.tenants || []).find((t) => t.id === tId);
          if (!target) {
            sendJson(res, 404, { error: 'Comercio no encontrado.' });
            return;
          }

          const tUser = (db.users || []).find((u) => u.tenantId === tId);
          const tData = db.tenantData ? db.tenantData[tId] : null;

          let prodsCount = 0;
          let clientsCount = 0;
          let salesCount = 0;
          let totalRevenue = 0;
          let recentSales = [];

          if (tData) {
            if (Array.isArray(tData.products)) prodsCount = tData.products.length;
            if (Array.isArray(tData.clients)) clientsCount = tData.clients.length;
            if (Array.isArray(tData.sales)) {
              salesCount = tData.sales.length;
              tData.sales.forEach((s) => {
                totalRevenue += Number(s.total || 0);
              });
              recentSales = tData.sales.slice(-10);
            }
          }

          sendJson(res, 200, {
            tenant: {
              id: target.id,
              businessName: target.businessName,
              ownerName: target.ownerName,
              taxId: target.taxId,
              phone: target.phone,
              email: target.email,
              status: target.status,
              username: tUser ? tUser.username : '',
              subscription: target.subscription
            },
            stats: {
              productsCount: prodsCount,
              clientsCount: clientsCount,
              salesCount: salesCount,
              totalRevenue
            },
            recentSales
          });
          return;
        }

        // 8. Restablecer Contraseña de Comercio
        if (pathname === '/api/admin/tenants/reset-password' && method === 'POST') {
          const body = JSON.parse((await readBody(req)) || '{}');
          const newPass = String(body.newPassword || '').trim();
          if (!newPass || newPass.length < 6) {
            sendJson(res, 400, { error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
            return;
          }
          const tUser = (db.users || []).find((u) => u.tenantId === body.tenantId);
          if (!tUser) {
            sendJson(res, 404, { error: 'Usuario del negocio no encontrado.' });
            return;
          }
          tUser.passwordHash = hashPassword(newPass);
          addAuditLog(
            db,
            db.superadmin.username,
            'TENANT_PASSWORD_RESET',
            body.tenantId,
            `Contraseña restablecida para el usuario @${tUser.username}`
          );
          saveDatabase(db);
          sendJson(res, 200, { ok: true, message: 'Contraseña restablecida correctamente.' });
          return;
        }

        // 9. Consultar Auditoría
        if (pathname === '/api/admin/audit' && method === 'GET') {
          sendJson(res, 200, { logs: db.auditLogs || [] });
          return;
        }

        // 10. Respaldo Completo Protegido
        if (pathname === '/api/admin/backup' && method === 'GET') {
          const raw = fs.readFileSync(DATA_PATH, 'utf8');
          sendResponse(res, 200, 'application/json; charset=utf-8', raw, {
            'Content-Disposition': 'attachment; filename=comersys_platform_backup.json'
          });
          return;
        }
      }

      // Servir Archivos Estáticos de Admin Central (admin-central/)
      let relPath = pathname.replace(/^\/+/, '');
      if (!relPath || relPath === '/') relPath = 'index.html';
      if (relPath === 'favicon.ico') relPath = 'favicon.svg';

      if (!isStaticFileAllowed(relPath, true)) {
        sendResponse(res, 403, 'text/plain; charset=utf-8', '403 Prohibido - Recurso protegido.');
        return;
      }

      const filePath = path.join(ADMIN_DIR, relPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        sendFile(res, filePath);
        return;
      }

      // Fallback a raíz si es un recurso compartido permitido
      const fallbackPath = path.join(ROOT_DIR, relPath);
      if (fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).isFile() && isStaticFileAllowed(relPath, false)) {
        sendFile(res, fallbackPath);
        return;
      }

      sendResponse(res, 404, 'text/plain; charset=utf-8', '404 No Encontrado - Admin Central');
      return;
    }

    // ========================================================================
    // B) MÓDULO COMERCIAL CLIENTE (SISTEMA MULTI-TENANT)
    // ========================================================================
    // Bloqueo de seguridad: No exponer admin-central desde el acceso comercial
    if (pathname.toLowerCase().includes('admin-central')) {
      sendResponse(
        res,
        403,
        'text/plain; charset=utf-8',
        '403 Prohibido - Panel Central no disponible en este acceso.'
      );
      return;
    }

    // 1. API: Login de Comercio Cliente
    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      const clientIp = getClientIp(req);
      const rateCheck = checkRateLimit(clientIp);
      if (!rateCheck.allowed) {
        sendJson(res, 429, {
          error: `Demasiados intentos fallidos. Acceso bloqueado temporalmente. Intente nuevamente en ${rateCheck.remainingSec} segundos.`
        }, { 'Retry-After': String(rateCheck.remainingSec) });
        return;
      }

      const body = JSON.parse((await readBody(req)) || '{}');
      const cleanUser = (body.username || '').trim().toLowerCase();
      const pass = body.password || '';
      const db = getDatabase();
      purgeExpiredSessions(db);

      let user = (db.users || []).find((u) => (u.username || '').toLowerCase() === cleanUser);
      // Compatibilidad con alias
      if (!user && (cleanUser === 'admin' || cleanUser === 'administrador')) {
        user = (db.users || []).find(
          (u) => u.username.toLowerCase() === 'administrador' || u.username.toLowerCase() === 'admin'
        );
      }

      if (!user || !verifyPassword(pass, user.passwordHash)) {
        recordFailedLogin(clientIp);
        sendJson(res, 401, { error: 'Usuario o contraseña incorrectos.' });
        return;
      }

      const tenant = (db.tenants || []).find((t) => t.id === user.tenantId);
      if (!tenant) {
        sendJson(res, 403, { error: 'Espacio comercial no encontrado.' });
        return;
      }

      if (tenant.status === 'suspended') {
        let msg =
          'Su cuenta comercial ha sido temporalmente SUSPENDIDA. Comuníquese con la Administración Central de ComerSys.';
        if (tenant.suspensionReason === 'FALTA_DE_PAGO') {
          const contactEmail = db.superadmin?.email || 'la Administración Central';
          msg =
            `Su cuenta comercial se encuentra SUSPENDIDA POR FALTA DE PAGO. Por favor comuníquese con la Administración Central (${contactEmail}) para regularizar su suscripción.`;
        }
        sendJson(res, 403, {
          error: msg,
          suspended: true,
          reason: tenant.suspensionReason
        });
        return;
      }

      if (tenant.status === 'closed') {
        const contactEmail = db.superadmin?.email || 'la Administración Central';
        sendJson(res, 403, {
          error:
            `Esta cuenta comercial ha sido cerrada definitivamente. Comuníquese con el Administrador General (${contactEmail}).`,
          closed: true
        });
        return;
      }

      resetLoginAttempts(clientIp);
      const tData = db.tenantData ? db.tenantData[tenant.id] : null;
      const token = crypto.randomBytes(24).toString('hex');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + TENANT_SESSION_TTL_MS).toISOString();

      if (!db.sessions) db.sessions = {};
      db.sessions[token] = {
        role: 'tenant_user',
        userId: user.id,
        tenantId: tenant.id,
        username: user.username,
        displayName: user.displayName,
        createdAt: now.toISOString(),
        expiresAt
      };
      saveDatabase(db);

      sendJson(res, 200, {
        session: {
          userId: user.id,
          tenantId: tenant.id,
          businessName: tenant.businessName,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          token,
          expiresAt,
          loggedInAt: now.toISOString()
        },
        tenantData: tData
      });
      return;
    }

    // 1.b API: Logout de Comercio Cliente
    if (pathname === '/api/v1/auth/logout' && method === 'POST') {
      const auth = req.headers['authorization'];
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.slice(7).trim();
        const db = getDatabase();
        if (db.sessions && db.sessions[token]) {
          delete db.sessions[token];
          saveDatabase(db);
        }
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    // 2. API: Sincronización Transaccional de Datos del Tenant con Aislamiento Estricto
    if (pathname === '/api/v1/tenant/sync' && method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const tId = body.tenantId;
      const db = getDatabase();

      // Validación estricta de autorización y aislamiento multi-tenant
      const session = validateTenantSession(req, db, tId);
      if (!session) {
        sendJson(res, 401, {
          error: 'Operación denegada. Se requiere token de sesión válido perteneciente a este comercio.'
        });
        return;
      }

      const tenant = (db.tenants || []).find((t) => t.id === tId);
      if (!tenant || tenant.status !== 'active') {
        sendJson(res, 403, { error: 'Operación denegada. Negocio no activo.' });
        return;
      }

      if (!db.tenantData) db.tenantData = {};
      db.tenantData[tId] = body.data;
      saveDatabase(db);

      sendJson(res, 200, { ok: true, syncedAt: new Date().toISOString() });
      return;
    }

    // Servir Archivos Estáticos de ComerSys Cliente con Lista Blanca Estricta
    let relPath = pathname.replace(/^\/+/, '');
    if (!relPath || relPath === '/') relPath = 'index.html';
    if (relPath === 'favicon.ico') relPath = 'favicon.svg';

    if (!isStaticFileAllowed(relPath, false)) {
      sendResponse(res, 403, 'text/plain; charset=utf-8', '403 Prohibido - Acceso denegado a recurso restringido.');
      return;
    }

    let filePath = path.join(ROOT_DIR, relPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(res, filePath);
      return;
    }

    sendResponse(res, 404, 'text/plain; charset=utf-8', '404 No Encontrado');
  } catch (err) {
    const status = err.statusCode || 500;
    sendResponse(res, status, 'text/plain; charset=utf-8', `${status} Error: ${err.message}`);
  }
}

// ----------------------------------------------------------------------------
// 9. MANEJADORES GLOBALES DE PROCESO (RESILIENCIA Y PRODUCCIÓN)
// ----------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
  console.error('[FATAL uncaughtException]', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL unhandledRejection]', reason);
});

// ----------------------------------------------------------------------------
// 10. INICIALIZACIÓN DEL SERVIDOR
// ----------------------------------------------------------------------------
// En la nube (Render, Railway, VPS), PORT gobierna el servicio unificado.
// Cuando se ejecuta localmente o se activa DUAL_PORT, también abre ADMIN_PORT.
const server = http.createServer((req, res) => requestHandler(req, res, PORT));

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('==========================================================');
    console.log('  COMERSYS MULTI-TENANT ENTERPRISE SERVER (PRODUCCIÓN)');
    console.log(`  -> Puerto Principal: http://0.0.0.0:${PORT}/`);
    console.log(`     - Cliente ComerSys: http://localhost:${PORT}/`);
    console.log(`     - Admin Central:    http://localhost:${PORT}/admin/`);
    console.log(`  -> Base de Datos:   ${DATA_PATH}`);
    console.log('==========================================================');
  });

  // Servidor auxiliar en ADMIN_PORT para compatibilidad local con 8001
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DUAL_PORT === 'true') {
    const adminServer = http.createServer((req, res) => requestHandler(req, res, ADMIN_PORT));
    adminServer.listen(ADMIN_PORT, '0.0.0.0', () => {
      console.log(`  -> Puerto Admin 8001: http://localhost:${ADMIN_PORT}/`);
    }).on('error', (err) => {
      // Si el puerto 8001 ya está en uso (ej. por server.ps1), no bloquea el servidor principal
      console.log(`  (Puerto ${ADMIN_PORT} ocupado o no disponible en este entorno: ${err.code})`);
    });
  }
}

function serverlessHandler(req, res) {
  return requestHandler(req, res, PORT);
}

serverlessHandler.server = server;
serverlessHandler.requestHandler = requestHandler;
serverlessHandler.getDatabase = getDatabase;
serverlessHandler.saveDatabase = saveDatabase;
serverlessHandler.hashPassword = hashPassword;
serverlessHandler.verifyPassword = verifyPassword;
serverlessHandler.validateSuperAdmin = validateSuperAdmin;
serverlessHandler.validateTenantSession = validateTenantSession;
serverlessHandler.purgeExpiredSessions = purgeExpiredSessions;
serverlessHandler.checkRateLimit = checkRateLimit;
serverlessHandler.recordFailedLogin = recordFailedLogin;
serverlessHandler.resetLoginAttempts = resetLoginAttempts;
serverlessHandler.isStaticFileAllowed = isStaticFileAllowed;
serverlessHandler.PORT = PORT;
serverlessHandler.ADMIN_PORT = ADMIN_PORT;
serverlessHandler.DATA_PATH = DATA_PATH;

module.exports = serverlessHandler;
