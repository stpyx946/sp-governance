#!/usr/bin/env node
/**
 * sp-bootstrap-guard.mjs v10 — UserPromptSubmit Hook
 *
 * Replaces v9 (327 lines) with thin orchestrator over lib modules.
 * Responsibilities:
 *   1. Sub-project bypass (CWD inside registered project → silent)
 *   2. Runtime command detection (disable/enable SP, trust edits, engine switch)
 *   3. Bootstrap state refresh (7-day stale)
 *   4. First-run integration guidance (only on detection change)
 *
 * All output is JSON to stdout. Never throws — passThrough on any error.
 *
 * NOTE: writeState/readState are top-level imports (no dynamic imports inside),
 *       per Plan agent self-audit correction.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readStdin } from './lib/stdin.mjs';
import { findPortfolioRoot, getProjectForCwd } from './lib/portfolio.mjs';
import { detectRuntimeCommand } from './lib/runtime-switch.mjs';
import { readState, refreshState, isStale } from './lib/bootstrap-state.mjs';
import { probeIntegration } from './lib/integration-probe.mjs';

function passThrough() {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

function emit(status, message) {
  console.log(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: `[SP Bootstrap Guard] ${status}: ${message}`,
    },
  }));
}

function runtimeGuidance(cmd) {
  switch (cmd.action) {
    case 'disable_sp':
      return 'SP_DISABLE_REQUESTED: 创建工作空间根目录的 .sp-disabled 文件 '
        + '(内容: {"disabled_at":"<ISO时间>","reason":"用户运行时关闭"}); 告知用户 SP 治理已关闭。'
        + ' 如需重新开启，输入 "启用SP"。';
    case 'enable_sp':
      return 'SP_ENABLE_REQUESTED: 删除工作空间根目录的 .sp-disabled (如存在); '
        + '检查 CLAUDE.md 是否含 <!-- SP:START -->; 如无: 运行 sp-install-claudemd.mjs 注入; '
        + '告知用户 SP 治理已开启。';
    case 'set_default_trust':
      return `SET_DEFAULT_TRUST: 编辑 .omc/sp.json::trust.default_policy = "${cmd.value}"。如文件不存在则先用 default state 创建。`;
    case 'trust_marketplace':
      return `TRUST_MARKETPLACE: 编辑 .omc/sp.json::trust.marketplaces["${cmd.target}"] = "allow"。`;
    case 'untrust':
      return `UNTRUST: 编辑 .omc/sp.json::trust.marketplaces["${cmd.target}"] = "ask"。`;
    case 'deny':
      return `DENY: 编辑 .omc/sp.json::trust.marketplaces["${cmd.target}"] = "deny"。`;
    case 'reset_trust':
      return 'RESET_TRUST: 删除 .omc/sp.json (下次 hook 触发会重建默认值并引导用户)。';
    case 'switch_engine':
      return `SWITCH_ENGINE: 编辑 .omc/sp.json::execution_engine = "${cmd.value}"。`;
    default:
      return 'UNKNOWN_COMMAND';
  }
}

async function main() {
  try {
    const input = await readStdin();
    if (!input.trim()) { passThrough(); return; }

    let data = {};
    try { data = JSON.parse(input); } catch { passThrough(); return; }

    // Sub-agent bypass (parent hook handles parent prompt; sub-agents stay silent)
    if (data.agent_id || data.parentToolUseId) { passThrough(); return; }

    const rawCwd = data.cwd || data.directory || process.cwd();
    const cwd = findPortfolioRoot(rawCwd);
    const portfolioPath = join(cwd, 'portfolio.json');

    // 1. Sub-project bypass
    if (existsSync(portfolioPath)) {
      const proj = getProjectForCwd(rawCwd, cwd);
      if (proj) { passThrough(); return; }
    }

    // 2. Runtime command detection (highest priority after bypass)
    const prompt = data.prompt || data.message || '';
    const cmd = detectRuntimeCommand(prompt);
    if (cmd) {
      emit(cmd.action.toUpperCase(), runtimeGuidance(cmd));
      return;
    }

    // 3. No portfolio.json → prompt user to enable SP
    if (!existsSync(portfolioPath)) {
      const optOutPath = join(cwd, '.sp-disabled');
      if (existsSync(optOutPath)) { passThrough(); return; }
      emit('SP_GOVERNANCE_AVAILABLE',
        '当前工作空间未启用 SP 治理。使用 AskUserQuestion 询问用户是否启用。'
        + ' 若启用：扫描子目录识别项目 → 生成 portfolio.json → 注入 CLAUDE.md 的 <!-- SP:START --> 区块 → 创建 .omc/sp.json (default trust policy: ask)。'
        + ' 若不启用：创建 .sp-disabled 标记文件。');
      return;
    }

    // 4. Refresh bootstrap state if stale
    let state = readState(cwd);
    if (!state) {
      state = refreshState(cwd);  // create new
      passThrough();
      return;
    }
    if (isStale(state)) {
      state = refreshState(cwd);
      const probe = probeIntegration(cwd);
      emit('BOOTSTRAP_REFRESHED',
        `SP 治理状态已自动刷新。模式: ${probe.mode} (${probe.plugin_count} 个插件)。`);
      return;
    }

    // 5. Within freshness window — silent
    passThrough();
  } catch {
    passThrough();
  }
}

main();
