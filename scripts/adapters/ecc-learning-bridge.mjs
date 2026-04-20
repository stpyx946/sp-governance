/**
 * ECC Learning Bridge — SP Governance
 *
 * Bridges ECC's continuous learning capability (instincts) into the SP
 * governance workflow. Allows SP to read ECC learning data and inject
 * project-level learned patterns into agent prompts.
 *
 * Learning data paths:
 *   - v2: ~/.claude/homunculus/
 *   - v1: ~/.claude/skills/learned/
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

import { detectECC } from '../lib/integration.mjs';

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const V2_LEARNING_DIR = join(homedir(), '.claude', 'homunculus');
const V1_LEARNING_DIR = join(homedir(), '.claude', 'skills', 'learned');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * List JSON files inside a directory.
 * Returns an empty array if the directory does not exist or is unreadable.
 * @param {string} dir
 * @returns {string[]} Full file paths.
 */
function listJsonFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

/**
 * Attempt to extract instinct entries from a single JSON file.
 * Uses loose parsing: skips the file silently on any format mismatch.
 * @param {string} filePath
 * @returns {Array<{ pattern: string, confidence: number, source: string, learned_at: string }>}
 */
function extractInstinctsFromFile(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    // Tolerate both top-level arrays and objects with an instincts/patterns key.
    const candidates = Array.isArray(data)
      ? data
      : Array.isArray(data?.instincts)
        ? data.instincts
        : Array.isArray(data?.patterns)
          ? data.patterns
          : null;

    if (!candidates) return [];

    const results = [];
    for (const item of candidates) {
      if (!item || typeof item !== 'object') continue;

      const pattern =
        typeof item.pattern === 'string'
          ? item.pattern
          : typeof item.description === 'string'
            ? item.description
            : null;

      if (!pattern) continue;

      const confidence =
        typeof item.confidence === 'number'
          ? item.confidence
          : typeof item.score === 'number'
            ? item.score
            : 0;

      const source =
        typeof item.source === 'string'
          ? item.source
          : typeof item.project === 'string'
            ? item.project
            : filePath;

      const learned_at =
        typeof item.learned_at === 'string'
          ? item.learned_at
          : typeof item.timestamp === 'string'
            ? item.timestamp
            : new Date(0).toISOString();

      results.push({ pattern, confidence, source, learned_at });
    }
    return results;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the path to ECC's continuous learning data directory.
 *
 * ECC v2 stores learning data under ~/.claude/homunculus/.
 * ECC v1 stores it under ~/.claude/skills/learned/.
 * Returns the first version whose directory exists, or version null if neither.
 *
 * @param {string} _eccPath - ECC installation path (unused; kept for API symmetry).
 * @returns {{ version: "v2"|"v1"|null, path: string|null }}
 */
export function getECCLearningPath(_eccPath) {
  if (existsSync(V2_LEARNING_DIR)) {
    return { version: 'v2', path: V2_LEARNING_DIR };
  }
  if (existsSync(V1_LEARNING_DIR)) {
    return { version: 'v1', path: V1_LEARNING_DIR };
  }
  return { version: null, path: null };
}

/**
 * Read ECC-learned instincts (behaviour patterns) from the learning directory.
 *
 * Steps:
 *   1. Scan learningPath for JSON files.
 *   2. Parse each file and extract instinct entries (format-tolerant).
 *   3. Sort by confidence descending.
 *   4. Filter out entries below minConfidence.
 *   5. Truncate to maxItems.
 *
 * @param {string|null} learningPath - Path returned by getECCLearningPath.
 * @param {{ maxItems?: number, minConfidence?: number }} [options]
 * @returns {{
 *   found: boolean,
 *   instincts: Array<{ pattern: string, confidence: number, source: string, learned_at: string }>,
 *   total_available: number
 * }}
 */
export function readInstincts(learningPath, options = {}) {
  const maxItems = options.maxItems ?? 10;
  const minConfidence = options.minConfidence ?? 0.6;

  const empty = { found: false, instincts: [], total_available: 0 };

  if (!learningPath) return empty;

  try {
    const files = listJsonFiles(learningPath);
    if (files.length === 0) return empty;

    const all = [];
    for (const file of files) {
      const entries = extractInstinctsFromFile(file);
      all.push(...entries);
    }

    if (all.length === 0) return empty;

    // Sort descending by confidence.
    all.sort((a, b) => b.confidence - a.confidence);

    const total_available = all.length;
    const filtered = all.filter((e) => e.confidence >= minConfidence);
    const instincts = filtered.slice(0, maxItems);

    return {
      found: instincts.length > 0,
      instincts,
      total_available,
    };
  } catch {
    return empty;
  }
}

/**
 * Read instincts that are associated with a specific project.
 *
 * Filters the full instinct set to entries whose source or pattern
 * contains the projectName string (case-insensitive).
 *
 * @param {string|null} learningPath - Path returned by getECCLearningPath.
 * @param {string} projectName
 * @param {{ maxItems?: number, minConfidence?: number }} [options]
 * @returns {{
 *   found: boolean,
 *   instincts: Array<{ pattern: string, confidence: number, source: string, learned_at: string }>,
 *   total_available: number
 * }}
 */
export function readProjectLearnings(learningPath, projectName, options = {}) {
  const base = readInstincts(learningPath, { ...options, maxItems: undefined });

  if (!base.found || !projectName) return base;

  const lower = projectName.toLowerCase();
  const matching = base.instincts.filter(
    (e) =>
      e.source.toLowerCase().includes(lower) ||
      e.pattern.toLowerCase().includes(lower),
  );

  const maxItems = options.maxItems ?? 10;

  return {
    found: matching.length > 0,
    instincts: matching.slice(0, maxItems),
    total_available: base.total_available,
  };
}

/**
 * Build a learning context string suitable for injection into an agent prompt.
 *
 * If projectName is given, uses readProjectLearnings; otherwise readInstincts.
 * Returns an empty string when no learning data is available.
 *
 * @param {string|null} eccPath - ECC installation path.
 * @param {string|null} [projectName] - Optional project name to scope results.
 * @param {{ maxItems?: number, minConfidence?: number }} [options]
 * @returns {string}
 */
export function buildLearningContext(eccPath, projectName, options = {}) {
  try {
    const { path: learningPath } = getECCLearningPath(eccPath);

    const result = projectName
      ? readProjectLearnings(learningPath, projectName, options)
      : readInstincts(learningPath, options);

    if (!result.found || result.instincts.length === 0) return '';

    const lines = result.instincts.map(
      (e, i) => `${i + 1}. [${e.confidence.toFixed(2)}] ${e.pattern}`,
    );

    return [
      '--- ECC Learned Patterns ---',
      '以下是从历史会话中学习到的模式（按置信度排序）:',
      '',
      ...lines,
      '',
      '请在工作中参考这些已验证的模式。',
      '--- End ECC Patterns ---',
    ].join('\n');
  } catch {
    return '';
  }
}

/**
 * Quick check whether ECC learning data is available.
 *
 * @param {string|null} eccPath - ECC installation path.
 * @returns {{ available: boolean, version: "v2"|"v1"|null, instincts_count: number }}
 */
export function isLearningAvailable(eccPath) {
  try {
    const { version, path: learningPath } = getECCLearningPath(eccPath);

    if (!learningPath) {
      return { available: false, version: null, instincts_count: 0 };
    }

    const { instincts } = readInstincts(learningPath, {
      maxItems: undefined,
      minConfidence: 0,
    });

    return {
      available: instincts.length > 0,
      version,
      instincts_count: instincts.length,
    };
  } catch {
    return { available: false, version: null, instincts_count: 0 };
  }
}
