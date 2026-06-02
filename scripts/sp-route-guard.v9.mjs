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

let buildRulesContext = null;
let isECCAvailable = null;
try {
  const eccAdapter = await import('./adapters/ecc-adapter.mjs');
  buildRulesContext = eccAdapter.buildRulesContext;
  isECCAvailable = eccAdapter.isECCAvailable;
} catch { /* ECC adapter 不可用，跳过规则注入 */ }

let resolveAgent = null;
let isOMCAvailable = null;
try {
  const omcAdapter = await import('./adapters/omc-adapter.mjs');
  resolveAgent = omcAdapter.resolveAgent;
  isOMCAvailable = omcAdapter.isOMCAvailable;
} catch { /* OMC adapter 不可用，跳过 agent 推荐 */ }

function matchProjectName(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[\\s/\\\\:,."'(\\[])${escaped}(?:$|[\\s/\\\\:,."')\\]])`, 'i').test(text);
}

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

    let additionalContext = `[SP Context] 涉及项目: ${info}。请确保修改在对应项目目录范围内。`;

    // === ECC 编码规范注入 ===
    if (buildRulesContext && isECCAvailable) {
      try {
        const eccStatus = isECCAvailable(cwd);
        if (eccStatus.available && eccStatus.path) {
          const agentPrompt = toolInput.prompt || '';
          const matchedProject = portfolio.projects?.find(p =>
            matchProjectName(agentPrompt, p.name)
          );
          if (matchedProject?.tech_stack) {
            const rulesCtx = buildRulesContext(matchedProject.tech_stack, eccStatus.path);
            if (rulesCtx) {
              additionalContext += '\n' + rulesCtx;
            }
          }
        }
      } catch { /* ECC 规则注入失败不影响路由 */ }
    }

    // === OMC Agent 推荐注入 ===
    if (resolveAgent && isOMCAvailable) {
      try {
        const omcStatus = isOMCAvailable(cwd);
        if (omcStatus.available) {
          // 从 prompt 中推断 SP 角色关键词，映射到 OMC agent
          const agentPrompt = (toolInput.prompt || '').toLowerCase();
          const roleKeywords = [
            ['architect', '架构'],
            ['executor', '实现', '开发', '编码'],
            ['code-reviewer', '审查', 'review'],
            ['test-engineer', '测试', 'test'],
            ['debugger', '调试', 'debug'],
            ['writer', '文档', 'doc'],
            ['security-reviewer', '安全', 'security'],
            ['explore', '搜索', '查找', 'explore'],
            ['planner', '规划', 'plan'],
          ];
          let detectedRole = null;
          for (const [role, ...keywords] of roleKeywords) {
            if (keywords.some(kw => agentPrompt.includes(kw))) {
              detectedRole = role;
              break;
            }
          }
          if (detectedRole) {
            const resolved = resolveAgent(detectedRole);
            if (resolved.omc_agent) {
              additionalContext += `\n[SP-OMC] 推荐 OMC Agent: ${resolved.omc_agent} (model: ${resolved.model})`;
            }
          }
        }
      } catch { /* OMC agent 推荐失败不影响路由 */ }
    }

    allowWithContext(additionalContext);
  } catch {
    // On any error, allow — never block
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

main();
