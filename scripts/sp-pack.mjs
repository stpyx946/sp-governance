#!/usr/bin/env node

/**
 * SP Governance — Cross-platform packaging script
 * Generates sp-governance-v{version}.zip
 *
 * Supports: Linux (zip), macOS (zip), Windows (PowerShell Compress-Archive)
 *
 * Usage:
 *   node scripts/sp-pack.mjs
 *   node scripts/sp-pack.mjs --output-dir /path/to/output
 */

import { readFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { platform } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(__dirname, '..');

// Read version from plugin.json
const pluginJsonPath = join(pluginRoot, '.claude-plugin', 'plugin.json');
if (!existsSync(pluginJsonPath)) {
  console.error('[SP Pack] Error: .claude-plugin/plugin.json not found.');
  process.exit(1);
}
const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf-8'));
const version = pluginJson.version;

// Output directory (default: plugin root)
const outputDirIdx = process.argv.indexOf('--output-dir');
const outputDir = outputDirIdx >= 0 && process.argv[outputDirIdx + 1]
  ? resolve(process.argv[outputDirIdx + 1])
  : pluginRoot;

const zipName = `sp-governance-v${version}.zip`;
const zipPath = join(outputDir, zipName);

// Files/directories to include (relative to pluginRoot)
const includes = [
  'CLAUDE.md',
  'INSTALL.md',
  '.claude-plugin/',
  'agents/',
  'docs/',
  'governance/',
  'hooks/',
  'scripts/',
  'templates/',
];

// Verify all included paths exist
const missing = includes.filter(f => !existsSync(join(pluginRoot, f)));
if (missing.length > 0) {
  console.error(`[SP Pack] Error: Missing files/dirs: ${missing.join(', ')}`);
  process.exit(1);
}

/**
 * Detect available zip tool.
 * @returns {'zip'|'powershell'|null}
 */
function findZipTool() {
  // On Linux/macOS, prefer native zip
  if (platform() !== 'win32') {
    try {
      execSync('zip --version', { stdio: 'ignore' });
      return 'zip';
    } catch { /* fall through */ }
  }

  // On Windows (or Linux fallback), try PowerShell
  const pwshCommands = ['pwsh', 'powershell'];
  for (const cmd of pwshCommands) {
    try {
      execSync(`${cmd} -Command "echo ok"`, { stdio: 'ignore' });
      return 'powershell';
    } catch { /* continue */ }
  }

  return null;
}

const zipTool = findZipTool();

// Remove existing zip if present
if (existsSync(zipPath)) {
  unlinkSync(zipPath);
}

if (zipTool === 'zip') {
  // Linux / macOS
  const fileList = includes.join(' ');
  execSync(`zip -r "${zipPath}" ${fileList}`, {
    cwd: pluginRoot,
    stdio: 'inherit',
  });
} else if (zipTool === 'powershell') {
  // Windows (PowerShell)
  const cmd = platform() === 'win32' ? 'powershell' : 'pwsh';
  const paths = includes.map(f => `'${join(pluginRoot, f)}'`).join(', ');
  execSync(
    `${cmd} -Command "Compress-Archive -Path ${paths} -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' }
  );
} else {
  console.error('[SP Pack] Error: No zip tool found. Install "zip" or use PowerShell.');
  process.exit(1);
}

console.log(`[SP Pack] Created: ${zipPath} (v${version})`);
