#!/usr/bin/env node
/**
 * sp-upgrade-check/check.mjs
 * Checks version compatibility across SP/OMC/ECC and reports upgrade advice.
 * Usage: node check.mjs [workspaceRoot]
 */
import { detectOMC, detectECC, checkCompatibility, determineRuntimeMode } from '../../scripts/lib/integration.mjs';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = process.argv[2] || process.cwd();

try {
  const omc = detectOMC();
  const ecc = detectECC();

  const omcCompat = checkCompatibility(omc, '1.0.0');
  const eccCompat = checkCompatibility(ecc, '1.8.0');
  const runtimeMode = determineRuntimeMode(omc, ecc);

  // Read SP version from own package.json
  let spVersion = '0.0.0';
  try {
    const pkgPath = join(__dirname, '..', '..', 'package.json');
    if (existsSync(pkgPath)) {
      spVersion = JSON.parse(readFileSync(pkgPath, 'utf8')).version || '0.0.0';
    }
  } catch { /* ignore */ }

  // Check adapter file completeness
  const adapterDir = join(__dirname, '..', '..', 'scripts', 'adapters');
  const expectedAdapterFiles = [
    'ecc-adapter.mjs', 'ecc-hook-profile.json', 'ecc-learning-bridge.mjs',
    'ecc-rules-map.json', 'ecc-skill-augment.json', 'integration-schema.json',
    'omc-adapter.mjs', 'omc-agent-map.json', 'omc-mode-router.json',
  ];
  const presentFiles = [];
  const missingFiles = [];
  for (const f of expectedAdapterFiles) {
    (existsSync(join(adapterDir, f)) ? presentFiles : missingFiles).push(f);
  }

  const result = {
    versions: {
      sp: spVersion,
      omc: { detected: omc.found, version: omc.version, compatibility: omcCompat },
      ecc: { detected: ecc.found, version: ecc.version, compatibility: eccCompat },
    },
    runtime_mode: runtimeMode,
    adapter_integrity: {
      total: expectedAdapterFiles.length,
      present: presentFiles.length,
      missing: missingFiles,
    },
  };

  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
