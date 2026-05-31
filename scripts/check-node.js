#!/usr/bin/env node
/**
 * scripts/check-node.js
 * Verifica que la versión de Node.js sea v24.16.0 (o superior compatible).
 * - Si es menor: muestra mensaje y aborta con código 1.
 * - Si es la misma o mayor major: confirma OK.
 *
 * Uso:
 *   npm run check-node
 */

'use strict';

const REQUIRED = { major: 24, minor: 16, patch: 0 };

function parse(v) {
  const clean = String(v).replace(/^v/, '');
  const [major, minor, patch] = clean.split('.').map(n => parseInt(n, 10));
  return { major, minor, patch };
}
function cmp(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

const current = parse(process.version);
const diff = cmp(current, REQUIRED);

console.log(`\n🔎 Node.js detectado: ${process.version}`);
console.log(`🎯 Requerido: v${REQUIRED.major}.${REQUIRED.minor}.${REQUIRED.patch} (o superior compatible)\n`);

if (diff < 0) {
  console.error('❌ Versión de Node incompatible.');
  console.error(`   Instala Node v${REQUIRED.major}.${REQUIRED.minor}.${REQUIRED.patch} o superior.`);
  console.error('   Recomendado:   nvm install 24.16.0 && nvm use 24.16.0\n');
  process.exit(1);
}

if (current.major !== REQUIRED.major) {
  console.warn(`⚠️  Estás en Node v${current.major}.x. Recomendado v${REQUIRED.major}.${REQUIRED.minor}.${REQUIRED.patch}.`);
  console.warn('   Puede funcionar, pero no está garantizado.\n');
} else {
  console.log('✅ Todo está bien con el código para Node v24.16.0\n');
}

// APIs nativas verificadas (todas en Node 24):
//   - fetch global
//   - fs/promises
//   - crypto.webcrypto / crypto.randomUUID
//   - node:path, node:url, node:http
// No requiere polyfills.
