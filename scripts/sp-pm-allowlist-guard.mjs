#!/usr/bin/env node

/**
 * SP PM Guard v3 — PreToolUse Hook (* matcher)
 *
 * Dual-role model based on CWD relative to portfolio.json location:
 *   - CWD == portfolio root → PM role (fail-closed allowlist)
 *   - CWD inside registered project → Team-Lead role (fail-closed, +WebFetch/WebSearch)
 *
 * Both roles share the same core restrictions:
 *   - Write/Edit: only .md files + management paths (CLAUDE.md, .omc/, portfolio.json etc.)
 *   - Bash: read-only allowlist only
 *   - Business code / config files: must delegate to agent
 *   - governance/ and agents/ modifications: require user approval
 *
 * Team-Lead additionally gets: WebFetch, WebSearch (external research)
 *
 * Output format: Claude Code PreToolUse hookSpecificOutput
 */

import { existsSync, readFileSync, appendFileSync, mkdirSync, renameSync, statSync } from 'fs';
import { join, resolve, relative, isAbsolute, extname, basename } from 'path';
import { readStdin } from './lib/stdin.mjs';
import { findPortfolioRoot } from './lib/portfolio.mjs';

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function deny(message) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: message,
      additionalContext: `[SP Guard] ${message}`
    }
  }));
}

function passThrough() {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

function allowWithContext(message) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: `[SP Guard] ${message}`
    }
  }));
}

// ---------------------------------------------------------------------------
// Shared allowlist (both PM and Team-Lead)
// ---------------------------------------------------------------------------

const SHARED_ALLOWLIST = new Set([
  // Core dispatch
  'Agent', 'TaskCreate', 'TaskList', 'TaskGet', 'TaskUpdate', 'TaskOutput', 'TaskStop',
  'TeamCreate', 'TeamDelete', 'SendMessage',
  'AskUserQuestion', 'Skill', 'ToolSearch',
  'EnterPlanMode', 'ExitPlanMode', 'EnterWorktree', 'ExitWorktree',
  'CronCreate', 'CronDelete', 'CronList',
  'ScheduleWakeup',
  // Navigation (both roles need these)
  'Glob', 'Grep', 'Read',
  // Notebook
  'NotebookEdit',
  // Write with path constraints (checked separately)
  'Write', 'Edit',
  // Bash/PowerShell with command constraints (checked separately)
  'Bash', 'PowerShell',
  // OMC MCP tools
  'mcp__plugin_oh-my-claudecode_t__state_read',
  'mcp__plugin_oh-my-claudecode_t__state_write',
  'mcp__plugin_oh-my-claudecode_t__state_clear',
  'mcp__plugin_oh-my-claudecode_t__state_list_active',
  'mcp__plugin_oh-my-claudecode_t__state_get_status',
  'mcp__plugin_oh-my-claudecode_t__notepad_read',
  'mcp__plugin_oh-my-claudecode_t__notepad_write_priority',
  'mcp__plugin_oh-my-claudecode_t__notepad_write_working',
  'mcp__plugin_oh-my-claudecode_t__notepad_write_manual',
  'mcp__plugin_oh-my-claudecode_t__notepad_prune',
  'mcp__plugin_oh-my-claudecode_t__notepad_stats',
  'mcp__plugin_oh-my-claudecode_t__project_memory_read',
  'mcp__plugin_oh-my-claudecode_t__project_memory_write',
  'mcp__plugin_oh-my-claudecode_t__project_memory_add_note',
  'mcp__plugin_oh-my-claudecode_t__project_memory_add_directive',
  'mcp__plugin_oh-my-claudecode_t__session_search',
  'mcp__plugin_oh-my-claudecode_t__trace_timeline',
  'mcp__plugin_oh-my-claudecode_t__trace_summary',
]);

// Team-Lead exclusive: external research tools
const TEAM_LEAD_EXTRA = new Set([
  'WebFetch', 'WebSearch',
]);

// Tools that need path checking
const PATH_CHECK_TOOLS = new Set(['Write', 'Edit']);

// Tools that need command checking
const CMD_CHECK_TOOLS = new Set(['Bash', 'PowerShell']);

// ---------------------------------------------------------------------------
// Write path constraints (shared by both roles)
// ---------------------------------------------------------------------------

// Management paths both roles can write
const WRITE_ALLOWED_PATHS = [
  'portfolio.json', 'groups/', 'cross-groups/', '.omc/',
  'templates/', '.sp-disabled', 'bootstrap-state.json',
  'CLAUDE.md', 'AGENTS.md', 'sp-governance/',
];

// Governance paths that need user approval (both roles)
const WRITE_DENY_PATHS = [
  'sp-governance/governance/',
  'sp-governance/agents/',
];

// ---------------------------------------------------------------------------
// Bash constraints (shared by both roles)
// ---------------------------------------------------------------------------

const BASH_HARD_DENY = [
  /(?:^|[^2])>\s*[^|&>]/, /\btee\b/, /\bsed\s+-i/, /\bawk\b.*>/, /\bperl\s+-[ip]/,
  /\bpython[23]?\s/, /\bnode\s+(?!--version)/, /\bcurl\s.*-[oO]/, /\bwget\b/,
  /\bnpm\s+(run|start|exec|test|install|ci|build)\b/,
  /\bpnpm\s+(run|start|exec|test|install|build)\b/,
  /\byarn\s+(run|start|test|install|build)\b/,
];

const BASH_ALLOWLIST = [
  /^git\s+(status|log|branch|remote|diff|show|tag|rev-parse|describe|fetch)\b/,
  /^ls(\s|$)/, /^dir(\s|$)/, /^pwd$/, /^wc\s/, /^file\s/, /^stat\s/, /^du\s/, /^df\s/,
  /^echo\s/, /^printf\s/, /^date/, /^whoami/, /^uname/,
  /^which\s/, /^type\s/, /^command\s/,
  /^head(\s|$)/, /^tail(\s|$)/, /^cat(\s|$)/, /^less(\s|$)/, /^more(\s|$)/,
  /^find\s/, /^tree(\s|$)/, /^sort(\s|$)/, /^uniq(\s|$)/, /^cut(\s|$)/,
  /^grep\s/, /^rg\s/, /^ag\s/,
  /^node\s+--version/, /^npm\s+(ls|list|outdated|view|--version)\b/,
  /^pnpm\s+(ls|list|outdated|--version)\b/,
  /^mkdir\s+-p\s/, /^touch\s/, /^cp\s/,
  /^zip\s/, /^unzip\s/,
  /^gh\s/, /^docker\s+(ps|images|inspect|logs|stats)\b/,
];

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------

const MAX_AUDIT_SIZE = 5 * 1024 * 1024;
const MAX_AUDIT_HISTORY = 3;

function writeAuditLog(cwd, entry) {
  try {
    const logDir = join(cwd, '.omc', 'logs');
    mkdirSync(logDir, { recursive: true });
    const logPath = join(logDir, 'pm-audit.jsonl');
    if (existsSync(logPath)) {
      try {
        const st = statSync(logPath);
        if (st.size > MAX_AUDIT_SIZE) {
          for (let i = MAX_AUDIT_HISTORY; i >= 1; i--) {
            const older = `${logPath}.${i}`;
            const newer = i === 1 ? logPath : `${logPath}.${i - 1}`;
            if (existsSync(newer)) {
              try { renameSync(newer, older); } catch { /* ignore */ }
            }
          }
        }
      } catch { /* ignore */ }
    }
    appendFileSync(logPath, JSON.stringify(entry) + '\n');
  } catch { /* never fail on audit */ }
}

// ---------------------------------------------------------------------------
// Sub-project detection
// ---------------------------------------------------------------------------

function getProjectForCwd(rawCwd, portfolioRoot) {
  try {
    const portfolioPath = join(portfolioRoot, 'portfolio.json');
    if (!existsSync(portfolioPath)) return null;
    const portfolio = JSON.parse(readFileSync(portfolioPath, 'utf-8'));
    const projects = portfolio.projects || [];
    const normRaw = resolve(rawCwd).replace(/\\/g, '/').toLowerCase();
    const normRoot = resolve(portfolioRoot).replace(/\\/g, '/').toLowerCase();
    if (normRaw === normRoot) return null;
    for (const proj of projects) {
      const projPath = resolve(portfolioRoot, proj.path).replace(/\\/g, '/').toLowerCase();
      if (normRaw === projPath || normRaw.startsWith(projPath + '/')) return proj;
    }
  } catch { /* */ }
  return null;
}

// ---------------------------------------------------------------------------
// Path & command helpers
// ---------------------------------------------------------------------------

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
  if (rel.startsWith('..')) return { ok: false, reason: `禁止写入工作区外路径: ${rel}` };

  // Governance deny (needs user approval)
  for (const d of WRITE_DENY_PATHS) {
    if (rel.startsWith(d)) return { ok: false, reason: `治理文件受保护: ${rel} (需用户明确审批)` };
  }

  // Management paths always allowed
  for (const p of WRITE_ALLOWED_PATHS) {
    if (rel === p || rel === p.replace(/\/$/, '') || rel.startsWith(p)) return { ok: true };
  }

  // .md files allowed anywhere (plan/doc generation)
  if (extname(rel).toLowerCase() === '.md') return { ok: true };

  return { ok: false, reason: `禁止写入: ${rel} (业务代码/配置文件请委派 agent)` };
}

function checkSingleCommand(cmd) {
  const trimmed = cmd.trim();
  if (!trimmed) return true;
  for (const pat of BASH_HARD_DENY) {
    if (pat.test(trimmed)) return false;
  }
  for (const pat of BASH_ALLOWLIST) {
    if (pat.test(trimmed)) return true;
  }
  return false;
}

function splitCompoundCommand(command) {
  const segments = [];
  let current = '';
  let i = 0;
  let depth = 0;
  while (i < command.length) {
    const ch = command[i];
    if (ch === "'") {
      current += ch; i++;
      while (i < command.length && command[i] !== "'") current += command[i++];
      if (i < command.length) current += command[i++];
      continue;
    }
    if (ch === '"') {
      current += ch; i++;
      while (i < command.length && command[i] !== '"') {
        if (command[i] === '\\') { current += command[i++]; }
        if (i < command.length) current += command[i++];
      }
      if (i < command.length) current += command[i++];
      continue;
    }
    if (ch === '$' && command[i+1] === '(') { depth++; current += ch + command[i+1]; i += 2; continue; }
    if (ch === '(') { depth++; current += ch; i++; continue; }
    if (ch === ')') { if (depth > 0) depth--; current += ch; i++; continue; }
    if (depth === 0) {
      if (ch === '&' && command[i+1] === '&') {
        segments.push(current); current = ''; i += 2;
        while (i < command.length && command[i] === ' ') i++;
        continue;
      }
      if (ch === '|' && command[i+1] === '|') {
        segments.push(current); current = ''; i += 2;
        while (i < command.length && command[i] === ' ') i++;
        continue;
      }
      if (ch === '|' && command[i+1] !== '|') {
        segments.push(current); current = ''; i++;
        while (i < command.length && command[i] === ' ') i++;
        continue;
      }
      if (ch === ';') {
        segments.push(current); current = ''; i++;
        while (i < command.length && command[i] === ' ') i++;
        continue;
      }
    }
    current += ch; i++;
  }
  if (current.trim()) segments.push(current);
  return segments;
}

function checkBashCommand(command) {
  const trimmed = command.trim();
  const segments = splitCompoundCommand(trimmed);
  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;
    for (const pat of BASH_HARD_DENY) {
      if (pat.test(s)) {
        return { ok: false, reason: `Bash 命令被拦截: ${s.slice(0, 60)} (构建/测试/执行请委派 agent)` };
      }
    }
    if (!checkSingleCommand(s)) {
      return { ok: false, reason: `Bash 命令不在 allowlist: ${s.slice(0, 60)} (请委派 agent)` };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  try {
    const input = await readStdin();
    if (!input.trim()) { passThrough(); return; }

    let data = {};
    try { data = JSON.parse(input); } catch {
      deny('SP Guard 输入解析失败 (fail-closed)');
      return;
    }

    // 1. Sub-agent bypass (highest priority — framework controls their tools)
    if (data.agent_id) { passThrough(); return; }

    // 2. Worktree bypass
    const rawCwd = data.cwd || process.cwd();
    if (rawCwd.includes('.claude/worktrees/')) { passThrough(); return; }

    // 3. Non-SP workspace bypass
    const cwd = findPortfolioRoot(rawCwd);
    if (!existsSync(join(cwd, 'portfolio.json')) || existsSync(join(cwd, '.sp-disabled'))) {
      passThrough();
      return;
    }

    // 4. Determine role: PM (at root) or Team-Lead (in sub-project)
    const project = getProjectForCwd(rawCwd, cwd);
    const role = project ? 'team-lead' : 'pm';

    // 5. PM override check (PM temporarily gets full access)
    const sessionId = data.session_id || '';
    if (sessionId) {
      const overridePath = join(cwd, '.omc', 'state', `pm-override-${sessionId}.json`);
      if (existsSync(overridePath)) {
        try {
          const override = JSON.parse(readFileSync(overridePath, 'utf-8'));
          if (override.active) {
            const age = (Date.now() - new Date(override.timestamp).getTime()) / 1000;
            if (age < (override.ttl_seconds || 120)) { passThrough(); return; }
          }
        } catch { /* expired or corrupt */ }
      }
    }

    const toolName = data.tool_name || '';
    const toolInput = data.tool_input || {};

    // 6. Allowlist check (fail-closed for both roles)
    // Allow all OMC MCP tools by prefix (covers lsp_*, ast_grep_*, python_repl, etc.)
    if (toolName && toolName.startsWith('mcp__plugin_oh-my-claudecode_t__')) {
      passThrough();
      return;
    }

    const inShared = SHARED_ALLOWLIST.has(toolName);
    const inTeamLeadExtra = role === 'team-lead' && TEAM_LEAD_EXTRA.has(toolName);

    if (!inShared && !inTeamLeadExtra) {
      const reason = `[${role.toUpperCase()}] 禁止使用工具: ${toolName} (请委派 agent)`;
      writeAuditLog(cwd, { ts: new Date().toISOString(), role, tool: toolName, action: 'DENY', reason, session: sessionId });
      deny(reason);
      return;
    }

    // 7. Write/Edit path constraint
    if (PATH_CHECK_TOOLS.has(toolName)) {
      const filePath = toolInput.file_path || toolInput.path || '';
      const result = checkWritePath(filePath, cwd);
      if (!result.ok) {
        const reason = `[${role.toUpperCase()}] ${result.reason}`;
        writeAuditLog(cwd, { ts: new Date().toISOString(), role, tool: toolName, action: 'DENY', reason, session: sessionId });
        deny(reason);
        return;
      }
    }

    // 8. Bash command constraint
    if (CMD_CHECK_TOOLS.has(toolName)) {
      const command = toolInput.command || '';
      const result = checkBashCommand(command);
      if (!result.ok) {
        const reason = `[${role.toUpperCase()}] ${result.reason}`;
        writeAuditLog(cwd, { ts: new Date().toISOString(), role, tool: toolName, action: 'DENY', reason, session: sessionId });
        deny(reason);
        return;
      }
    }

    // 9. Passed — inject role context
    const ctx = project
      ? `[Team-Lead: ${project.name}] (${project.tech_stack}, group: ${project.group})`
      : '[PM]';
    writeAuditLog(cwd, { ts: new Date().toISOString(), role, tool: toolName, action: 'ALLOW', session: sessionId });

    // Only inject context on first tool call per message to reduce noise
    // For high-frequency tools (Glob/Grep/Read), stay silent
    if (['Agent', 'Write', 'Edit', 'Bash'].includes(toolName)) {
      allowWithContext(`${ctx} ${toolName} 已放行`);
    } else {
      passThrough();
    }

  } catch (e) {
    // fail-closed
    deny(`SP Guard 内部错误: ${e.message || 'unknown'}`);
  }
}

main();
