#!/usr/bin/env node
/**
 * sp-pm-allowlist-guard.mjs v10 — PreToolUse Hook (* matcher)
 *
 * Dual-role fail-closed allowlist:
 *   - CWD == portfolio root → PM role
 *   - CWD inside registered project (governance_mode=auto) → Team-Lead role
 *   - governance_mode=readonly|off → bypass entirely
 *
 * MCP tool prefixes are derived dynamically from sp.json trust policy
 * (allowed plugins → mcp__plugin_<name>_t__*).
 * No hardcoded upstream MCP tool names.
 *
 * Audit logging extracted to lib/audit-log.mjs.
 */

import { existsSync } from 'node:fs';
import { join, resolve, relative, isAbsolute, extname } from 'node:path';
import { readStdin } from './lib/stdin.mjs';
import { findPortfolioRoot, readPortfolio, getProjectForCwd, isProjectGovernanceSkipped } from './lib/portfolio.mjs';
import { readSPState, filterByTrust } from './lib/trust-policy.mjs';
import { readInstalledPlugins } from './lib/plugin-index.mjs';
import { getTrustedMCPPrefixes } from './lib/capability-discovery.mjs';
import { writeAuditLog } from './lib/audit-log.mjs';

// ---------- Output helpers ----------

function deny(message) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: message,
      additionalContext: `[SP Guard] ${message}`,
    },
  }));
}

function passThrough() {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

function allowWithContext(message) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: `[SP Guard] ${message}`,
    },
  }));
}

// ---------- Allowlist (Claude Code built-in tools only; no upstream MCP names) ----------

const SHARED_ALLOWLIST = new Set([
  'Agent', 'TaskCreate', 'TaskList', 'TaskGet', 'TaskUpdate', 'TaskOutput', 'TaskStop',
  'TeamCreate', 'TeamDelete', 'SendMessage',
  'AskUserQuestion', 'Skill', 'ToolSearch',
  'EnterPlanMode', 'ExitPlanMode', 'EnterWorktree', 'ExitWorktree',
  'CronCreate', 'CronDelete', 'CronList',
  'ScheduleWakeup',
  'Glob', 'Grep', 'Read',
  'NotebookEdit',
  'Write', 'Edit',
  'Bash', 'PowerShell',
]);

const TEAM_LEAD_EXTRA = new Set(['WebFetch', 'WebSearch']);

const PATH_CHECK_TOOLS = new Set(['Write', 'Edit']);
const CMD_CHECK_TOOLS = new Set(['Bash', 'PowerShell']);

// ---------- Path & command constraints ----------

const WRITE_ALLOWED_PATHS = [
  'portfolio.json', 'groups/', 'cross-groups/', '.omc/',
  'templates/', '.sp-disabled', 'bootstrap-state.json',
  'CLAUDE.md', 'AGENTS.md', 'sp-governance/',
];

const WRITE_DENY_PATHS = [
  'sp-governance/governance/',
  'sp-governance/agents/',
];

const BASH_HARD_DENY = [
  /\btee\b/, /\bsed\s+-i/, /\bawk\b.*>/, /\bperl\s+-[ip]/,
  /\bpython[23]?\s/, /\bcurl\s.*-[oO]/, /\bwget\b/,
  /\bnpm\s+(run|start|exec|test|install|ci|build)\b/,
  /\bpnpm\s+(run|start|exec|test|install|build)\b/,
  /\byarn\s+(run|start|test|install|build)\b/,
];

const BASH_ALLOWLIST = [
  /^git\s+(status|log|branch|remote|diff|show|tag|rev-parse|describe|fetch|stash)\b/,
  /^cd(\s|$)/, /^ls(\s|$)/, /^dir(\s|$)/, /^pwd$/, /^wc(\s|$)/, /^file\s/, /^stat\s/, /^du\s/, /^df\s/,
  /^echo(\s|$)/, /^printf\s/, /^date/, /^whoami/, /^uname/, /^env$/, /^printenv/,
  /^which\s/, /^type\s/, /^command\s/, /^test\s/, /^\[/,
  /^head(\s|$)/, /^tail(\s|$)/, /^cat(\s|$)/, /^less(\s|$)/, /^more(\s|$)/,
  /^find\s/, /^tree(\s|$)/, /^sort(\s|$)/, /^uniq(\s|$)/, /^cut(\s|$)/, /^tr\s/,
  /^grep\s/, /^rg\s/, /^ag\s/, /^xargs\s/,
  /^node\s+--version/, /^npm\s+(ls|list|outdated|view|--version)\b/,
  /^pnpm\s+(ls|list|outdated|--version)\b/,
  /^mkdir\s/, /^touch\s/, /^cp\s/, /^mv\s/, /^ln\s/,
  /^zip\s/, /^unzip\s/, /^tar\s/,
  /^gh\s/, /^docker\s+(ps|images|inspect|logs|stats)\b/,
  /^realpath\s/, /^basename\s/, /^dirname\s/, /^readlink\s/,
];

function hasUnsafeNodeCall(cmd) {
  if (!/\bnode\s+(?!--version)/.test(cmd)) return false;
  const pluginRoot = (process.env.CLAUDE_PLUGIN_ROOT || '').replace(/\\/g, '/');
  if (pluginRoot) {
    const normalized = cmd.replace(/\\/g, '/').replace(/"/g, '');
    if (normalized.includes(pluginRoot) || normalized.includes('$CLAUDE_PLUGIN_ROOT')) return false;
  }
  if (/\bnode\s+.*[\\/]\.claude[\\/]plugins[\\/]/.test(cmd.replace(/"/g, ''))) return false;
  return true;
}

function hasUnsafeRedirect(cmd) {
  const stripped = cmd.replace(/2>\s*\/dev\/null/g, '').replace(/2>&1/g, '');
  const redirectMatch = stripped.match(/(?:^|[^2])>\s*(.*)/);
  if (!redirectMatch) return false;
  const target = redirectMatch[1].trim();
  if (target === '/dev/null' || target.startsWith('/dev/null ') || target.startsWith('/dev/null;')) return false;
  return true;
}

function toRelPath(filePath, cwd) {
  if (!filePath) return '';
  const abs = isAbsolute(filePath) ? resolve(filePath) : resolve(cwd, filePath);
  let rel = relative(cwd, abs).replace(/\\/g, '/');
  if (rel.startsWith('./')) rel = rel.slice(2);
  if (rel === '') rel = '.';
  return rel;
}

function checkWritePath(filePath, cwd) {
  const rel = toRelPath(filePath, cwd);
  if (rel.startsWith('..')) return { ok: false, reason: `禁止写入工作区外: ${rel}` };
  for (const d of WRITE_DENY_PATHS) {
    if (rel.startsWith(d)) return { ok: false, reason: `治理文件受保护: ${rel} (需用户明确审批)` };
  }
  for (const p of WRITE_ALLOWED_PATHS) {
    if (rel === p || rel === p.replace(/\/$/, '') || rel.startsWith(p)) return { ok: true };
  }
  if (extname(rel).toLowerCase() === '.md') return { ok: true };
  return { ok: false, reason: `禁止写入: ${rel} (业务代码请委派 agent)` };
}

function splitCompoundCommand(command) {
  const segments = [];
  let current = '', i = 0, depth = 0;
  while (i < command.length) {
    const ch = command[i];
    if (ch === "'") { current += ch; i++; while (i < command.length && command[i] !== "'") current += command[i++]; if (i < command.length) current += command[i++]; continue; }
    if (ch === '"') { current += ch; i++; while (i < command.length && command[i] !== '"') { if (command[i] === '\\') { current += command[i++]; } if (i < command.length) current += command[i++]; } if (i < command.length) current += command[i++]; continue; }
    if (ch === '$' && command[i+1] === '(') { depth++; current += ch + command[i+1]; i += 2; continue; }
    if (ch === '(') { depth++; current += ch; i++; continue; }
    if (ch === ')') { if (depth > 0) depth--; current += ch; i++; continue; }
    if (depth === 0) {
      if (ch === '&' && command[i+1] === '&') { segments.push(current); current = ''; i += 2; while (i < command.length && command[i] === ' ') i++; continue; }
      if (ch === '|' && command[i+1] === '|') { segments.push(current); current = ''; i += 2; while (i < command.length && command[i] === ' ') i++; continue; }
      if (ch === '|' && command[i+1] !== '|') { segments.push(current); current = ''; i++; while (i < command.length && command[i] === ' ') i++; continue; }
      if (ch === ';') { segments.push(current); current = ''; i++; while (i < command.length && command[i] === ' ') i++; continue; }
    }
    current += ch; i++;
  }
  if (current.trim()) segments.push(current);
  return segments;
}

function checkSingleCommand(cmd) {
  const trimmed = cmd.trim();
  if (!trimmed) return true;
  if (hasUnsafeRedirect(trimmed)) return false;
  if (hasUnsafeNodeCall(trimmed)) return false;
  for (const pat of BASH_HARD_DENY) if (pat.test(trimmed)) return false;
  for (const pat of BASH_ALLOWLIST) if (pat.test(trimmed)) return true;
  return false;
}

function checkBashCommand(command) {
  const segments = splitCompoundCommand(command.trim());
  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;
    if (hasUnsafeRedirect(s)) return { ok: false, reason: `Bash: ${s.slice(0, 60)} (重定向请委派 agent)` };
    if (hasUnsafeNodeCall(s)) return { ok: false, reason: `Bash: ${s.slice(0, 60)} (node 执行请委派 agent)` };
    for (const pat of BASH_HARD_DENY) if (pat.test(s)) return { ok: false, reason: `Bash: ${s.slice(0, 60)} (构建/测试请委派 agent)` };
    if (!checkSingleCommand(s)) return { ok: false, reason: `Bash: ${s.slice(0, 60)} (不在 allowlist，请委派 agent)` };
  }
  return { ok: true };
}

// ---------- Main ----------

async function main() {
  try {
    const input = await readStdin();
    if (!input.trim()) { passThrough(); return; }

    let data = {};
    try { data = JSON.parse(input); }
    catch { deny('SP Guard 输入解析失败 (fail-closed)'); return; }

    // 1. Sub-agent bypass
    if (data.agent_id) { passThrough(); return; }

    // 2. Worktree bypass
    const rawCwd = data.cwd || process.cwd();
    if (rawCwd.includes('.claude/worktrees/')) { passThrough(); return; }

    // 3. Non-SP workspace bypass
    const cwd = findPortfolioRoot(rawCwd);
    if (!existsSync(join(cwd, 'portfolio.json')) || existsSync(join(cwd, '.sp-disabled'))) {
      passThrough(); return;
    }

    // 4. governance_mode bypass (readonly/off)
    const project = getProjectForCwd(rawCwd, cwd);
    if (isProjectGovernanceSkipped(project)) { passThrough(); return; }

    const role = project ? 'team-lead' : 'pm';
    const toolName = data.tool_name || '';
    const toolInput = data.tool_input || {};
    const sessionId = data.session_id || '';

    // 5. MCP tool prefix check (trust-derived, zero hardcoded names)
    if (toolName.startsWith('mcp__plugin_')) {
      const policy = readSPState(cwd).trust;
      const installed = readInstalledPlugins();
      const { allowed } = filterByTrust(installed, policy);
      const prefixes = getTrustedMCPPrefixes(allowed);
      if (prefixes.some(p => toolName.startsWith(p))) {
        passThrough(); return;
      }
      const reason = `[${role.toUpperCase()}] MCP 工具来自未信任插件: ${toolName} (请在 sp.json::trust 中授权)`;
      writeAuditLog(cwd, { role, tool: toolName, action: 'DENY', reason, session: sessionId });
      deny(reason); return;
    }

    // 6. Static allowlist (fail-closed for both roles)
    const inShared = SHARED_ALLOWLIST.has(toolName);
    const inExtra = role === 'team-lead' && TEAM_LEAD_EXTRA.has(toolName);
    if (!inShared && !inExtra) {
      const reason = `[${role.toUpperCase()}] 禁止使用工具: ${toolName} (请委派 agent)`;
      writeAuditLog(cwd, { role, tool: toolName, action: 'DENY', reason, session: sessionId });
      deny(reason); return;
    }

    // 7. Write/Edit path constraint
    if (PATH_CHECK_TOOLS.has(toolName)) {
      const result = checkWritePath(toolInput.file_path || toolInput.path || '', cwd);
      if (!result.ok) {
        const reason = `[${role.toUpperCase()}] ${result.reason}`;
        writeAuditLog(cwd, { role, tool: toolName, action: 'DENY', reason, session: sessionId });
        deny(reason); return;
      }
    }

    // 8. Bash/PowerShell command constraint
    if (CMD_CHECK_TOOLS.has(toolName)) {
      const result = checkBashCommand(toolInput.command || '');
      if (!result.ok) {
        const reason = `[${role.toUpperCase()}] ${result.reason}`;
        writeAuditLog(cwd, { role, tool: toolName, action: 'DENY', reason, session: sessionId });
        deny(reason); return;
      }
    }

    // 9. Allow, audit, inject context for noisy tools only
    const ctx = project
      ? `[Team-Lead: ${project.name}] (${project.tech_stack}, group: ${project.group})`
      : '[PM]';
    writeAuditLog(cwd, { role, tool: toolName, action: 'ALLOW', session: sessionId });
    if (['Agent', 'Write', 'Edit', 'Bash', 'PowerShell'].includes(toolName)) {
      allowWithContext(`${ctx} ${toolName} 已放行`);
    } else {
      passThrough();
    }
  } catch (e) {
    deny(`SP Guard 内部错误: ${e.message || 'unknown'}`);
  }
}

main();
