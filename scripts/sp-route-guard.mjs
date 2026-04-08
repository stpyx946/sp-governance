#!/usr/bin/env node

/**
 * SP Route Guard v2 — Lightweight PreToolUse Hook (Agent matcher)
 *
 * Simplified from v1: no longer blocks agent calls or requires SP-ROLE tags.
 * SP agents are archived — all work is done via OMC agents.
 *
 * Flow:
 *   1. No portfolio.json → skip
 *   2. Sub-project bypass → skip (user is developer, not PM)
 *   3. Prompt mentions registered projects → inject project context as additionalContext
 *   4. Otherwise → silent allow
 *
 * Output format: Claude Code PreToolUse hookSpecificOutput.additionalContext (never blocks)
 */

import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { readStdin } from './lib/stdin.mjs';
import { findPortfolioRoot } from './lib/portfolio.mjs';

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

    // 2. .sp-disabled → skip
    if (existsSync(join(cwd, '.sp-disabled'))) { allow(); return; }

    // 3. Sub-project bypass
    try {
      const normRaw = resolve(rawCwd).replace(/\\/g, '/').toLowerCase();
      const normRoot = resolve(cwd).replace(/\\/g, '/').toLowerCase();
      if (normRaw !== normRoot) {
        const pfData = JSON.parse(readFileSync(portfolioPath, 'utf-8'));
        const isInProject = (pfData.projects || []).some(p => {
          const pp = resolve(cwd, p.path).replace(/\\/g, '/').toLowerCase();
          return normRaw === pp || normRaw.startsWith(pp + '/');
        });
        if (isInProject) { allow(); return; }
      }
    } catch { /* continue */ }

    // 4. Read portfolio for project matching
    let portfolio;
    try {
      portfolio = JSON.parse(readFileSync(portfolioPath, 'utf-8'));
    } catch { allow(); return; }

    // 5. Build project registry
    const projects = portfolio.projects || [];
    const projectNames = new Set(projects.map(p => p.name.toLowerCase()));
    const projectPaths = new Set(projects.map(p => p.path.toLowerCase()));
    const allKeys = new Set([...projectNames, ...projectPaths]);

    if (allKeys.size === 0) { allow(); return; }

    // 6. Check if prompt mentions registered projects
    const text = ((toolInput.prompt || '') + ' ' + (toolInput.description || '')).toLowerCase();
    const matched = [...allKeys].filter(n => {
      const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|[^a-z0-9-])${escaped}(?:$|[^a-z0-9-])`).test(text);
    });

    if (matched.length === 0) { allow(); return; }

    // 7. Inject project context (informational only, never blocks)
    const matchedProjects = projects.filter(p =>
      matched.includes(p.name.toLowerCase()) || matched.includes(p.path.toLowerCase())
    );
    const seen = new Set();
    const unique = matchedProjects.filter(p => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });

    const info = unique.map(p =>
      `${p.name} (${p.tech_stack}/${p.framework}, group: ${p.group}, level: ${p.level})`
    ).join('; ');

    allowWithContext(
      `[SP Context] 涉及项目: ${info}。请确保修改在对应项目目录范围内。`
    );
  } catch {
    // On any error, allow — never block
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

main();
