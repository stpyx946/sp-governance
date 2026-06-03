#!/usr/bin/env node
/**
 * SP Governance v9 → v10 migration script.
 *
 * Usage:
 *   node scripts/migrate-v9-to-v10.mjs [workspaceRoot]
 *
 * Steps:
 *   1. Detect v9 residue (.omc/state/integration.json, .sp/integration.json).
 *   2. Read installed_plugins.json to enumerate marketplaces.
 *   3. Build .omc/sp.json with execution_engine=v10, trust.default_policy=ask.
 *      Pre-populate trust.marketplaces: mark as "allow" if v9 trusted it
 *      (heuristic: omc/sp-governance/everything-claude-code/superpowers-marketplace),
 *      else "ask".
 *   4. Inject SP:START/END block into workspace CLAUDE.md if missing.
 *   5. Back up v9 residue files (.v9.bak.<ts> suffix).
 *   6. Print a report.
 *
 * Idempotent: re-running on a v10 workspace is a no-op.
 */

import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPortfolioRoot } from './lib/portfolio.mjs';
import { readInstalledPlugins } from './lib/plugin-index.mjs';
import { createDefaultState, writeSPState, readSPState, SCHEMA_NAME } from './lib/trust-policy.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Known v9-trusted marketplaces (used ONLY for migration heuristic).
// Plan-agent self-audit correction: this is the ONLY allowed location in v10
// code that names specific upstream marketplaces. Any other code referencing
// these names is a v10 contract violation.
const V9_TRUSTED_MARKETPLACES = new Set([
  'omc',
  'sp-governance',
  'everything-claude-code',
  'superpowers-marketplace',
]);

function backupFile(path) {
  if (!existsSync(path)) return false;
  const bak = `${path}.v9.bak.${Date.now()}`;
  try { renameSync(path, bak); return bak; }
  catch { return false; }
}

function injectSPBlock(claudeMdPath, pluginRoot) {
  const SP_START = '<!-- SP:START -->';
  const SP_END = '<!-- SP:END -->';
  let existing = '';
  if (existsSync(claudeMdPath)) {
    existing = readFileSync(claudeMdPath, 'utf-8');
    if (existing.includes(SP_START)) return { action: 'already-injected' };
  }
  const snippetPath = join(pluginRoot, 'docs', 'global-claude-snippet.md');
  if (!existsSync(snippetPath)) return { action: 'snippet-missing' };
  const snippet = readFileSync(snippetPath, 'utf-8').trim();
  const block = `\n\n${SP_START}\n${snippet}\n${SP_END}\n`;
  const next = existing.trimEnd() + block;
  try {
    writeFileSync(claudeMdPath, next);
    return { action: 'injected' };
  } catch (e) {
    return { action: 'write-failed', error: e.message };
  }
}

function main() {
  const cwdArg = process.argv[2] || process.cwd();
  const cwd = findPortfolioRoot(cwdArg);
  const report = { workspace: cwd, steps: [] };

  // Step 1: Detect v9 residue
  const v9PathA = join(cwd, '.omc', 'state', 'integration.json');
  const v9PathB = join(cwd, '.sp', 'integration.json');
  let v9Found = false;
  let v9Backup = null;
  if (existsSync(v9PathA)) {
    v9Found = true;
    v9Backup = backupFile(v9PathA);
  }
  if (existsSync(v9PathB)) {
    v9Found = true;
    const b = backupFile(v9PathB);
    if (b) v9Backup = v9Backup || b;
  }
  report.steps.push({ name: 'detect-v9-residue', found: v9Found, backup: v9Backup });

  // Step 2: Read installed_plugins.json
  const installed = readInstalledPlugins();
  const marketplaces = [...new Set(installed.map(p => p.marketplace).filter(Boolean))];
  report.steps.push({ name: 'read-installed-plugins', count: installed.length, marketplaces });

  // Step 3: Generate or upgrade sp.json
  const spPath = join(cwd, '.omc', 'sp.json');
  const spExists = existsSync(spPath);
  const existingState = readSPState(cwd);
  let writeState = false;
  if (!spExists || existingState.schema !== SCHEMA_NAME) {
    const state = createDefaultState();
    state.trust.default_policy = 'ask';
    for (const mkt of marketplaces) {
      state.trust.marketplaces[mkt] = V9_TRUSTED_MARKETPLACES.has(mkt) ? 'allow' : 'ask';
    }
    state.trust.decisions.push({
      ts: new Date().toISOString(),
      action: 'migrate-v9-to-v10',
      note: 'Auto-migrated from v9. Marketplaces in V9_TRUSTED_MARKETPLACES set were pre-allowed.',
    });
    writeSPState(cwd, state);
    writeState = true;
  }
  report.steps.push({ name: 'sp-json', written: writeState, existed: spExists });

  // Step 4: Inject SP:START/END
  const pluginRoot = dirname(__dirname); // scripts/.. → plugin root
  const claudeMd = join(cwd, 'CLAUDE.md');
  const inj = injectSPBlock(claudeMd, pluginRoot);
  report.steps.push({ name: 'claude-md-inject', ...inj });

  // Step 5: Print report
  console.log(JSON.stringify(report, null, 2));
  console.log('\n--- Migration summary ---');
  console.log(`Workspace:         ${cwd}`);
  console.log(`v9 residue:        ${v9Found ? 'backed up' : 'none'}`);
  console.log(`Installed plugins: ${installed.length}`);
  console.log(`Marketplaces:      ${marketplaces.join(', ') || '(none)'}`);
  console.log(`sp.json:           ${writeState ? 'created/upgraded' : 'unchanged'}`);
  console.log(`CLAUDE.md:         ${inj.action}`);
  console.log('\nNext steps:');
  console.log('  1. Review .omc/sp.json — confirm trust.marketplaces decisions.');
  console.log('  2. Run /sp-governance:sp-classify-projects to add governance_mode to projects.');
  console.log('  3. Run /sp-governance:sp-discovery-status to verify capabilities are discovered.');
  console.log('  4. To rollback: change .omc/sp.json::execution_engine to "v9", or type 切换 SP 引擎 v9.');
}

main();
