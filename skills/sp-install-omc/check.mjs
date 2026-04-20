#!/usr/bin/env node
/**
 * sp-install-omc/check.mjs
 * Detects OMC installation status, version, and compatibility.
 * Usage: node check.mjs
 */
import { detectOMC, checkCompatibility } from '../../scripts/lib/integration.mjs';

try {
  const omc = detectOMC();
  const compat = checkCompatibility(omc, '1.0.0');

  const result = {
    installed: omc.found,
    version: omc.version,
    path: omc.path,
    compatibility: compat,
    min_required: '1.0.0',
  };

  if (!omc.found) {
    result.install_guide = {
      plugin: 'claude plugin install oh-my-claudecode',
      skill: '/oh-my-claudecode:omc-setup',
    };
  }

  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
