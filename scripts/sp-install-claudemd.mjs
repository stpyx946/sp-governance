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
import { findIntegrationState } from './lib/integration.mjs';
import { findPortfolioRoot } from './lib/portfolio.mjs';

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

/**
 * Dynamically generate the runtime mode section for the SP block.
 *
 * @param {object|null} integrationState - Parsed .sp/integration.json, or null if absent.
 * @returns {string} Markdown section string (includes trailing newline).
 */
function generateRuntimeModeSection(integrationState) {
  // integration state absent — treat as SP-only
  if (!integrationState) {
    return `
## 运行模式: SP-only

| 层 | 组件 | 状态 |
|----|------|------|
| 治理 | SP Governance | ✓ active |
| 编排 | OMC | ✗ 未检测 — 运行 /sp-governance:sp-install-omc 安装 |
| 质量 | ECC | ✗ 未检测 — 运行 /sp-governance:sp-install-ecc 安装 |
`;
  }

  // Schema-compliant fields: state.runtime_mode, state.integrations.omc.detected, etc.
  const mode = integrationState.runtime_mode || 'sp-only';
  const omc = integrationState.integrations?.omc || {};
  const ecc = integrationState.integrations?.ecc || {};

  const modeLabel = {
    'full': 'SP + OMC + ECC (完整模式)',
    'sp-omc': 'SP + OMC',
    'sp-ecc': 'SP + ECC',
    'sp-only': 'SP-only',
  }[mode] || mode;

  const spVersion = integrationState.sp_version || '9.0.0';
  const omcStatus = omc.detected
    ? `✓ active (v${omc.version})`
    : '✗ 未安装 — 运行 /sp-governance:sp-install-omc 安装';
  const eccStatus = ecc.detected
    ? `✓ active (v${ecc.version})`
    : '✗ 未安装 — 运行 /sp-governance:sp-install-ecc 安装';

  let section = `
## 运行模式: ${modeLabel}

| 层 | 组件 | 状态 |
|----|------|------|
| 治理 | SP Governance v${spVersion} | ✓ active |
| 编排 | OMC | ${omcStatus} |
| 质量 | ECC | ${eccStatus} |
`;

  if (omc.detected) {
    section += `
### 当 OMC 可用时
- 使用 OMC Agent 目录派发任务 (architect/executor/verifier 等)
- 复杂任务使用 OMC 执行模式 (team/autopilot/ralph)
- Agent 编排委托给 OMC
`;
  } else {
    section += `
### 当 OMC 不可用时
- SP 直接调用 Agent 工具，串行执行
- 使用 SP Skill 作为操作指南
`;
  }

  if (ecc.detected) {
    section += `
### 当 ECC 可用时
- Agent prompt 中注入项目对应的 ECC 编码规范 (rules)
- 编辑后由 ECC quality hooks 自动检查
- SP Skill 执行时附加 ECC 领域知识
`;
  } else {
    section += `
### 当 ECC 不可用时
- Agent 按内置知识工作，无外部编码规范
- 手动调用 sp-lint/sp-typecheck 做质量检查
`;
  }

  return section;
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
  const baseSnippet = loadSnippet();

  // Resolve runtime mode section (fail-safe: fall back to SP-only)
  let runtimeModeSection = '';
  try {
    const workspaceRoot = findPortfolioRoot(process.cwd()) || process.cwd();
    const integrationState = findIntegrationState(workspaceRoot);
    runtimeModeSection = generateRuntimeModeSection(integrationState);
  } catch {
    runtimeModeSection = generateRuntimeModeSection(null);
  }

  const snippet = runtimeModeSection.trimStart() + '\n' + baseSnippet;
  let existing = null;

  if (existsSync(claudeMdPath)) {
    existing = readFileSync(claudeMdPath, 'utf-8');
    createBackup(claudeDir, existing);
  }

  writeFileSync(claudeMdPath, mergeSPBlock(existing, snippet));
  console.log('[SP] CLAUDE.md injected successfully.');
}

main();
