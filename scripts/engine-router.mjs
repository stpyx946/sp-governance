#!/usr/bin/env node
/**
 * engine-router.mjs — dispatches hook execution to v9 or v10 script.
 *
 * Reads .omc/sp.json::execution_engine (default 'v10') from workspace root.
 * Invocation:
 *   node scripts/engine-router.mjs <guard-name>
 * Where <guard-name> is one of: bootstrap-guard | pm-allowlist-guard | route-guard
 *
 * Resolves to scripts/sp-<guard-name>.mjs (v10) or scripts/sp-<guard-name>.v9.mjs (v9).
 *
 * Fail-safe:
 *   - sp.json missing/corrupt → default to v10
 *   - target script missing → passes through (continue:true) without throwing
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPortfolioRoot } from './lib/portfolio.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function passThrough() {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

async function main() {
  const guardName = process.argv[2];
  if (!guardName) {
    passThrough();
    return;
  }

  let engine = 'v10';
  try {
    const rawCwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const cwd = findPortfolioRoot(rawCwd);
    const spPath = join(cwd, '.omc', 'sp.json');
    if (existsSync(spPath)) {
      const sp = JSON.parse(readFileSync(spPath, 'utf-8'));
      if (sp.execution_engine === 'v9') engine = 'v9';
    }
  } catch { /* default to v10 */ }

  const script = engine === 'v9'
    ? `sp-${guardName}.v9.mjs`
    : `sp-${guardName}.mjs`;
  const scriptPath = resolve(__dirname, script);

  if (!existsSync(scriptPath)) {
    passThrough();
    return;
  }

  try {
    await import(scriptPath);
  } catch (e) {
    // Hook script crashed — do not block user
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

main();
