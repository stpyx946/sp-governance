#!/usr/bin/env node

/**
 * SP Bootstrap Guard — UserPromptSubmit Hook (Plugin version)
 *
 * Checks bootstrap state on every user input, enforcing PM startup protocol.
 *
 * Flow:
 *   0. Runtime switch detection (关闭SP/启用SP/disable SP/enable SP)
 *   1. No portfolio.json → detect workspace, prompt user to enable SP
 *   2. Has portfolio.json but no bootstrap-state.json → force full bootstrap
 *   3. bootstrap-state.json corrupt → force rebuild
 *   4. last_full_diagnostic > 24h → force re-diagnosis
 *   5. Within 24h → silent pass-through (no context injected)
 *
 * Cross-platform: Windows / Linux / macOS
 *
 * Output format: Claude Code UserPromptSubmit hookSpecificOutput.additionalContext
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { readStdin } from './lib/stdin.mjs';
import { findPortfolioRoot } from './lib/portfolio.mjs';

function passThrough() {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

function emit(status, message) {
  console.log(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: `[SP Bootstrap Guard] ${status}: ${message}`
    }
  }));
}

// Runtime switch keywords
const DISABLE_KEYWORDS = ['关闭sp', '禁用sp', 'disable sp', 'sp off'];
const ENABLE_KEYWORDS = ['启用sp', '开启sp', 'enable sp', 'sp on'];
const OVERRIDE_KEYWORDS = /(?:你自己(?:去)?做|PM亲自执行|不要派发|PM\s*override|pm直接|你亲自)/i;

async function main() {
  try {
    const input = await readStdin();
    if (!input.trim()) { passThrough(); return; }

    let data = {};
    try { data = JSON.parse(input); } catch { passThrough(); return; }

    const rawCwd = data.cwd || data.directory || process.cwd();
    const cwd = findPortfolioRoot(rawCwd);
    const portfolioPath = join(cwd, 'portfolio.json');
    const statePath = join(cwd, '.omc', 'bootstrap-state.json');

    // ===== 0. Runtime switch detection (highest priority) =====
    const prompt = (data.prompt || data.message || '').toLowerCase();

    if (DISABLE_KEYWORDS.some(kw => prompt.includes(kw))) {
      emit(
        'SP_DISABLE_REQUESTED',
        '用户请求关闭 SP 治理。执行以下操作: '
        + '1. 在工作空间根目录创建 .sp-disabled 文件 '
        + '(内容: {"disabled_at":"<当前ISO时间>","reason":"用户运行时关闭"}); '
        + '2. 告知用户 SP 治理已关闭，后续操作不受 SP 角色约束; '
        + '3. 如需重新开启，输入 "启用SP" 或 "enable SP"。'
      );
      return;
    }

    if (ENABLE_KEYWORDS.some(kw => prompt.includes(kw))) {
      emit(
        'SP_ENABLE_REQUESTED',
        '用户请求开启 SP 治理。执行以下操作: '
        + '1. 删除工作空间根目录的 .sp-disabled 文件 (如存在); '
        + '2. 检查项目 CLAUDE.md 是否有 <!-- SP:START --> 标记; '
        + '3. 如无: 从 ~/.claude/plugins/sp-governance/CLAUDE.md 读取完整内容，'
        + '用 <!-- SP:START --> / <!-- SP:END --> 标记注入项目 CLAUDE.md; '
        + '4. 如无 portfolio.json: 按引导协议创建; '
        + '5. 告知用户 SP 治理已开启。'
      );
      return;
    }

    // ===== 0b. PM override keyword detection =====
    const rawPrompt = data.prompt || data.message || '';
    if (OVERRIDE_KEYWORDS.test(rawPrompt)) {
      const sessionId = data.session_id || '';
      if (sessionId) {
        const overrideDir = join(cwd, '.omc', 'state');
        mkdirSync(overrideDir, { recursive: true });
        const overridePath = join(overrideDir, `pm-override-${sessionId}.json`);
        writeFileSync(overridePath, JSON.stringify({
          active: true,
          session_id: sessionId,
          timestamp: new Date().toISOString(),
          ttl_seconds: 120
        }));
      }
    }

    // ===== 1. No portfolio.json → detect workspace, prompt if needed =====
    if (!existsSync(portfolioPath)) {
      const optOutPath = join(cwd, '.sp-disabled');

      // 1a. Already opted out → skip
      if (existsSync(optOutPath)) { passThrough(); return; }

      // 1b. Project CLAUDE.md already has SP content → skip
      const hasSP = (p) => {
        if (!existsSync(p)) return false;
        try { return readFileSync(p, 'utf-8').includes('<!-- SP:START -->'); }
        catch { return false; }
      };
      if (hasSP(join(cwd, 'CLAUDE.md')) || hasSP(join(cwd, '.claude', 'CLAUDE.md'))) {
        passThrough(); return;
      }

      // 1c. Prompt user about enabling SP governance
      emit(
        'SP_GOVERNANCE_AVAILABLE',
        '当前工作空间未启用 SP 治理体系。使用 AskUserQuestion 询问用户是否启用 SP governance。'
        + '\n\n如果用户选择启用，自动执行以下完整流水线（中间不需要额外用户交互）:'
        + '\n1. 扫描工作空间所有一级子目录，检测包含项目指标(.git, package.json, pom.xml, build.gradle, Cargo.toml, go.mod, pyproject.toml, requirements.txt, composer.json, pubspec.yaml, Makefile, CMakeLists.txt)的子目录;'
        + '\n2. 对每个检测到的项目目录，通过构建配置文件识别技术栈类型(java_maven/nodejs_express/nextjs/nuxt/react/vue/python/go/rust/electron/unknown);'
        + '\n3. 根据技术栈和命名前缀自动分组:'
        + '\n   - 同技术栈的后端服务(java/spring) + API网关(express+nacos) → core-backend'
        + '\n   - 前端应用(nextjs/nuxt/umijs/react/vue) → frontend'
        + '\n   - 桌面应用(electron) → desktop'
        + '\n   - CI/CD、监控、脚本、版本管理类 → devops'
        + '\n   - 其余小型/配置/低代码项目 → peripheral'
        + '\n4. 判断工作空间模式: 检测到 ≥2 个项目 → multi-project, 否则 → single-project;'
        + '\n5. 一次性创建 portfolio.json（含项目列表 + 分组）;'
        + '\n6. 读取 ~/.claude/plugins/sp-governance/CLAUDE.md，用 <!-- SP:START --> / <!-- SP:END --> 标记注入到工作空间 CLAUDE.md;'
        + '\n7. 创建 .omc/bootstrap-state.json 持久化启动状态;'
        + '\n8. 输出初始化汇总报告（项目数、分组、技术栈分布），使用 AskUserQuestion 让用户确认或调整分组。'
        + '\n\n如果用户选择不启用:'
        + '\n在工作空间根目录创建 .sp-disabled 文件 (内容: {"disabled_at":"<ISO时间>","reason":"用户选择不启用"})。'
      );
      return;
    }

    // ===== 2. Has portfolio.json — normal bootstrap flow =====

    // 2a. No bootstrap-state.json → force full bootstrap
    if (!existsSync(statePath)) {
      emit(
        'BOOTSTRAP_REQUIRED',
        'bootstrap-state.json 不存在。你必须先执行完整启动流程: '
          + '自诊断 (agents/10 + governance/5 + 项目目录 + .omc 完整性) → '
          + '漂移检测 → 状态持久化。完成前禁止处理用户任务。'
      );
      return;
    }

    // 2b. Read state
    let state;
    try {
      state = JSON.parse(readFileSync(statePath, 'utf-8'));
    } catch {
      emit(
        'BOOTSTRAP_REQUIRED',
        'bootstrap-state.json 损坏。必须重建并执行完整启动。'
      );
      return;
    }

    // 2c. Check staleness
    const lastCheck = new Date(state.last_full_diagnostic || 0);
    const hoursAgo = (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60);

    if (hoursAgo > 24) {
      emit(
        'BOOTSTRAP_STALE',
        '上次完整诊断距今 ' + Math.floor(hoursAgo) + ' 小时，超过 24h 阈值。'
          + '必须执行完整启动: 自诊断 → 漂移检测 → 状态持久化。完成前禁止处理用户任务。'
      );
      return;
    }

    // 2d. Within 24h — silent pass-through, no context injected
    passThrough();
  } catch {
    // On any error, allow continuation — never block
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

main();
