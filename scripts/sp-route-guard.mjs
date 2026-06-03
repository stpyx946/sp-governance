#!/usr/bin/env node
/**
 * sp-route-guard.mjs v10 — PreToolUse Hook (Agent matcher)
 *
 * Reduced from 193 → ~110 lines by replacing hardcoded role keyword tables
 * with capability-discovery matchCapabilities() output, injected as
 * <sp-capability-match>JSON</sp-capability-match> for the main model to parse.
 *
 * Behavior:
 *   1. Sub-agent bypass (data.agent_id || data.parentToolUseId)
 *   2. No portfolio.json → silent allow
 *   3. .sp-disabled → silent allow
 *   4. Sub-project bypass (readonly/off also bypass)
 *   5. Match registered project names in prompt → inject project context
 *   6. Run capability discovery + matching → inject JSON recommendations
 *   7. Never blocks
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readStdin } from './lib/stdin.mjs';
import { findPortfolioRoot, readPortfolio, getProjectForCwd, isProjectGovernanceSkipped } from './lib/portfolio.mjs';
import { discoverCapabilities, matchCapabilities } from './lib/capability-discovery.mjs';
import { readSPState } from './lib/trust-policy.mjs';

function allow() {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

function allowWithContext(message) {
  console.log(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: message,
    },
  }));
}

async function main() {
  try {
    const input = await readStdin();
    if (!input.trim()) { allow(); return; }

    let data = {};
    try { data = JSON.parse(input); } catch { allow(); return; }

    // 1. Sub-agent bypass (parent hook handles parent prompt; sub-agents stay silent)
    if (data.agent_id || data.parentToolUseId) { allow(); return; }

    const toolInput = data.tool_input || data.toolInput || {};
    const rawCwd = data.cwd || data.directory || process.cwd();
    const cwd = findPortfolioRoot(rawCwd);
    const portfolioPath = join(cwd, 'portfolio.json');

    if (!existsSync(portfolioPath)) { allow(); return; }
    if (existsSync(join(cwd, '.sp-disabled'))) { allow(); return; }

    // Sub-project bypass (also covers readonly/off)
    const proj = getProjectForCwd(rawCwd, cwd);
    if (proj) {
      if (isProjectGovernanceSkipped(proj)) { allow(); return; }
      // Inside an auto-mode project, route-guard still allows (it's a TeamLead workspace)
      allow(); return;
    }

    // Workspace root — proceed with matching
    const portfolio = readPortfolio(cwd);
    if (!portfolio?.projects?.length) { allow(); return; }

    const promptText = ((toolInput.prompt || '') + ' ' + (toolInput.description || '')).toLowerCase();
    let additionalContext = '';

    // 1. Match registered project names in prompt
    const matchedProjects = portfolio.projects.filter(p => {
      const escName = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').toLowerCase();
      return new RegExp(`(?:^|[^a-z0-9-])${escName}(?:$|[^a-z0-9-])`).test(promptText);
    });
    if (matchedProjects.length > 0) {
      const info = matchedProjects.map(p =>
        `${p.name} (${p.tech_stack}/${p.framework}, group: ${p.group}, level: ${p.level})`
      ).join('; ');
      additionalContext = `[SP Context] 涉及项目: ${info}。请确保修改在对应项目目录范围内。`;
    }

    // 2. Capability matching → JSON injection
    try {
      const sp = readSPState(cwd);
      const matchOpts = sp.config?.discovery?.match || {};
      const stopExtra = sp.config?.discovery?.stopwords_extra || [];
      const caps = discoverCapabilities(cwd);
      const userPrompt = toolInput.prompt || '';
      if (userPrompt && caps.index && caps.index.size > 0) {
        const matches = matchCapabilities(userPrompt, caps.index, {
          topK: matchOpts.top_k ?? 3,
          minScore: matchOpts.min_score ?? 2,
          boostNameExact: matchOpts.boost_name_exact ?? 3,
        });
        if (matches.length > 0) {
          const payload = {
            prompt_keywords: [...new Set(userPrompt.toLowerCase().match(/[a-z]+|[一-龥]+/g) || [])].slice(0, 10),
            matches: matches.map(m => ({
              plugin: m.plugin,
              name: m.name,
              kind: m.kind,
              model: m.model,
              score: m.score,
            })),
          };
          additionalContext += (additionalContext ? '\n' : '') +
            `<sp-capability-match>${JSON.stringify(payload)}</sp-capability-match>`;
        }
      }
    } catch { /* discovery errors never block routing */ }

    if (additionalContext) {
      allowWithContext(additionalContext);
    } else {
      allow();
    }
  } catch {
    allow();
  }
}

main();
