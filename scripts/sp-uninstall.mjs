#!/usr/bin/env node

/**
 * SP Governance — Full Uninstall Script
 * Cross-platform: Windows / Linux / macOS
 *
 * Completely removes all SP governance traces:
 *   1. Creates .sp-disabled to disable hooks immediately
 *   2. Removes SP block from ~/.claude/CLAUDE.md
 *   3. Removes SP block from workspace CLAUDE.md
 *   4. Deletes .omc/bootstrap-state.json
 *   5. Deletes portfolio.json
 *   6. Deletes .sp-disabled
 *   7. Removes installed plugin files (~/.claude/plugins/sp-governance/)
 *   8. Removes marketplace registration (~/.claude/plugins/marketplaces/sp-governance/)
 *   9. Removes plugin cache (~/.claude/plugins/cache/sp-governance/)
 *  10. Cleans installed_plugins.json entry
 *  11. Outputs cleanup report
 *
 * Usage:
 *   node sp-governance/scripts/sp-uninstall.mjs           # Full uninstall
 *   node sp-governance/scripts/sp-uninstall.mjs --dry-run  # Preview only
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, rmSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DRY_RUN = process.argv.includes('--dry-run');
const SP_BLOCK_RE = /^<!-- SP:START -->[\t ]*\r?\n[\s\S]*?^<!-- SP:END -->[\t ]*\r?\n?/gm;

const report = { removed: [], skipped: [], errors: [] };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(`[SP-Uninstall] ${msg}`);
}

function record(action, path, status) {
  if (status === 'removed') report.removed.push({ action, path });
  else if (status === 'skipped') report.skipped.push({ action, path });
  else if (status === 'error') report.errors.push({ action, path });
}

function safeDelete(filePath, label) {
  if (!existsSync(filePath)) {
    record(label, filePath, 'skipped');
    return;
  }
  if (DRY_RUN) {
    log(`[DRY-RUN] Would delete: ${filePath}`);
    record(label, filePath, 'removed');
    return;
  }
  try {
    unlinkSync(filePath);
    record(label, filePath, 'removed');
  } catch (e) {
    log(`Error deleting ${filePath}: ${e.message}`);
    record(label, filePath, 'error');
  }
}

function safeDeleteDir(dirPath, label) {
  if (!existsSync(dirPath)) {
    record(label, dirPath, 'skipped');
    return;
  }
  if (DRY_RUN) {
    log(`[DRY-RUN] Would delete directory: ${dirPath}`);
    record(label, dirPath, 'removed');
    return;
  }
  try {
    rmSync(dirPath, { recursive: true, force: true });
    record(label, dirPath, 'removed');
  } catch (e) {
    log(`Error deleting directory ${dirPath}: ${e.message}`);
    record(label, dirPath, 'error');
  }
}

function removeSPBlock(content) {
  return content.replace(/\r\n/g, '\n').replace(SP_BLOCK_RE, '').trimEnd() + '\n';
}

function cleanSPBlockFromFile(filePath, label) {
  if (!existsSync(filePath)) {
    record(label, filePath, 'skipped');
    return;
  }
  const content = readFileSync(filePath, 'utf-8');
  if (!content.includes('<!-- SP:START -->')) {
    record(label, filePath, 'skipped');
    return;
  }
  if (DRY_RUN) {
    log(`[DRY-RUN] Would clean SP block from: ${filePath}`);
    record(label, filePath, 'removed');
    return;
  }
  try {
    writeFileSync(filePath, removeSPBlock(content));
    record(label, filePath, 'removed');
  } catch (e) {
    log(`Error cleaning ${filePath}: ${e.message}`);
    record(label, filePath, 'error');
  }
}

/**
 * Find workspace root by walking up from CWD looking for portfolio.json.
 */
function findWorkspaceRoot() {
  let dir = process.cwd();
  while (true) {
    if (existsSync(join(dir, 'portfolio.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: assume sp-governance is in workspace/sp-governance/
  const pluginRoot = resolve(__dirname, '..');
  const candidate = dirname(pluginRoot);
  if (existsSync(join(candidate, 'portfolio.json'))) return candidate;
  return null;
}

// ---------------------------------------------------------------------------
// Uninstall steps
// ---------------------------------------------------------------------------

function step1_disableHooks(workspaceRoot) {
  log('Step 1: Disabling hooks (.sp-disabled)');
  if (workspaceRoot) {
    const disabledPath = join(workspaceRoot, '.sp-disabled');
    if (!DRY_RUN) {
      try { writeFileSync(disabledPath, `disabled by sp-uninstall at ${new Date().toISOString()}\n`); }
      catch { /* ignore */ }
    }
  }
}

function step2_cleanGlobalClaudeMd() {
  log('Step 2: Cleaning global ~/.claude/CLAUDE.md');
  const claudeMdPath = join(homedir(), '.claude', 'CLAUDE.md');
  cleanSPBlockFromFile(claudeMdPath, 'Global CLAUDE.md SP block');
}

function step3_cleanWorkspaceClaudeMd(workspaceRoot) {
  log('Step 3: Cleaning workspace CLAUDE.md');
  if (!workspaceRoot) {
    record('Workspace CLAUDE.md', 'N/A', 'skipped');
    return;
  }
  const claudeMdPath = join(workspaceRoot, 'CLAUDE.md');
  cleanSPBlockFromFile(claudeMdPath, 'Workspace CLAUDE.md SP block');
}

function step4_deleteBootstrapState(workspaceRoot) {
  log('Step 4: Deleting bootstrap state');
  if (!workspaceRoot) {
    record('bootstrap-state.json', 'N/A', 'skipped');
    return;
  }
  // Check both locations
  safeDelete(join(workspaceRoot, '.omc', 'bootstrap-state.json'), 'bootstrap-state.json (.omc/)');
  safeDelete(join(workspaceRoot, 'bootstrap-state.json'), 'bootstrap-state.json (root)');
}

function step5_deletePortfolio(workspaceRoot) {
  log('Step 5: Deleting portfolio.json');
  if (!workspaceRoot) {
    record('portfolio.json', 'N/A', 'skipped');
    return;
  }
  safeDelete(join(workspaceRoot, 'portfolio.json'), 'portfolio.json');
}

function step6_deleteSpDisabled(workspaceRoot) {
  log('Step 6: Cleaning .sp-disabled marker');
  if (!workspaceRoot) return;
  safeDelete(join(workspaceRoot, '.sp-disabled'), '.sp-disabled');
}

function step7_deleteInstalledPlugin() {
  log('Step 7: Removing installed plugin files');
  const pluginDir = join(homedir(), '.claude', 'plugins', 'sp-governance');
  safeDeleteDir(pluginDir, 'Installed plugin directory');
}

function step8_deleteMarketplace() {
  log('Step 8: Removing marketplace registration');
  const marketDir = join(homedir(), '.claude', 'plugins', 'marketplaces', 'sp-governance');
  safeDeleteDir(marketDir, 'Marketplace directory');
}

function step9_deleteCache() {
  log('Step 9: Removing plugin cache');
  const cacheDir = join(homedir(), '.claude', 'plugins', 'cache', 'sp-governance');
  safeDeleteDir(cacheDir, 'Plugin cache directory');
}

function step10_cleanInstalledPluginsJson() {
  log('Step 10: Cleaning installed_plugins.json');
  const jsonPath = join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
  if (!existsSync(jsonPath)) {
    record('installed_plugins.json', jsonPath, 'skipped');
    return;
  }
  try {
    const raw = readFileSync(jsonPath, 'utf-8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    const keys = Object.keys(data);
    const spKeys = keys.filter(k => k.toLowerCase().includes('sp-governance'));
    if (spKeys.length === 0) {
      record('installed_plugins.json entry', jsonPath, 'skipped');
      return;
    }
    if (DRY_RUN) {
      log(`[DRY-RUN] Would remove keys from installed_plugins.json: ${spKeys.join(', ')}`);
      record('installed_plugins.json entry', jsonPath, 'removed');
      return;
    }
    for (const key of spKeys) {
      delete data[key];
    }
    writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
    record('installed_plugins.json entry', jsonPath, 'removed');
  } catch (e) {
    log(`Error cleaning installed_plugins.json: ${e.message}`);
    record('installed_plugins.json', jsonPath, 'error');
  }
}

function step11_deleteAuditLogs(workspaceRoot) {
  log('Step 11: Cleaning SP audit logs');
  if (!workspaceRoot) return;
  const auditLog = join(workspaceRoot, '.omc', 'logs', 'pm-audit.jsonl');
  safeDelete(auditLog, 'PM audit log');
  // Clean rotated logs
  for (let i = 1; i <= 3; i++) {
    safeDelete(`${auditLog}.${i}`, `PM audit log .${i}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('');
  log(DRY_RUN ? '=== DRY RUN MODE (no changes will be made) ===' : '=== Starting full SP governance uninstall ===');
  console.log('');

  const workspaceRoot = findWorkspaceRoot();
  if (workspaceRoot) {
    log(`Workspace root: ${workspaceRoot}`);
  } else {
    log('Warning: Could not find workspace root (no portfolio.json found)');
  }
  console.log('');

  step1_disableHooks(workspaceRoot);
  step2_cleanGlobalClaudeMd();
  step3_cleanWorkspaceClaudeMd(workspaceRoot);
  step4_deleteBootstrapState(workspaceRoot);
  step5_deletePortfolio(workspaceRoot);
  step6_deleteSpDisabled(workspaceRoot);
  step7_deleteInstalledPlugin();
  step8_deleteMarketplace();
  step9_deleteCache();
  step10_cleanInstalledPluginsJson();
  step11_deleteAuditLogs(workspaceRoot);

  // Print report
  console.log('');
  log('=== Cleanup Report ===');
  console.log('');

  if (report.removed.length > 0) {
    log(`Removed (${report.removed.length}):`);
    for (const r of report.removed) {
      console.log(`  - ${r.action}: ${r.path}`);
    }
  }

  if (report.skipped.length > 0) {
    log(`Skipped (${report.skipped.length}):`);
    for (const s of report.skipped) {
      console.log(`  - ${s.action}: ${s.path}`);
    }
  }

  if (report.errors.length > 0) {
    log(`Errors (${report.errors.length}):`);
    for (const e of report.errors) {
      console.log(`  - ${e.action}: ${e.path}`);
    }
  }

  console.log('');
  if (DRY_RUN) {
    log('Dry run complete. No changes were made.');
    log('Run without --dry-run to perform actual uninstall.');
  } else {
    if (report.errors.length === 0) {
      log('SP Governance has been completely uninstalled.');
    } else {
      log(`Uninstall completed with ${report.errors.length} error(s). Check paths above.`);
    }
    log('Please restart Claude Code for changes to take effect.');
  }
}

main();
