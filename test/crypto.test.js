const { describe, it } = require('node:test');
const assert = require('node:assert');
const { hashPassword, verifyPassword } = require('../server.js');

describe('Seguridad Criptográfica PBKDF2', () => {
  it('debe generar un hash con formato saltHex:hashHex', () => {
    const hash = hashPassword('MiClaveSegura2026!');
    assert.strictEqual(typeof hash, 'string');
    const parts = hash.split(':');
    assert.strictEqual(parts.length, 2, 'El hash debe tener exactamente dos partes separadas por dos puntos');
    assert.strictEqual(parts[0].length, 32, 'El Salt debe ser de 16 bytes (32 caracteres hex)');
    assert.strictEqual(parts[1].length, 64, 'La clave derivada debe ser de 32 bytes (64 caracteres hex)');
  });

  it('debe generar sales únicas para la misma contraseña en llamadas sucesivas', () => {
    const hash1 = hashPassword('mismaContraseña');
    const hash2 = hashPassword('mismaContraseña');
    assert.notStrictEqual(hash1, hash2, 'Dos hashes de la misma contraseña no deben ser idénticos (salt aleatorio)');
  });

  it('debe verificar correctamente una contraseña válida', () => {
    const password = 'ComerSysSecurePassword#1';
    const hash = hashPassword(password);
    const isValid = verifyPassword(password, hash);
    assert.strictEqual(isValid, true, 'verifyPassword debe retornar true para la contraseña correcta');
  });

  it('debe rechazar una contraseña incorrecta', () => {
    const password = 'PasswordCorrecta';
    const hash = hashPassword(password);
    const isValid = verifyPassword('PasswordIncorrecta', hash);
    assert.strictEqual(isValid, false, 'verifyPassword debe retornar false para una contraseña incorrecta');
  });

  it('debe manejar entradas malformadas o nulas de forma segura sin excepciones', () => {
    assert.strictEqual(verifyPassword(null, 'salt:hash'), false);
    assert.strictEqual(verifyPassword('pass', null), false);
    assert.strictEqual(verifyPassword('', ''), false);
    assert.strictEqual(verifyPassword('pass', 'formato-invalido'), false);
  });
});
