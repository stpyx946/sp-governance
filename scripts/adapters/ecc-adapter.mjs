/**
 * ECC Adapter — SP Governance v9
 *
 * Bridges ECC's coding rules, domain knowledge, and quality Hook capabilities
 * into the SP governance workflow.
 *
 * Called by:
 *   - Bootstrap Guard (sets Hook environment variables)
 *   - SP Skills (injects ECC domain knowledge into prompts)
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { detectECC, findIntegrationState } from '../lib/integration.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Maximum bytes to read from a SKILL.md file before truncating. */
const SKILL_MAX_BYTES = 10 * 1024; // 10 KB

/** Cache TTL in milliseconds (24 hours). */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read and parse a JSON file from the adapters directory.
 * Returns null on any error.
 * @param {string} filename
 * @returns {object|null}
 */
function readAdapterJson(filename) {
  try {
    const raw = readFileSync(join(__dirname, filename), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * List .md filenames (not paths) inside a directory.
 * Returns an empty array if the directory does not exist or is unreadable.
 * @param {string} dir
 * @returns {string[]}
 */
function listMdFiles(dir) {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
}

/**
 * Read a SKILL.md file, truncating at SKILL_MAX_BYTES if needed.
 * @param {string} filePath
 * @returns {string}
 */
function readSkillMd(filePath) {
  try {
    const raw = readFileSync(filePath);
    if (raw.length > SKILL_MAX_BYTES) {
      return raw.slice(0, SKILL_MAX_BYTES).toString('utf8') + '\n[truncated]';
    }
    return raw.toString('utf8');
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether ECC is available in the workspace.
 *
 * Priority:
 *   1. Read .sp/integration.json cache (if present and fresh, < 24 h old).
 *   2. Re-detect via detectECC() and return fresh result.
 *
 * @param {string} workspaceRoot
 * @returns {{ available: boolean, version: string|null, path: string|null }}
 */
export function isECCAvailable(workspaceRoot) {
  try {
    const state = findIntegrationState(workspaceRoot);
    if (state && state.refreshedAt && state.ecc) {
      const age = Date.now() - new Date(state.refreshedAt).getTime();
      if (age < CACHE_TTL_MS) {
        const { found, version, path } = state.ecc;
        return { available: Boolean(found), version: version ?? null, path: path ?? null };
      }
    }
  } catch {
    // fall through to live detection
  }

  try {
    const result = detectECC();
    return {
      available: Boolean(result.found),
      version: result.version ?? null,
      path: result.path ?? null,
    };
  } catch {
    return { available: false, version: null, path: null };
  }
}

/**
 * Resolve the ECC rules directories that apply to a given project tech stack.
 *
 * Always includes common/. Additional directories come from ecc-rules-map.json.
 * Only directories that actually exist under {eccPath}/rules/ are returned.
 *
 * @param {string} techStack - Value from portfolio.json (e.g. "vue", "python")
 * @param {string} eccPath   - ECC installation path
 * @returns {{
 *   available: string[],
 *   missing: string[],
 *   techStack: string
 * }}
 */
export function resolveRules(techStack, eccPath) {
  const map = readAdapterJson('ecc-rules-map.json');
  const rulesBase = join(eccPath, 'rules');

  const commonDir = map?.common ?? 'common/';
  const candidates = [commonDir];

  if (map?.mappings && techStack && map.mappings[techStack]) {
    candidates.push(...map.mappings[techStack]);
  }

  // Deduplicate while preserving order
  const seen = new Set();
  const unique = candidates.filter((d) => {
    if (seen.has(d)) return false;
    seen.add(d);
    return true;
  });

  const available = [];
  const missing = [];

  for (const dir of unique) {
    const fullPath = join(rulesBase, dir.replace(/\/$/, ''));
    if (existsSync(fullPath)) {
      available.push(dir);
    } else {
      missing.push(dir);
    }
  }

  return { available, missing, techStack };
}

/**
 * Find ECC skill knowledge that augments a given SP skill.
 *
 * Reads ecc-skill-augment.json, verifies each ECC skill directory exists,
 * and reads the SKILL.md content for existing skills.
 *
 * @param {string} spSkillName - e.g. "sp-jest", "sp-code-review"
 * @param {string} eccPath     - ECC installation path
 * @returns {{
 *   found: boolean,
 *   inject_as?: "context"|"checklist"|"reference",
 *   prompt_prefix?: string,
 *   skill_contents?: Array<{ name: string, content: string }>,
 *   missing_skills?: string[]
 * }}
 */
export function resolveSkillAugmentation(spSkillName, eccPath) {
  const config = readAdapterJson('ecc-skill-augment.json');
  const augmentations = config?.augmentations ?? {};

  const entry = augmentations[spSkillName];
  if (!entry) {
    return { found: false };
  }

  const skillsBase = join(eccPath, 'skills');
  const skill_contents = [];
  const missing_skills = [];

  for (const skillName of entry.ecc_skills ?? []) {
    const skillDir = join(skillsBase, skillName);
    if (!existsSync(skillDir)) {
      missing_skills.push(skillName);
      continue;
    }
    const mdPath = join(skillDir, 'SKILL.md');
    const content = existsSync(mdPath) ? readSkillMd(mdPath) : '';
    skill_contents.push({ name: skillName, content });
  }

  return {
    found: true,
    inject_as: entry.inject_as,
    prompt_prefix: entry.prompt_prefix,
    skill_contents,
    missing_skills,
  };
}

/**
 * Build an augmented prompt by prepending ECC skill knowledge to basePrompt.
 *
 * If no augmentation is found for spSkillName, returns basePrompt unchanged.
 *
 * Format:
 *   --- ECC Knowledge ({inject_as}) ---
 *   {prompt_prefix}
 *
 *   {skill_content_1}
 *
 *   {skill_content_2}
 *   --- End ECC Knowledge ---
 *
 *   {basePrompt}
 *
 * @param {string} spSkillName
 * @param {string} eccPath
 * @param {string} basePrompt
 * @returns {string}
 */
export function buildAugmentedPrompt(spSkillName, eccPath, basePrompt) {
  try {
    const aug = resolveSkillAugmentation(spSkillName, eccPath);
    if (!aug.found || aug.skill_contents.length === 0) {
      return basePrompt;
    }

    const contentBlocks = aug.skill_contents
      .map((s) => s.content)
      .filter(Boolean)
      .join('\n\n');

    const header = `--- ECC Knowledge (${aug.inject_as}) ---`;
    const footer = '--- End ECC Knowledge ---';

    const parts = [header, aug.prompt_prefix];
    if (contentBlocks) {
      parts.push('', contentBlocks);
    }
    parts.push(footer, '', basePrompt);

    return parts.join('\n');
  } catch {
    return basePrompt;
  }
}

/**
 * Get the ECC Hook environment variables that SP should set.
 *
 * Reads ecc-hook-profile.json and returns the always-disabled hooks
 * as a flat environment variable map.
 *
 * @returns {{ ECC_HOOK_PROFILE: string, ECC_DISABLED_HOOKS: string }}
 */
export function getHookEnvironment() {
  const profile = readAdapterJson('ecc-hook-profile.json');

  const profileName = profile?.profile ?? 'standard';
  const alwaysDisabled = profile?.disabled_hooks?.always ?? [];

  return {
    ECC_HOOK_PROFILE: profileName,
    ECC_DISABLED_HOOKS: alwaysDisabled.join(','),
  };
}

/**
 * Determine additional ECC hooks to disable based on the current SP context.
 *
 * Reads the optional_disable section of ecc-hook-profile.json and matches
 * conditions against the provided context object.
 *
 * Supported conditions:
 *   - "sp_channel_express_or_hotfix" → true when sp_channel is "express" or "hotfix"
 *   - "cwd_in_sp_managed_path"       → true when cwd_in_managed_path is true
 *
 * @param {{ sp_channel: string|null, cwd_in_managed_path: boolean }} context
 * @returns {string[]} Hook IDs to additionally disable
 */
export function getConditionalDisables(context) {
  try {
    const profile = readAdapterJson('ecc-hook-profile.json');
    const optionalDisable = profile?.optional_disable ?? {};

    const conditionMatchers = {
      sp_channel_express_or_hotfix: () =>
        context.sp_channel === 'express' || context.sp_channel === 'hotfix',
      cwd_in_sp_managed_path: () => Boolean(context.cwd_in_managed_path),
    };

    const extras = [];
    for (const [hookId, entry] of Object.entries(optionalDisable)) {
      const matcher = conditionMatchers[entry.condition];
      if (matcher && matcher()) {
        extras.push(hookId);
      }
    }
    return extras;
  } catch {
    return [];
  }
}

/**
 * Build a rules context string suitable for injection into an agent prompt.
 *
 * Lists the .md filenames in each resolved rules directory without reading
 * their contents.
 *
 * @param {string} techStack
 * @param {string} eccPath
 * @returns {string}
 */
export function buildRulesContext(techStack, eccPath) {
  try {
    const { available, techStack: resolvedStack } = resolveRules(techStack, eccPath);

    if (available.length === 0) {
      return '';
    }

    const rulesBase = join(eccPath, 'rules');

    // Map directory names (strip trailing slash) to friendly labels
    const dirLabels = available.map((d) => d.replace(/\/$/, ''));

    const fileLines = [];
    for (const dir of available) {
      const dirName = dir.replace(/\/$/, '');
      const fullDir = join(rulesBase, dirName);
      const mdFiles = listMdFiles(fullDir);
      for (const fname of mdFiles) {
        fileLines.push(`- rules/${dirName}/${fname}`);
      }
    }

    const stackLabel = dirLabels.join(', ');
    const filesSection =
      fileLines.length > 0 ? fileLines.join('\n') : '(no .md files found)';

    return [
      '--- ECC Coding Rules ---',
      `项目技术栈: ${resolvedStack} → 适用规则集: ${stackLabel}`,
      '',
      '可用规则文件:',
      filesSection,
      '',
      '请在编码时遵循上述规则文件中的规范。',
      '--- End ECC Rules ---',
    ].join('\n');
  } catch {
    return '';
  }
}
