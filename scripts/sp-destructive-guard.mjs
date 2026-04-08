#!/usr/bin/env node

/**
 * SP Destructive Guard — PreToolUse Hook (Bash matcher)
 *
 * Intercepts destructive Bash commands and enforces role-based path validation.
 *
 * Flow:
 *   1. Parse command from tool_input.command
 *   2. Check against destructive patterns (rm -rf, git push --force, DROP TABLE, etc.)
 *   3. Non-destructive → silent pass-through
 *   4. Destructive → read role-context → validate target paths against allowed scope
 *   5. All targets within scope → allow with notice
 *   6. Any target out of scope → block
 *
 * On any error, falls back to pass-through (never blocks the user).
 *
 * Output format: Claude Code PreToolUse hookSpecificOutput.additionalContext
 */

import { existsSync } from 'fs';
import { join, resolve, relative, isAbsolute } from 'path';
import { readStdin } from './lib/stdin.mjs';
import { findPortfolioRoot } from './lib/portfolio.mjs';

/**
 * Silent pass-through for non-destructive commands.
 */
function passThrough() {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

/**
 * Emit a structured hook response with context message.
 * @param {boolean} allow - Whether to allow the command
 * @param {string} message - Human-readable context message
 */
function emit(allow, message) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: `[SP Destructive Guard] ${message}`
    }
  };
  if (!allow) {
    output.hookSpecificOutput.permissionDecision = 'deny';
    output.hookSpecificOutput.permissionDecisionReason = message;
  }
  console.log(JSON.stringify(output));
}

// ---------------------------------------------------------------------------
// Destructive command patterns
// ---------------------------------------------------------------------------

/** @type {Array<{ regex: RegExp, label: string }>} */
const DESTRUCTIVE_PATTERNS = [
  // Unix file deletion
  { regex: /rm\s+(-[a-z]*r[a-z]*\s+|.*-rf\s+|-r\s+--force)/,       label: 'rm recursive' },
  { regex: /rmdir\s+-p/,                                              label: 'rmdir -p' },
  { regex: /find\s+.*-delete/,                                        label: 'find -delete' },

  // PowerShell / Windows file deletion (case-insensitive)
  { regex: /Remove-Item.*(-Recurse|-Force)/i,                         label: 'Remove-Item' },
  { regex: /rd\s+\/s/i,                                               label: 'rd /s' },

  // Git destructive (allow global flags like -C between git and subcommand)
  { regex: /git\s+.*push\s+.*(-f|--force)/,                             label: 'git push --force' },
  { regex: /git\s+.*reset\s+--hard/,                                    label: 'git reset --hard' },
  { regex: /git\s+.*clean\s+.*-f/,                                      label: 'git clean -f' },
  { regex: /git\s+.*branch\s+.*-D/,                                     label: 'git branch -D' },
  { regex: /git\s+.*checkout\s+--\s+\./,                                label: 'git checkout -- .' },
  { regex: /git\s+.*restore\s+--source.*--worktree/,                    label: 'git restore --source --worktree' },

  // Database destructive (case-insensitive)
  { regex: /DROP\s+(TABLE|DATABASE)/i,                                 label: 'DROP TABLE/DATABASE' },
  { regex: /TRUNCATE\s+TABLE/i,                                       label: 'TRUNCATE TABLE' },
];

/**
 * Check whether a command matches any destructive pattern.
 * @param {string} command
 * @returns {{ destructive: boolean, label: string }}
 */
function detectDestructive(command) {
  for (const { regex, label } of DESTRUCTIVE_PATTERNS) {
    if (regex.test(command)) {
      return { destructive: true, label };
    }
  }
  return { destructive: false, label: '' };
}

// ---------------------------------------------------------------------------
// Target path extraction
// ---------------------------------------------------------------------------

/**
 * Extract target paths from a destructive command.
 *
 * - rm / rmdir: non-flag arguments (not starting with -)
 * - Remove-Item: -Path value or first non-flag argument
 * - git commands: treated as operating on cwd (returns ['.'])
 * - DROP/TRUNCATE: treated as operating on cwd (returns ['.'])
 * - find ... -delete: the search root (first non-flag arg after 'find')
 *
 * @param {string} command
 * @param {string} label - The matched destructive label
 * @returns {string[]} List of target path strings (may be relative or absolute)
 */
function extractTargetPaths(command, label) {
  // Git / DB commands operate on cwd
  if (label.startsWith('git ') || label === 'DROP TABLE/DATABASE' || label === 'TRUNCATE TABLE') {
    return ['.'];
  }

  // PowerShell Remove-Item
  if (label === 'Remove-Item') {
    const pathMatch = command.match(/-Path\s+["']?([^\s"']+)["']?/i);
    if (pathMatch) return [pathMatch[1]];
    // Fallback: tokens after Remove-Item that aren't flags
    const parts = command.split(/\s+/);
    const idx = parts.findIndex(p => /^Remove-Item$/i.test(p));
    if (idx >= 0) {
      return parts.slice(idx + 1).filter(p => !p.startsWith('-'));
    }
    return ['.'];
  }

  // find ... -delete: extract the search root
  if (label === 'find -delete') {
    const parts = command.split(/\s+/);
    const idx = parts.indexOf('find');
    if (idx >= 0 && idx + 1 < parts.length) {
      const next = parts[idx + 1];
      if (!next.startsWith('-')) return [next];
    }
    return ['.'];
  }

  // rm / rmdir / rd: extract non-flag arguments after the command token
  const parts = command.split(/\s+/);
  const cmdIdx = parts.findIndex(p => /^(rm|rmdir|rd)$/i.test(p));
  if (cmdIdx >= 0) {
    const isWindows = /^rd$/i.test(parts[cmdIdx]);
    const targets = parts.slice(cmdIdx + 1).filter(p => {
      if (p.startsWith('-')) return false;
      // Only filter /flag for Windows rd command, not Unix absolute paths
      if (isWindows && /^\/[a-zA-Z]$/i.test(p)) return false;
      return true;
    });
    return targets.length > 0 ? targets : ['.'];
  }

  return ['.'];
}

// ---------------------------------------------------------------------------
// Role & scope resolution
// ---------------------------------------------------------------------------

/** PM allowed path prefixes (relative to workspace root) */
const PM_ALLOWED = [
  '.omc/',
  'groups/',
  'cross-groups/',
  'portfolio.json',
  'sp-governance/',
  'templates/',
  'bootstrap-state.json',
];

/**
 * Normalize a target path to a workspace-relative string.
 *
 * @param {string} target - Path token from command (may be relative or absolute)
 * @param {string} cwd - Workspace root (absolute)
 * @returns {string} Normalized relative path with forward slashes
 */
function normalizePath(target, cwd) {
  const abs = isAbsolute(target) ? resolve(target) : resolve(cwd, target);
  let rel = relative(cwd, abs);
  // Normalize to forward slashes
  rel = rel.replace(/\\/g, '/');
  // Ensure no leading ./
  if (rel.startsWith('./')) rel = rel.slice(2);
  // relative(x, x) returns '' — normalize to '.'
  if (rel === '') rel = '.';
  return rel;
}

/**
 * Check whether a relative path falls within any of the allowed prefixes.
 *
 * @param {string} relPath - Workspace-relative path (forward slashes)
 * @param {string[]} allowed - Allowed path prefixes
 * @returns {boolean}
 */
function isWithinScope(relPath, allowed) {
  // '.' means cwd itself — only allowed if scope explicitly includes it or a very broad prefix
  if (relPath === '.' || relPath === '') {
    // Operating on workspace root is only safe if allowed includes a root-level catch-all
    return allowed.some(a => a === '.' || a === './');
  }

  // Paths that escape workspace (../) are never allowed
  if (relPath.startsWith('..')) return false;

  // Exact file match or prefix match
  return allowed.some(prefix => {
    const p = prefix.replace(/\\/g, '/');
    return relPath === p || relPath === p.replace(/\/$/, '') || relPath.startsWith(p);
  });
}

/**
 * Shorten a command string for display (max 60 chars).
 * @param {string} cmd
 * @returns {string}
 */
function briefCommand(cmd) {
  const trimmed = cmd.trim().replace(/\s+/g, ' ');
  return trimmed.length > 60 ? trimmed.slice(0, 57) + '...' : trimmed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  try {
    const input = await readStdin();
    if (!input.trim()) { passThrough(); return; }

    let data = {};
    try { data = JSON.parse(input); } catch { passThrough(); return; }

    // Sub-agent bypass
    if (data.agent_id) { passThrough(); return; }

    // Only process Bash tool calls
    if (data.tool_name !== 'Bash') { passThrough(); return; }

    const command = data.tool_input?.command;
    if (!command || typeof command !== 'string') { passThrough(); return; }

    const rawCwd = data.cwd || process.cwd();
    const cwd = findPortfolioRoot(rawCwd);

    // Skip if no portfolio.json (not an SP workspace) or SP disabled
    if (!existsSync(join(cwd, 'portfolio.json')) || existsSync(join(cwd, '.sp-disabled'))) {
      passThrough(); return;
    }

    // 1. Detect destructive command
    const { destructive, label } = detectDestructive(command);
    if (!destructive) { passThrough(); return; }

    // 2. Use fixed PM allowed scope
    const role = 'PM';
    const allowed = PM_ALLOWED;

    // 3. Extract and validate target paths
    const targets = extractTargetPaths(command, label);
    const violations = [];

    for (const target of targets) {
      const rel = normalizePath(target, cwd);
      if (!isWithinScope(rel, allowed)) {
        violations.push(rel);
      }
    }

    // 4. Emit result
    if (violations.length === 0) {
      emit(true, `已放行: ${role} 在权限范围内执行 ${briefCommand(command)}`);
    } else {
      const paths = violations.join(', ');
      emit(false, `已拦截: ${role} 无权对 ${paths} 执行破坏性操作。请派发给有权限的 agent。`);
    }
  } catch (e) {
    // fail-closed: 解析错误时拦截
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `SP Destructive Guard 内部错误: ${e.message || 'unknown'}`
      }
    }));
  }
}

main();
