#!/usr/bin/env node
/**
 * ============================================================================
 * COMERSYS ENGINEERING CYCLE — SCRIPT DE VERIFICACIÓN INTEGRAL
 * ============================================================================
 * Ejecuta validaciones de salud, sintaxis de código, integridad de datos
 * y la suite de pruebas unitarias e integrales en menos de 1 segundo.
 * ============================================================================
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const startTime = Date.now();

console.log('\n==============================================================');
console.log('  COMERSYS — CICLO DE INGENIERÍA: CONTROL DE CALIDAD Y PRUEBAS');
console.log('==============================================================\n');

let hasErrors = false;

function step(title, fn) {
  process.stdout.write(` [..] ${title}...`);
  try {
    fn();
    process.stdout.write(`\r [\x1b[32mOK\x1b[0m] ${title}\n`);
  } catch (err) {
    process.stdout.write(`\r [\x1b[31mFALLO\x1b[0m] ${title}\n`);
    console.error(`      \x1b[31mError:\x1b[0m ${err.message}`);
    hasErrors = true;
  }
}

// 1. Verificación de Integridad de Base de Datos
step('Integridad de Base de Datos (data/comersys_platform.json)', () => {
  const dbPath = path.join(ROOT_DIR, 'data', 'comersys_platform.json');
  if (!fs.existsSync(dbPath)) throw new Error('Archivo de base de datos no existe');
  let raw = fs.readFileSync(dbPath, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const data = JSON.parse(raw);
  if (!data.superadmin || !data.tenants) throw new Error('Estructura de datos incompleta');
});

// 2. Verificación de Sintaxis de Servidor
step('Sintaxis del Servidor (server.js)', () => {
  execSync('node -c server.js', { cwd: ROOT_DIR, stdio: 'pipe' });
});

// 3. Verificación de Recursos Críticos Frontend
step('Archivos Críticos Frontend (index.html, admin-central)', () => {
  const critical = [
    'index.html',
    'admin-central/index.html',
    'css/variables.css',
    'css/base.css',
    'css/layout.css',
    'js/app.js',
    'admin-central/js/admin.js'
  ];
  for (const f of critical) {
    if (!fs.existsSync(path.join(ROOT_DIR, f))) {
      throw new Error(`Archivo crítico ausente: ${f}`);
    }
  }
});

// 4. Ejecución de la Suite de Pruebas Automáticas
step('Suite de Pruebas Automáticas (node --test)', () => {
  execSync('npm test', { cwd: ROOT_DIR, stdio: 'pipe' });
});

const elapsed = (Date.now() - startTime) / 1000;
console.log('\n--------------------------------------------------------------');
if (hasErrors) {
  console.log(` \x1b[31mESTADO: FALLÓ LA VERIFICACIÓN (Tiempo: ${elapsed.toFixed(2)}s)\x1b[0m`);
  console.log(' Corrija los errores antes de continuar el ciclo de ingeniería.');
  console.log('--------------------------------------------------------------\n');
  process.exit(1);
} else {
  console.log(` \x1b[32mESTADO: 100% VERIFICADO CON ÉXITO (Tiempo: ${elapsed.toFixed(2)}s)\x1b[0m`);
  console.log(' El proyecto cumple con todos los controles de calidad e integridad.');
  console.log('--------------------------------------------------------------\n');
  process.exit(0);
}
