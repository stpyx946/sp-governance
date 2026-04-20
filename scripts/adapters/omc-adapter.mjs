/**
 * omc-adapter.mjs — SP Governance v9 的 OMC 编排适配器
 *
 * 将 SP 治理决策桥接到 OMC 执行能力。
 * 被 Bootstrap Guard 和 SP 的 dispatch skill 调用。
 *
 * @module omc-adapter
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { detectOMC, findIntegrationState } from '../lib/integration.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** 缓存有效期：24 小时（毫秒） */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// 内部工具：安全读取同目录 JSON 文件
// ---------------------------------------------------------------------------

/**
 * 读取并解析同目录下的 JSON 文件。
 * 失败时返回空对象，不抛异常。
 * @param {string} filename
 * @returns {object}
 */
function readLocalJson(filename) {
  try {
    const filePath = join(__dirname, filename);
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

// 模块级缓存，避免重复读取磁盘
let _agentMap = null;
let _modeRouter = null;

function getAgentMap() {
  if (!_agentMap) _agentMap = readLocalJson('omc-agent-map.json');
  return _agentMap;
}

function getModeRouter() {
  if (!_modeRouter) _modeRouter = readLocalJson('omc-mode-router.json');
  return _modeRouter;
}

// ---------------------------------------------------------------------------
// 1. isOMCAvailable
// ---------------------------------------------------------------------------

/**
 * 检查 OMC 是否可用。
 *
 * 优先读取 {workspaceRoot}/.sp/integration.json 缓存；
 * 缓存不存在或超过 24 小时时重新探测。
 *
 * @param {string} workspaceRoot - 工作空间根目录路径
 * @returns {{ available: boolean, version: string|null, path: string|null }}
 */
export function isOMCAvailable(workspaceRoot) {
  try {
    // 尝试读取缓存
    const cached = findIntegrationState(workspaceRoot);
    if (cached) {
      const refreshedAt = new Date(cached.refreshedAt || 0);
      const age = Date.now() - refreshedAt.getTime();
      if (age < CACHE_TTL_MS && cached.omc) {
        return {
          available: cached.omc.found === true,
          version: cached.omc.version ?? null,
          path: cached.omc.path ?? null,
        };
      }
    }

    // 缓存不存在或已过期：重新探测
    const result = detectOMC();
    return {
      available: result.found === true,
      version: result.version ?? null,
      path: result.path ?? null,
    };
  } catch {
    return { available: false, version: null, path: null };
  }
}

// ---------------------------------------------------------------------------
// 2. resolveAgent
// ---------------------------------------------------------------------------

/**
 * 根据 SP 角色名，从 omc-agent-map.json 查找对应的 OMC Agent。
 *
 * OMC 不可用时返回 { omc_agent: null, model: null, fallback_skill: "..." }。
 *
 * @param {string} spRole - SP 角色名，如 "architect"、"executor"、"code-reviewer"
 * @returns {{
 *   omc_agent: string|null,
 *   model: "opus"|"sonnet"|"haiku"|null,
 *   fallback_skill: string|null
 * }}
 */
export function resolveAgent(spRole) {
  const safe = {
    omc_agent: null,
    model: null,
    fallback_skill: null,
  };

  try {
    const map = getAgentMap();
    const mappings = map.mappings ?? {};
    const entry = mappings[spRole];

    if (!entry) return safe;

    return {
      omc_agent: entry.omc_agent ?? null,
      model: entry.model ?? null,
      fallback_skill: entry.sp_skill_fallback ?? null,
    };
  } catch {
    return safe;
  }
}

// ---------------------------------------------------------------------------
// 3. recommendMode
// ---------------------------------------------------------------------------

/**
 * 根据任务上下文推荐 OMC 执行模式。
 * 从 omc-mode-router.json 按优先级匹配规则。
 *
 * @param {{
 *   project_count: number,
 *   estimated_files: number,
 *   is_hotfix: boolean,
 *   is_planning: boolean
 * }} taskContext
 * @returns {{
 *   sp_channel: "express"|"standard"|"full"|"hotfix"|null,
 *   omc_mode: "autopilot"|"team"|"ultrawork"|"ralph"|"ralplan"|null,
 *   description: string
 * }}
 */
export function recommendMode(taskContext) {
  const safe = {
    sp_channel: null,
    omc_mode: null,
    description: 'OMC 模式不可用，SP 使用普通 Agent 串行执行',
  };

  try {
    const { project_count = 1, estimated_files = 0, is_hotfix = false, is_planning = false } = taskContext ?? {};
    const router = getModeRouter();
    const rules = router.rules ?? [];

    // 按条件优先级匹配
    if (is_hotfix) {
      const rule = rules.find((r) => r.condition === 'hotfix');
      if (rule) return { sp_channel: rule.sp_channel, omc_mode: rule.omc_mode, description: rule.description };
    }

    if (is_planning) {
      const rule = rules.find((r) => r.condition === 'planning');
      if (rule) return { sp_channel: rule.sp_channel, omc_mode: rule.omc_mode, description: rule.description };
    }

    if (project_count > 1) {
      const rule = rules.find((r) => r.condition === 'cross_project');
      if (rule) return { sp_channel: rule.sp_channel, omc_mode: rule.omc_mode, description: rule.description };
    }

    // 单项目：按文件数分级匹配
    const singleRules = rules.filter((r) =>
      r.condition === 'single_project_simple' ||
      r.condition === 'single_project_standard' ||
      r.condition === 'single_project_complex',
    );

    for (const rule of singleRules) {
      if (rule.max_files === null || estimated_files <= rule.max_files) {
        return { sp_channel: rule.sp_channel, omc_mode: rule.omc_mode, description: rule.description };
      }
    }

    return safe;
  } catch {
    return safe;
  }
}

// ---------------------------------------------------------------------------
// 4. buildAgentPrompt
// ---------------------------------------------------------------------------

/**
 * 构建增强后的 Agent prompt，注入项目上下文。
 *
 * 格式：
 * ```
 * [SP Context] 项目: {name}, 技术栈: {techStack}, 分组: {group}
 * [SP Role] {spRole} — 使用 OMC Agent: {omc_agent} (model: {model})
 *
 * {basePrompt}
 * ```
 *
 * @param {string} spRole - SP 角色名
 * @param {{ name: string, techStack: string, group: string, description?: string }} projectContext
 * @param {string} basePrompt - 原始任务 prompt
 * @returns {string} 增强后的 prompt
 */
export function buildAgentPrompt(spRole, projectContext, basePrompt) {
  try {
    const { name = '', techStack = '', group = '' } = projectContext ?? {};
    const resolved = resolveAgent(spRole);
    const agentLabel = resolved.omc_agent ?? '(无 OMC Agent)';
    const modelLabel = resolved.model ?? 'unknown';

    const contextLine = `[SP Context] 项目: ${name}, 技术栈: ${techStack}, 分组: ${group}`;
    const roleLine = `[SP Role] ${spRole} — 使用 OMC Agent: ${agentLabel} (model: ${modelLabel})`;

    return `${contextLine}\n${roleLine}\n\n${basePrompt ?? ''}`;
  } catch {
    return basePrompt ?? '';
  }
}

// ---------------------------------------------------------------------------
// 5. buildDispatchCall
// ---------------------------------------------------------------------------

/**
 * 构建完整的 Agent 调用参数对象，供 SP PM 使用。
 *
 * 当 OMC 不可用时，subagent_type 为 null，并在 fallback 字段提供降级 skill 信息。
 *
 * @param {string} spRole - SP 角色名
 * @param {{ name: string, techStack: string, group: string, description?: string }} projectContext
 * @param {string} taskPrompt - 原始任务 prompt
 * @returns {{
 *   subagent_type: string|null,
 *   model: string|null,
 *   prompt: string,
 *   run_in_background: boolean,
 *   fallback?: { type: "skill", skill_name: string }
 * }}
 */
export function buildDispatchCall(spRole, projectContext, taskPrompt) {
  try {
    const resolved = resolveAgent(spRole);
    const prompt = buildAgentPrompt(spRole, projectContext, taskPrompt);

    const base = {
      subagent_type: resolved.omc_agent,
      model: resolved.model,
      prompt,
      run_in_background: true,
    };

    // OMC 不可用但有降级 skill
    if (!resolved.omc_agent && resolved.fallback_skill) {
      return {
        ...base,
        fallback: {
          type: 'skill',
          skill_name: resolved.fallback_skill,
        },
      };
    }

    return base;
  } catch {
    return {
      subagent_type: null,
      model: null,
      prompt: taskPrompt ?? '',
      run_in_background: true,
    };
  }
}
