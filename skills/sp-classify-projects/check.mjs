#!/usr/bin/env node
// sp-classify-projects — suggest governance_mode for each project

import { readPortfolio, findPortfolioRoot } from '../../scripts/lib/portfolio.mjs';

const READONLY_KEYWORDS = ['fork', '翻译', '中文版', '中文翻译', '教程', '手册', '电子书', '文档站', '资料合集'];
const READONLY_FRAMEWORKS = new Set(['docs', 'ebooks', 'research', 'templates', 'jupyter']);
const READONLY_TECH = new Set(['markdown']);

function suggest(p) {
  const desc = (p.description || '').toLowerCase();
  if (READONLY_KEYWORDS.some(k => desc.includes(k.toLowerCase()))) return 'readonly';
  if (p.level === 'C' && READONLY_FRAMEWORKS.has((p.framework || '').toLowerCase())) return 'readonly';
  if (p.level === 'C' && READONLY_TECH.has((p.tech_stack || '').toLowerCase())) return 'readonly';
  return 'auto';
}

const arg = process.argv[2] || process.cwd();
const cwd = findPortfolioRoot(arg);
const pf = readPortfolio(cwd);
if (!pf) {
  console.log(JSON.stringify({ error: 'portfolio.json not found', workspace: cwd }, null, 2));
  process.exit(1);
}

const report = pf.projects.map(p => ({
  name: p.name,
  path: p.path,
  level: p.level,
  framework: p.framework,
  tech_stack: p.tech_stack,
  current_mode: p.governance_mode || 'auto',
  suggested_mode: suggest(p),
  needs_review: (p.governance_mode || 'auto') !== suggest(p),
}));

const summary = {
  workspace: cwd,
  total: report.length,
  needs_review: report.filter(r => r.needs_review).length,
  projects: report,
};

console.log(JSON.stringify(summary, null, 2));
