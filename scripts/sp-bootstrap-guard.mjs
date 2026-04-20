#!/usr/bin/env node

/**
 * SP Bootstrap Guard — UserPromptSubmit Hook (Plugin version)
 *
 * Checks bootstrap state on every user input, enforcing PM startup protocol.
 *
 * Flow:
 *   0. Sub-project bypass (CWD inside registered project → skip)
 *   0a. Runtime switch detection (关闭SP/启用SP/disable SP/enable SP)
 *   1. No portfolio.json → detect workspace, prompt user to enable SP
 *   2. Has portfolio.json but no bootstrap-state.json → create state silently
 *   3. bootstrap-state.json corrupt → recreate silently
 *   4. last_full_diagnostic > 7 days → auto-refresh state, lightweight reminder
 *   5. Within 7 days → silent pass-through (no context injected)
 *
 * Cross-platform: Windows / Linux / macOS
 *
 * Output format: Claude Code UserPromptSubmit hookSpecificOutput.additionalContext
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { readStdin } from './lib/stdin.mjs';
import { findPortfolioRoot } from './lib/portfolio.mjs';

let findIntegrationState, refreshIntegrationState, writeIntegrationState, getHookEnvironment;
try {
  ({ findIntegrationState, refreshIntegrationState, writeIntegrationState } = await import('./lib/integration.mjs'));
} catch { /* integration.mjs 不存在时静默忽略 */ }
try {
  ({ getHookEnvironment } = await import('./adapters/ecc-adapter.mjs'));
} catch { /* ecc-adapter.mjs 不存在时静默忽略 */ }

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

    // ===== Sub-project bypass: inside a registered project → skip PM bootstrap =====
    if (existsSync(portfolioPath)) {
      try {
        const normRaw = resolve(rawCwd).replace(/\\/g, '/').toLowerCase();
        const normRoot = resolve(cwd).replace(/\\/g, '/').toLowerCase();
        if (normRaw !== normRoot) {
          const pf = JSON.parse(readFileSync(portfolioPath, 'utf-8'));
          const isInProject = (pf.projects || []).some(p => {
            const pp = resolve(cwd, p.path).replace(/\\/g, '/').toLowerCase();
            return normRaw === pp || normRaw.startsWith(pp + '/');
          });
          if (isInProject) { passThrough(); return; }
        }
      } catch { /* continue normal flow */ }
    }

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

    // === 集成状态管理 (P4 优先级) ===
    // 仅在 portfolio.json 存在时才执行
    if (existsSync(portfolioPath)) {
      try {
        if (findIntegrationState && refreshIntegrationState) {
          let integrationState = findIntegrationState(cwd);
          const now = Date.now();

          // 集成状态不存在或过期(>24h) → 刷新
          if (!integrationState || !integrationState.last_compat_check ||
              (now - new Date(integrationState.last_compat_check).getTime()) > 86400000) {
            integrationState = refreshIntegrationState(cwd);
          }

          // 设置 ECC Hook 环境变量（如果 ECC 可用）
          if (integrationState?.integrations?.ecc?.detected) {
            try {
              if (getHookEnvironment) {
                const hookEnv = getHookEnvironment();
                if (hookEnv.ECC_HOOK_PROFILE) {
                  process.env.ECC_HOOK_PROFILE = hookEnv.ECC_HOOK_PROFILE;
                }
                if (hookEnv.ECC_DISABLED_HOOKS) {
                  // M2: 去重 + 格式白名单过滤
                  const HOOK_ID_PATTERN = /^[a-zA-Z0-9_:-]+$/;
                  const existing = process.env.ECC_DISABLED_HOOKS || '';
                  const allHooks = [...new Set(
                    [...(existing || '').split(','), ...(hookEnv.ECC_DISABLED_HOOKS || '').split(',')]
                      .map(s => s.trim())
                      .filter(Boolean)
                  )];
                  const validHooks = allHooks.filter(id => HOOK_ID_PATTERN.test(id));
                  process.env.ECC_DISABLED_HOOKS = validHooks.join(',');
                }

                // H1: 持久化 ecc hook 配置到 integration state
                if (writeIntegrationState) {
                  try {
                    const currentState = findIntegrationState(cwd) || integrationState || {};
                    currentState.ecc_hook_config = {
                      profile_path: process.env.ECC_HOOK_PROFILE || null,
                      disabled_hooks: (process.env.ECC_DISABLED_HOOKS || '').split(',').filter(Boolean)
                    };
                    writeIntegrationState(cwd, currentState);
                  } catch { /* 持久化失败不影响核心流程 */ }
                }
              }
            } catch { /* ECC adapter 加载失败不影响核心流程 */ }
          }

          // 首次检测到集成变化时，通过 additionalContext 通知一次
          // 后续静默运行（不每次都输出）
        }
      } catch {
        // 集成检测失败不影响核心 Guard 功能
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

    // 2a. No bootstrap-state.json → create minimal state silently, no diagnostic required
    if (!existsSync(statePath)) {
      try {
        mkdirSync(join(cwd, '.omc'), { recursive: true });
        writeFileSync(statePath, JSON.stringify({
          last_full_diagnostic: new Date().toISOString(),
          version: 'auto-created',
          projects_count: (() => {
            try { return JSON.parse(readFileSync(portfolioPath, 'utf-8')).projects?.length || 0; }
            catch { return 0; }
          })()
        }));
      } catch { /* non-critical */ }
      passThrough();
      return;
    }

    // 2b. Read state
    let state;
    try {
      state = JSON.parse(readFileSync(statePath, 'utf-8'));
    } catch {
      // Corrupt → recreate silently
      try {
        writeFileSync(statePath, JSON.stringify({
          last_full_diagnostic: new Date().toISOString(),
          version: 'auto-recreated'
        }));
      } catch { /* non-critical */ }
      passThrough();
      return;
    }

    // 2c. Check staleness (7-day threshold instead of 24h)
    const lastCheck = new Date(state.last_full_diagnostic || 0);
    const hoursAgo = (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60);
    const STALE_HOURS = 168; // 7 days

    if (hoursAgo > STALE_HOURS) {
      // Auto-refresh state, emit lightweight reminder only
      try {
        state.last_full_diagnostic = new Date().toISOString();
        writeFileSync(statePath, JSON.stringify(state));
      } catch { /* non-critical */ }
      emit(
        'BOOTSTRAP_REFRESHED',
        'SP 治理状态已自动刷新 (距上次 ' + Math.floor(hoursAgo / 24) + ' 天)。portfolio.json 已加载。'
      );
      return;
    }

    // 2d. Within threshold — silent pass-through, no context injected
    passThrough();
  } catch {
    // On any error, allow continuation — never block
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

main();
