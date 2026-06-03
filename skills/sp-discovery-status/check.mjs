#!/usr/bin/env node
// sp-discovery-status — read-only SP state report.

import { getDiscoveryStats } from '../../scripts/lib/capability-discovery.mjs';
import { readSPState } from '../../scripts/lib/trust-policy.mjs';
import { probeIntegration } from '../../scripts/lib/integration-probe.mjs';
import { findPortfolioRoot } from '../../scripts/lib/portfolio.mjs';

const arg = process.argv[2] || process.cwd();
const cwd = findPortfolioRoot(arg);

const stats = getDiscoveryStats(cwd);
const sp = readSPState(cwd);
const probe = probeIntegration(cwd);

const report = {
  workspace: cwd,
  execution_engine: sp.execution_engine,
  integration_mode: probe.mode,
  trust: {
    default_policy: sp.trust.default_policy,
    marketplace_count: Object.keys(sp.trust.marketplaces).length,
    plugin_overrides: Object.keys(sp.trust.plugins).length,
    decisions_logged: sp.trust.decisions.length,
  },
  discovery: stats,
};

console.log(JSON.stringify(report, null, 2));
