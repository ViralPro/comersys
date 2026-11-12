#!/usr/bin/env node
/**
 * ============================================================================
 * COMERSYS ENGINEERING CYCLE — SCRIPT DE CHECKPOINT GIT
 * ============================================================================
 * Verifica que las pruebas pasen antes de crear un commit de punto de control.
 * ============================================================================
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const msg = process.argv.slice(2).join(' ').trim() || `checkpoint: ciclo de ingenieria ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`;

console.log(`\n[Punto de Control] Ejecutando verificación de calidad previa...`);

try {
  execSync('node scripts/engineering-check.js', { cwd: ROOT_DIR, stdio: 'inherit' });
} catch {
  console.error('\n[Error] No se puede crear el punto de control: las pruebas fallaron.');
  process.exit(1);
}

try {
  const status = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
  if (!status) {
    console.log('[Punto de Control] Árbol de trabajo limpio. No hay cambios pendientes por guardar.');
    process.exit(0);
  }

  execSync('git add -A', { cwd: ROOT_DIR });
  execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { cwd: ROOT_DIR, stdio: 'inherit' });
  console.log(`\n[Punto de Control] Punto de control guardado con éxito: "${msg}"\n`);
} catch (err) {
  console.error(`\n[Error en Git] ${err.message}`);
  process.exit(1);
}
