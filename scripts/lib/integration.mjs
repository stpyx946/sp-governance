import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { findPortfolioRoot } from './portfolio.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const OMC_SEARCH_PATHS = [
  join(homedir(), '.claude', 'plugins', 'oh-my-claudecode'),
  join(homedir(), '.claude', 'plugins', 'cache', 'oh-my-claudecode'),
  join(homedir(), '.claude', 'plugins', 'cache', 'omc'),
];

const ECC_SEARCH_PATHS = [
  join(homedir(), '.claude', 'plugins', 'everything-claude-code'),
  join(homedir(), '.claude', 'plugins', 'ecc'),
  join(homedir(), '.claude', 'plugins', 'cache', 'everything-claude-code'),
];

/**
 * Resolve the actual plugin directory inside a cache or plugin path.
 * Claude Code plugin cache uses: cache/{marketplace}/{pluginName}/{version}/
 * If the path itself contains package.json/VERSION, returns it directly.
 * Otherwise checks installed_plugins.json, then walks the nested structure.
 * @param {string} pluginPath
 * @returns {string|null} Resolved path containing package.json or VERSION, or null.
 */
function resolveCachePath(pluginPath) {
  try {
    if (!existsSync(pluginPath)) return null;
    // Direct hit — version files at this level
    if (existsSync(join(pluginPath, 'package.json')) || existsSync(join(pluginPath, 'VERSION'))) {
      return pluginPath;
    }
    // Authoritative source: installed_plugins.json tracks exact install paths
    const installedPath = join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
    if (existsSync(installedPath)) {
      const installed = JSON.parse(readFileSync(installedPath, 'utf8'));
      const plugins = installed?.plugins ?? {};
      for (const [, entries] of Object.entries(plugins)) {
        for (const entry of Array.isArray(entries) ? entries : [entries]) {
          if (entry.installPath && entry.installPath.startsWith(pluginPath) && existsSync(entry.installPath)) {
            return entry.installPath;
          }
        }
      }
    }
    // Fallback: walk cache/{name}/{version}/ (max 2 levels deep)
    for (const sub of readdirSync(pluginPath)) {
      const subPath = join(pluginPath, sub);
      if (!statSync(subPath).isDirectory()) continue;
      if (existsSync(join(subPath, 'package.json')) || existsSync(join(subPath, 'VERSION'))) {
        return subPath;
      }
      for (const ver of readdirSync(subPath)) {
        const verPath = join(subPath, ver);
        if (!statSync(verPath).isDirectory()) continue;
        if (existsSync(join(verPath, 'package.json')) || existsSync(join(verPath, 'VERSION'))) {
          return verPath;
        }
      }
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * Read and parse the integration state file.
 * @param {string} workspaceRoot
 * @returns {object|null} Parsed state object, or null if file does not exist.
 */
export function findIntegrationState(workspaceRoot) {
  const statePath = join(workspaceRoot, '.sp', 'integration.json');
  try {
    if (!existsSync(statePath)) return null;
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Read SP Governance's own version from package.json.
 * @returns {string} Semver string, defaults to '0.0.0' on failure.
 */
function readSPVersion() {
  try {
    const pkgPath = join(__dirname, '..', '..', 'package.json');
    if (existsSync(pkgPath)) {
      const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));
      return version ?? '0.0.0';
    }
  } catch { /* fall through */ }
  return '0.0.0';
}

/**
 * Write integration state to {workspaceRoot}/.sp/integration.json.
 * Creates the .sp/ directory if it does not exist.
 * Validates that portfolio.json exists in workspaceRoot before writing (M1 safety).
 * @param {string} workspaceRoot
 * @param {object} state
 * @returns {{ ok: boolean, error?: string }}
 */
export function writeIntegrationState(workspaceRoot, state) {
  try {
    if (!existsSync(join(workspaceRoot, 'portfolio.json'))) {
      return { ok: false, error: 'portfolio.json not found in workspaceRoot' };
    }
    const spDir = join(workspaceRoot, '.sp');
    mkdirSync(spDir, { recursive: true });
    writeFileSync(
      join(spDir, 'integration.json'),
      JSON.stringify(state, null, 2),
      'utf8',
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Read a version string from a plugin directory.
 * Tries VERSION file first, then package.json#version.
 * @param {string} pluginPath
 * @returns {string|null}
 */
function readVersion(pluginPath) {
  try {
    const versionFile = join(pluginPath, 'VERSION');
    if (existsSync(versionFile)) {
      return readFileSync(versionFile, 'utf8').trim() || null;
    }
  } catch {
    // fall through
  }
  try {
    const pkg = join(pluginPath, 'package.json');
    if (existsSync(pkg)) {
      const { version } = JSON.parse(readFileSync(pkg, 'utf8'));
      return version ?? null;
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * Detect a plugin from a list of search paths.
 * Uses resolveCachePath to handle nested cache directory structures.
 * @param {string[]} searchPaths
 * @returns {{ found: boolean, version: string|null, path: string|null }}
 */
function detectPlugin(searchPaths) {
  for (const candidate of searchPaths) {
    try {
      const resolved = resolveCachePath(candidate);
      if (resolved) {
        const version = readVersion(resolved);
        return { found: true, version, path: resolved };
      }
    } catch {
      // continue to next candidate
    }
  }
  return { found: false, version: null, path: null };
}

/**
 * Detect OMC installation from known search paths.
 * @returns {{ found: boolean, version: string|null, path: string|null }}
 */
export function detectOMC() {
  return detectPlugin(OMC_SEARCH_PATHS);
}

/**
 * Detect ECC installation from known search paths.
 * @returns {{ found: boolean, version: string|null, path: string|null }}
 */
export function detectECC() {
  return detectPlugin(ECC_SEARCH_PATHS);
}

/**
 * Parse a semver string into numeric parts [major, minor, patch].
 * Non-numeric segments are treated as 0.
 * @param {string} version
 * @returns {[number, number, number]}
 */
function parseSemver(version) {
  const parts = String(version ?? '0.0.0')
    .replace(/^[^0-9]*/, '') // strip leading non-numeric (e.g. "v")
    .split('.')
    .map((p) => parseInt(p, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/**
 * Compare two semver strings.
 * @param {string} a
 * @param {string} b
 * @returns {number} negative if a < b, 0 if equal, positive if a > b
 */
function compareSemver(a, b) {
  const [aMaj, aMin, aPat] = parseSemver(a);
  const [bMaj, bMin, bPat] = parseSemver(b);
  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  return aPat - bPat;
}

/**
 * Check whether a detected version meets the minimum required version.
 * @param {{ found: boolean, version: string|null }} detected - Detection result.
 * @param {string} minVersion - Minimum compatible semver string.
 * @returns {"compatible"|"incompatible"|"unknown"}
 */
export function checkCompatibility(detected, minVersion) {
  if (!detected?.found) return 'unknown';
  if (!detected.version) return 'unknown';
  return compareSemver(detected.version, minVersion) >= 0 ? 'compatible' : 'incompatible';
}

/**
 * Determine runtime mode from OMC and ECC detection results.
 * @param {{ found: boolean }} omcDetected
 * @param {{ found: boolean }} eccDetected
 * @returns {"full"|"sp-omc"|"sp-ecc"|"sp-only"}
 */
export function determineRuntimeMode(omcDetected, eccDetected) {
  if (omcDetected.found && eccDetected.found) return 'full';
  if (omcDetected.found) return 'sp-omc';
  if (eccDetected.found) return 'sp-ecc';
  return 'sp-only';
}

/**
 * Perform a full integration state refresh:
 * detect both plugins, check compatibility, determine runtime mode,
 * write and return the resulting state object.
 *
 * Output conforms to integration-schema.json.
 *
 * @param {string} workspaceRoot
 * @returns {object} The refreshed integration state.
 */
export function refreshIntegrationState(workspaceRoot) {
  const omc = detectOMC();
  const ecc = detectECC();

  const omcCompat = checkCompatibility(omc, '1.0.0');
  const eccCompat = checkCompatibility(ecc, '1.8.0');

  const runtimeMode = determineRuntimeMode(omc, ecc);

  // Preserve install_date from existing state if available
  const existing = findIntegrationState(workspaceRoot);
  const installDate = existing?.install_date || new Date().toISOString();

  const state = {
    sp_version: readSPVersion(),
    install_date: installDate,
    runtime_mode: runtimeMode,
    last_compat_check: new Date().toISOString(),
    integrations: {
      omc: {
        detected: omc.found,
        version: omc.version,
        path: omc.path,
        compatibility: omcCompat,
      },
      ecc: {
        detected: ecc.found,
        version: ecc.version,
        path: ecc.path,
        compatibility: eccCompat,
      },
    },
  };

  writeIntegrationState(workspaceRoot, state);

  return state;
}
