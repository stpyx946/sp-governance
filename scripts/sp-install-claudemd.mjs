#!/usr/bin/env node

/**
 * SP Governance — Global CLAUDE.md Installer
 * Cross-platform: Windows / Linux / macOS
 *
 * Injects a lightweight SP awareness block into ~/.claude/CLAUDE.md
 * using <!-- SP:START --> / <!-- SP:END --> markers.
 *
 * Coexists with OMC's <!-- OMC:START --> / <!-- OMC:END --> markers.
 *
 * Usage:
 *   node scripts/sp-install-claudemd.mjs
 *   node scripts/sp-install-claudemd.mjs --uninstall
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SP_START = '<!-- SP:START -->';
const SP_END = '<!-- SP:END -->';

// Match SP block with both CRLF and LF line endings
const SP_BLOCK_RE = /^<!-- SP:START -->[\t ]*\r?\n[\s\S]*?^<!-- SP:END -->[\t ]*\r?\n?/gm;

/**
 * Resolve the plugin root directory.
 * Prefers CLAUDE_PLUGIN_ROOT env (set by hook runtime), falls back to parent of scripts/.
 */
function resolvePluginRoot() {
  return process.env.CLAUDE_PLUGIN_ROOT || join(__dirname, '..');
}

/**
 * Load the lightweight SP snippet from docs/global-claude-snippet.md.
 * Normalizes line endings to LF.
 */
function loadSnippet() {
  const snippetPath = join(resolvePluginRoot(), 'docs', 'global-claude-snippet.md');
  if (!existsSync(snippetPath)) {
    throw new Error(`Snippet not found: ${snippetPath}`);
  }
  return readFileSync(snippetPath, 'utf-8').replace(/\r\n/g, '\n').trim();
}

/**
 * Merge SP block into existing CLAUDE.md content.
 *
 * - If no existing content: return SP block only
 * - If existing has SP markers: replace the SP block
 * - If no SP markers: append SP block at the end
 * - Corrupted markers (orphaned start/end): conservative append
 *
 * @param {string|null} existing - Current CLAUDE.md content (null if file doesn't exist)
 * @param {string} snippet - SP snippet content (without markers)
 * @returns {string} Merged content
 */
function mergeSPBlock(existing, snippet) {
  const block = `${SP_START}\n${snippet}\n${SP_END}\n`;

  if (!existing) return block;

  // Normalize line endings
  const content = existing.replace(/\r\n/g, '\n');

  // Remove existing SP block(s)
  const stripped = content.replace(SP_BLOCK_RE, '');

  // Check for orphaned markers (corrupted state)
  if (stripped.includes(SP_START) || stripped.includes(SP_END)) {
    // Conservative: append after existing content, don't remove corrupted markers
    return content.trimEnd() + '\n\n' + block;
  }

  const trimmed = stripped.trimEnd();
  return trimmed ? trimmed + '\n\n' + block : block;
}

/**
 * Remove SP block from existing CLAUDE.md content.
 *
 * @param {string} existing - Current CLAUDE.md content
 * @returns {string} Content with SP block removed
 */
function removeSPBlock(existing) {
  const content = existing.replace(/\r\n/g, '\n');
  const stripped = content.replace(SP_BLOCK_RE, '');
  return stripped.trimEnd() + '\n';
}

/**
 * Create a timestamped backup of the CLAUDE.md file.
 *
 * @param {string} claudeDir - Path to ~/.claude/
 * @param {string} content - Content to back up
 */
function createBackup(claudeDir, content) {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').split('T');
  const backupName = `CLAUDE.md.backup.${ts[0]}T${ts[1].slice(0, 8)}`;
  writeFileSync(join(claudeDir, backupName), content);
}

function main() {
  const isUninstall = process.argv.includes('--uninstall');

  const claudeDir = join(homedir(), '.claude');
  const claudeMdPath = join(claudeDir, 'CLAUDE.md');

  // Ensure ~/.claude/ exists
  mkdirSync(claudeDir, { recursive: true });

  if (isUninstall) {
    if (!existsSync(claudeMdPath)) {
      console.log('[SP] No CLAUDE.md found, nothing to uninstall.');
      return;
    }
    const existing = readFileSync(claudeMdPath, 'utf-8');
    if (!existing.includes(SP_START)) {
      console.log('[SP] No SP block found in CLAUDE.md, nothing to uninstall.');
      return;
    }
    createBackup(claudeDir, existing);
    writeFileSync(claudeMdPath, removeSPBlock(existing));
    console.log('[SP] SP block removed from ~/.claude/CLAUDE.md');
    return;
  }

  // Install / update
  const snippet = loadSnippet();
  let existing = null;

  if (existsSync(claudeMdPath)) {
    existing = readFileSync(claudeMdPath, 'utf-8');
    createBackup(claudeDir, existing);
  }

  writeFileSync(claudeMdPath, mergeSPBlock(existing, snippet));
  console.log('[SP] CLAUDE.md injected successfully.');
}

main();
