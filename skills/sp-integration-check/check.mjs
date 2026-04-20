#!/usr/bin/env node
/**
 * sp-integration-check/check.mjs
 * Outputs SP/OMC/ECC integration state as structured JSON.
 * Usage: node check.mjs [workspaceRoot]
 */
import { refreshIntegrationState, findIntegrationState } from '../../scripts/lib/integration.mjs';

const workspaceRoot = process.argv[2] || process.cwd();

try {
  // Try cached state first; refresh if missing
  let state = findIntegrationState(workspaceRoot);
  if (!state) {
    state = refreshIntegrationState(workspaceRoot);
  }
  console.log(JSON.stringify(state, null, 2));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
