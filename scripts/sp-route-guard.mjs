#!/usr/bin/env node

/**
 * SP Route Guard — PreToolUse Hook (Plugin version)
 *
 * Validates Agent calls involving registered projects carry proper SP-ROLE tags
 * or use sp-governance:sp-* plugin agents.
 *
 * Flow:
 *   1. No portfolio.json in cwd → skip (not SP workspace)
 *   2. Agent uses sp-governance:sp-* subagent_type → allow (framework enforces disallowedTools)
 *      - For executable roles (coder/tester/team-lead/group-lead), writes role-context.json
 *   3. Prompt doesn't mention registered projects → allow (general operation)
 *   4. No [SP-ROLE:xxx] tag → block
 *   5. Has SP-ROLE + non-OMC agent → allow with warning (fallback mode)
 *   6. Has SP-ROLE + OMC agent → validate role-agent match → allow/block
 *
 * Output format: Claude Code PreToolUse decision:"block" or hookSpecificOutput.additionalContext
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { readStdin } from './lib/stdin.mjs';
import { findPortfolioRoot } from './lib/portfolio.mjs';

const VALID_ROLES = new Set([
  'pm', 'architect', 'team-lead', 'group-lead', 'coder',
  'reviewer', 'tester', 'doc-engineer', 'cross-architect', 'cross-reviewer',
]);

// Roles that get a role-context.json written on allow
// (architect/reviewer/cross-*/doc-engineer are read-only — no Bash, no context needed)
const CONTEXT_ROLES = new Set(['coder', 'tester', 'team-lead', 'group-lead']);

// SP-ROLE → allowed OMC agent types (without oh-my-claudecode: prefix)
const ROLE_AGENT_MAP = {
  'architect':       ['architect', 'explore', 'planner'],
  'coder':           ['executor'],
  'reviewer':        ['code-reviewer', 'security-reviewer'],
  'tester':          ['test-engineer'],
  'doc-engineer':    ['writer'],
  'cross-architect': ['architect'],
  'cross-reviewer':  ['code-reviewer', 'security-reviewer'],
  'team-lead':       null, // any
  'group-lead':      null, // any
  'pm':              null, // any
};

function allow() {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

function allowWithContext(message) {
  console.log(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: message
    }
  }));
}

function block(reason) {
  console.log(JSON.stringify({
    decision: 'block',
    reason: `[SP Route Guard] 违反宪法 MUST #12 / MUST NOT #12:\n${reason}`
  }));
}

/**
 * Write role-context.json for executable SP plugin agents.
 * Failures are silently swallowed — must never block the allow path.
 */
function writeRoleContext(cwd, role, portfolio, promptText, agentName) {
  try {
    // Build project registry from portfolio (same logic as main flow)
    const projectMap = new Map(); // lowercase name/path → { name, path, group }
    const unmanaged = new Set((portfolio.unmanaged || []).map(s => s.toLowerCase()));

    for (const [groupName, group] of Object.entries(portfolio.groups || {})) {
      for (const [name, info] of Object.entries(group.members || {})) {
        if (!unmanaged.has(name.toLowerCase())) {
          projectMap.set(name.toLowerCase(), { name, path: info.path || name, group: groupName });
          if (info.path) projectMap.set(info.path.toLowerCase(), { name, path: info.path, group: groupName });
        }
      }
    }
    for (const [name, info] of Object.entries(portfolio.standalone || {})) {
      if (!unmanaged.has(name.toLowerCase())) {
        projectMap.set(name.toLowerCase(), { name, path: info.path || name, group: null });
        if (info.path) projectMap.set(info.path.toLowerCase(), { name, path: info.path, group: null });
      }
    }
    for (const [name, info] of Object.entries(portfolio.monorepos || {})) {
      if (!unmanaged.has(name.toLowerCase())) {
        projectMap.set(name.toLowerCase(), { name, path: info.path || name, group: null });
        if (info.path) projectMap.set(info.path.toLowerCase(), { name, path: info.path, group: null });
        for (const [p, pi] of Object.entries(info.packages || {})) {
          if (!unmanaged.has(p.toLowerCase())) {
            projectMap.set(p.toLowerCase(), { name: p, path: pi.path || p, group: null });
            if (pi.path) projectMap.set(pi.path.toLowerCase(), { name: p, path: pi.path, group: null });
          }
        }
      }
    }

    // Match project names in prompt (same regex logic as main flow)
    const text = promptText.toLowerCase();
    const matched = [...projectMap.entries()].filter(([key]) => {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|[^a-z0-9-])${escaped}(?:$|[^a-z0-9-])`).test(text);
    });

    if (matched.length === 0) return;

    // Deduplicate by project name (a project may match on both name and path)
    const seen = new Set();
    const uniqueMatches = [];
    for (const [, info] of matched) {
      if (!seen.has(info.name)) {
        seen.add(info.name);
        uniqueMatches.push(info);
      }
    }

    const firstMatch = uniqueMatches[0];

    // Build scope based on role
    let scope;
    if (role === 'group-lead') {
      const groupName = firstMatch.group;
      scope = groupName ? [`groups/${groupName}/`] : [firstMatch.path + '/'];
    } else {
      // coder/tester/team-lead: scope = matched project paths
      scope = uniqueMatches.map(m => m.path + '/');
    }

    const context = {
      role,
      project: firstMatch.name,
      group: firstMatch.group || null,
      scope,
      timestamp: new Date().toISOString(),
    };

    const stateDir = join(cwd, '.omc', 'state', 'role-context');
    mkdirSync(stateDir, { recursive: true });
    const filename = (agentName || role + '-' + Date.now()) + '.json';
    writeFileSync(join(stateDir, filename), JSON.stringify(context, null, 2));
  } catch {
    // Never block the allow path
  }
}

async function main() {
  try {
    const input = await readStdin();
    if (!input.trim()) { allow(); return; }

    let data = {};
    try { data = JSON.parse(input); } catch { allow(); return; }

    const toolInput = data.tool_input || data.toolInput || {};
    const rawCwd = data.cwd || data.directory || process.cwd();
    const cwd = findPortfolioRoot(rawCwd);
    const portfolioPath = join(cwd, 'portfolio.json');

    // 1. No portfolio.json → skip
    if (!existsSync(portfolioPath)) { allow(); return; }

    let portfolio;
    try {
      portfolio = JSON.parse(readFileSync(portfolioPath, 'utf-8'));
    } catch { allow(); return; }

    // 2. Plugin agent → auto-allow (framework enforces disallowedTools)
    const subagentType = toolInput.subagent_type || '';
    if (subagentType.startsWith('sp-governance:')) {
      // Extract role from subagent_type (e.g. "sp-governance:sp-coder" → "coder")
      const role = subagentType.replace('sp-governance:sp-', '');

      // Write role-context for executable roles only
      if (CONTEXT_ROLES.has(role)) {
        const agentName = toolInput.name || '';
        const promptText = (toolInput.prompt || '') + ' ' + (toolInput.description || '');
        writeRoleContext(cwd, role, portfolio, promptText, agentName);
      }

      allowWithContext(`SP Plugin agent [${subagentType}] — 框架物理约束生效`);
      return;
    }

    // Collect registered projects (exclude unmanaged)
    const registered = new Set();
    const unmanaged = new Set((portfolio.unmanaged || []).map(s => s.toLowerCase()));

    for (const group of Object.values(portfolio.groups || {}))
      for (const [name, info] of Object.entries(group.members || {})) {
        registered.add(name.toLowerCase());
        if (info.path) registered.add(info.path.toLowerCase());
      }
    for (const [name, info] of Object.entries(portfolio.standalone || {})) {
      registered.add(name.toLowerCase());
      if (info.path) registered.add(info.path.toLowerCase());
    }
    for (const [name, info] of Object.entries(portfolio.monorepos || {})) {
      registered.add(name.toLowerCase());
      if (info.path) registered.add(info.path.toLowerCase());
      for (const [p, pi] of Object.entries(info.packages || {})) {
        registered.add(p.toLowerCase());
        if (pi.path) registered.add(pi.path.toLowerCase());
      }
    }
    for (const u of unmanaged) registered.delete(u);
    if (registered.size === 0) { allow(); return; }

    // 3. Prompt doesn't mention registered projects → allow
    const text = ((toolInput.prompt || '') + ' ' + (toolInput.description || '')).toLowerCase();
    const matched = [...registered].filter(n => {
      const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|[^a-z0-9-])${escaped}(?:$|[^a-z0-9-])`).test(text);
    });
    if (matched.length === 0) { allow(); return; }

    // 4. Check SP-ROLE tag
    const roleMatch = (toolInput.prompt || '').match(/\[SP-ROLE:([a-z-]+)\]/i);
    if (!roleMatch || !VALID_ROLES.has(roleMatch[1].toLowerCase())) {
      block(
        `涉及已注册项目 [${matched.join(', ')}] 的 Agent 调用缺少合法 SP-ROLE 标记。\n`
        + `请在 prompt 开头添加角色声明，如: [SP-ROLE:architect]\n`
        + `或使用 Plugin agent: Agent(subagent_type="sp-governance:sp-architect", ...)\n`
        + `合法角色: ${[...VALID_ROLES].join(', ')}`
      );
      return;
    }

    const role = roleMatch[1].toLowerCase();

    // 5. Non-OMC agent (fallback mode) → allow with warning
    if (!subagentType.startsWith('oh-my-claudecode:')) {
      allowWithContext(
        `[SP Route Guard] 非标准路由: Agent [${subagentType}] 携带 SP-ROLE，`
        + `但非 OMC/Plugin agent，disallowedTools 约束不生效。`
        + `建议使用 sp-governance:sp-* 代替。`
      );
      return;
    }

    // 6. OMC agent → validate role-agent match
    const allowed = ROLE_AGENT_MAP[role];
    if (allowed === null) { allow(); return; } // team-lead/group-lead/pm unrestricted

    const agentShort = subagentType.replace('oh-my-claudecode:', '');
    if (allowed.includes(agentShort)) { allow(); return; }

    block(
      `SP-ROLE [${role}] 与 OMC Agent [${subagentType}] 不匹配。\n`
      + `[SP-ROLE:${role}] 允许的 Agent 类型: ${allowed.map(a => 'oh-my-claudecode:' + a).join(', ')}\n`
      + `或使用 Plugin agent: Agent(subagent_type="sp-governance:sp-${role}", ...)`
    );
  } catch {
    // On any error, allow continuation — never block
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

main();
