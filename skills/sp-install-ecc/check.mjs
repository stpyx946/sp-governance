#!/usr/bin/env node
/**
 * sp-install-ecc/check.mjs
 * Detects ECC installation status, version, and compatibility.
 * Usage: node check.mjs
 */
import { detectECC, checkCompatibility } from '../../scripts/lib/integration.mjs';

try {
  const ecc = detectECC();
  const compat = checkCompatibility(ecc, '1.8.0');

  const result = {
    installed: ecc.found,
    version: ecc.version,
    path: ecc.path,
    compatibility: compat,
    min_required: '1.8.0',
  };

  if (!ecc.found) {
    result.install_guide = {
      npm: 'npm install -g ecc-universal',
      npx: 'npx ecc install --profile developer --target claude',
      plugin: 'claude plugin install everything-claude-code',
    };
  }

  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
