#!/usr/bin/env node

/**
 * SP PM Allowlist Guard — PreToolUse Hook (* matcher)
 *
 * Fail-closed allowlist model: only explicitly listed tools are permitted for PM.
 * Sub-agents and worktree sessions bypass this guard.
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
      additionalContext: `[SP PM Guard] ${message}`
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
      additionalContext: `[SP PM Guard] ${message}`
    }
  }));
}

// ---------------------------------------------------------------------------
// PM Tool Allowlist
// ---------------------------------------------------------------------------

const PM_TOOL_ALLOWLIST = {
  'Agent': { allowed: true },
  'TaskCreate': { allowed: true },
  'TaskList': { allowed: true },
  'TaskGet': { allowed: true },
  'TaskUpdate': { allowed: true },
  'TaskOutput': { allowed: true },
  'TaskStop': { allowed: true },
  'TeamCreate': { allowed: true },
  'TeamDelete': { allowed: true },
  'SendMessage': { allowed: true },
  'AskUserQuestion': { allowed: true },
  'Skill': { allowed: true },
  'EnterPlanMode': { allowed: true },
  'ExitPlanMode': { allowed: true },
  'EnterWorktree': { allowed: true },
  'ExitWorktree': { allowed: true },
  'CronCreate': { allowed: true },
  'CronDelete': { allowed: true },
  'CronList': { allowed: true },
  'Read': { allowed: true, pathCheck: 'READ_CONSTRAINT' },
  'Write': { allowed: true, pathCheck: 'WRITE_CONSTRAINT' },
  'Edit': { allowed: true, pathCheck: 'WRITE_CONSTRAINT' },
  'Bash': { allowed: true, commandCheck: 'BASH_ALLOWLIST' },
  // OMC state/notepad/memory MCP tools
  'mcp__plugin_oh-my-claudecode_t__state_read': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__state_write': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__state_clear': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__state_list_active': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__state_get_status': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__notepad_read': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__notepad_write_priority': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__notepad_write_working': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__notepad_write_manual': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__notepad_prune': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__notepad_stats': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__project_memory_read': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__project_memory_write': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__project_memory_add_note': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__project_memory_add_directive': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__session_search': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__trace_timeline': { allowed: true },
  'mcp__plugin_oh-my-claudecode_t__trace_summary': { allowed: true },
};

// ---------------------------------------------------------------------------
// Path constraints
// ---------------------------------------------------------------------------

const PM_WRITE_PATHS = [
  'portfolio.json', 'groups/', 'cross-groups/', '.omc/',
  'templates/', '.sp-disabled', 'bootstrap-state.json',
  'CLAUDE.md', 'AGENTS.md', 'sp-governance/',
];

const PM_WRITE_DENY = [
  '.omc/state/pm-override',
];

const SOURCE_CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyx', '.go', '.rs',
  '.java', '.kt', '.scala',
  '.c', '.cpp', '.cc', '.h', '.hpp', '.cs',
  '.vue', '.svelte', '.rb', '.php', '.swift', '.dart',
]);

const READ_EXCEPTION_PATHS = ['sp-governance/', 'governance/', '.omc/', 'templates/'];

const CONFIG_FILES = new Set([
  'package.json', 'pom.xml', 'build.gradle', 'Cargo.toml',
  'go.mod', 'pyproject.toml', 'requirements.txt', 'composer.json',
  'pubspec.yaml', 'tsconfig.json', 'nx.json', 'turbo.json',
  'lerna.json', 'pnpm-workspace.yaml', '.gitignore',
  'Makefile', 'CMakeLists.txt', 'Dockerfile', 'docker-compose.yml',
  'CLAUDE.md', 'AGENTS.md', 'portfolio.json',
]);

// ---------------------------------------------------------------------------
// Bash constraints
// ---------------------------------------------------------------------------

const BASH_HARD_DENY = [
  /[>|]\s*[^|&]/, /\btee\b/, /\bsed\s+-i/, /\bawk\b.*>/, /\bperl\s+-[ip]/,
  /\bpython[23]?\s/, /\bnode\s+(?!--version)/, /\bcurl\s.*-[oO]/, /\bwget\b/,
];

const BASH_ALLOWLIST = [
  /^git\s+(status|log|branch|remote|diff|show|tag|rev-parse|describe)\b/,
  /^ls(\s|$)/, /^pwd$/, /^wc\s/, /^file\s/, /^stat\s/, /^du\s/, /^df\s/,
  /^echo\s/, /^printf\s/, /^date/, /^whoami/, /^uname/,
  /^which\s/, /^type\s/, /^command\s/,
  /^node\s+--version/, /^npm\s+(ls|list|outdated|view)\b/,
  /^mkdir\s+-p\s/, /^touch\s/, /^cp\s/,
  /^zip\s/, /^unzip\s/,
];

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------

const MAX_AUDIT_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_AUDIT_HISTORY = 3;

function writeAuditLog(cwd, entry) {
  try {
    const logDir = join(cwd, '.omc', 'logs');
    mkdirSync(logDir, { recursive: true });
    const logPath = join(logDir, 'pm-audit.jsonl');

    // Rotate if needed
    if (existsSync(logPath)) {
      try {
        const st = statSync(logPath);
        if (st.size > MAX_AUDIT_SIZE) {
          // Shift old files
          for (let i = MAX_AUDIT_HISTORY; i >= 1; i--) {
            const older = `${logPath}.${i}`;
            const newer = i === 1 ? logPath : `${logPath}.${i - 1}`;
            if (existsSync(newer)) {
              try { renameSync(newer, older); } catch { /* ignore */ }
            }
          }
        }
      } catch { /* ignore stat errors */ }
    }

    appendFileSync(logPath, JSON.stringify(entry) + '\n');
  } catch { /* never fail on audit */ }
}

// ---------------------------------------------------------------------------
// Check helpers
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
  if (rel.startsWith('..')) return { ok: false, reason: `PM 禁止写入工作区外路径: ${rel}` };

  // Deny list takes priority
  for (const d of PM_WRITE_DENY) {
    if (rel.startsWith(d)) return { ok: false, reason: `PM 禁止写入 ${d}* (仅由 bootstrap-guard 管理)` };
  }

  // Allow list
  for (const p of PM_WRITE_PATHS) {
    if (rel === p || rel === p.replace(/\/$/, '') || rel.startsWith(p)) return { ok: true };
  }

  return { ok: false, reason: `PM 禁止写入非管理路径: ${rel}` };
}

function checkReadPath(filePath, cwd) {
  const rel = toRelPath(filePath, cwd);

  // Management paths always allowed
  for (const p of PM_WRITE_PATHS) {
    if (rel === p || rel === p.replace(/\/$/, '') || rel.startsWith(p)) return { ok: true };
  }

  // Exception paths allowed
  for (const p of READ_EXCEPTION_PATHS) {
    if (rel.startsWith(p)) return { ok: true };
  }

  // Config files allowed
  if (CONFIG_FILES.has(basename(rel))) return { ok: true };

  // Source code extensions denied
  const ext = extname(rel).toLowerCase();
  if (SOURCE_CODE_EXTENSIONS.has(ext)) {
    return { ok: false, reason: `PM 禁止读取源代码文件: ${rel} (请委派 agent)` };
  }

  // Everything else allowed
  return { ok: true };
}

function checkBashCommand(command) {
  const trimmed = command.trim();

  // Hard deny patterns
  for (const pat of BASH_HARD_DENY) {
    if (pat.test(trimmed)) {
      return { ok: false, reason: `PM Bash 命令被拦截 (硬拒绝模式): ${trimmed.slice(0, 60)}` };
    }
  }

  // Allowlist check
  for (const pat of BASH_ALLOWLIST) {
    if (pat.test(trimmed)) return { ok: true };
  }

  return { ok: false, reason: `PM Bash 命令不在 allowlist 中: ${trimmed.slice(0, 60)}` };
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
      deny('SP PM Guard 输入解析失败 (fail-closed)');
      return;
    }

    // 1. Sub-agent bypass (highest priority)
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

    // 4. PM override check
    const sessionId = data.session_id || '';
    if (sessionId) {
      const overridePath = join(cwd, '.omc', 'state', `pm-override-${sessionId}.json`);
      if (existsSync(overridePath)) {
        try {
          const override = JSON.parse(readFileSync(overridePath, 'utf-8'));
          if (override.active) {
            const age = (Date.now() - new Date(override.timestamp).getTime()) / 1000;
            const ttl = override.ttl_seconds || 120;
            if (age < ttl) {
              passThrough();
              return;
            }
          }
        } catch { /* expired or corrupt, continue normal flow */ }
      }
    }

    const toolName = data.tool_name || '';
    const toolInput = data.tool_input || {};

    // 5. Allowlist check (fail-closed)
    const entry = PM_TOOL_ALLOWLIST[toolName];
    if (!entry || !entry.allowed) {
      const reason = `PM 禁止使用工具: ${toolName} (未在 allowlist 中)`;
      writeAuditLog(cwd, { ts: new Date().toISOString(), tool: toolName, action: 'DENY', reason, session: sessionId });
      deny(reason);
      return;
    }

    // 6. Path constraint checks
    if (entry.pathCheck === 'WRITE_CONSTRAINT') {
      const filePath = toolInput.file_path || toolInput.path || '';
      const result = checkWritePath(filePath, cwd);
      if (!result.ok) {
        writeAuditLog(cwd, { ts: new Date().toISOString(), tool: toolName, action: 'DENY', reason: result.reason, session: sessionId });
        deny(result.reason);
        return;
      }
    }

    if (entry.pathCheck === 'READ_CONSTRAINT') {
      const filePath = toolInput.file_path || toolInput.path || '';
      const result = checkReadPath(filePath, cwd);
      if (!result.ok) {
        writeAuditLog(cwd, { ts: new Date().toISOString(), tool: toolName, action: 'DENY', reason: result.reason, session: sessionId });
        deny(result.reason);
        return;
      }
    }

    // 7. Bash command check
    if (entry.commandCheck === 'BASH_ALLOWLIST') {
      const command = toolInput.command || '';
      const result = checkBashCommand(command);
      if (!result.ok) {
        writeAuditLog(cwd, { ts: new Date().toISOString(), tool: toolName, action: 'DENY', reason: result.reason, session: sessionId });
        deny(result.reason);
        return;
      }
    }

    // 8. All checks passed
    writeAuditLog(cwd, { ts: new Date().toISOString(), tool: toolName, action: 'ALLOW', session: sessionId });
    passThrough();

  } catch (e) {
    // fail-closed
    deny(`SP PM Guard 内部错误: ${e.message || 'unknown'}`);
  }
}

main();
