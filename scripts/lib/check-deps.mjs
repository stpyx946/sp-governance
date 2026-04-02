import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SP_ROOT = join(__dirname, '..', '..');
const WORKSPACE_ROOT = join(SP_ROOT, '..');

export async function checkDeps(deps) {
  const found = new Map();
  const missing = [];

  let globalRoot;
  try {
    globalRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
  } catch {
    globalRoot = null;
  }

  for (const dep of deps) {
    if (globalRoot && existsSync(join(globalRoot, dep))) {
      found.set(dep, `global: ${join(globalRoot, dep)}`);
      continue;
    }
    const wsPath = join(WORKSPACE_ROOT, 'node_modules', dep);
    if (existsSync(wsPath)) {
      found.set(dep, `workspace: ${wsPath}`);
      continue;
    }
    const localPath = join(SP_ROOT, 'node_modules', dep);
    if (existsSync(localPath)) {
      found.set(dep, `local: ${localPath}`);
      continue;
    }
    missing.push(dep);
  }

  if (missing.length > 0) {
    console.error(`\n缺少依赖: ${missing.join(', ')}\n`);
    console.error('请选择安装方式:');
    console.error(`  全局:      npm i -g ${missing.join(' ')}`);
    console.error(`  Workspace: cd "${WORKSPACE_ROOT}" && npm i ${missing.join(' ')}`);
    console.error(`  本地:      cd "${SP_ROOT}" && npm i\n`);
  }

  return { ok: missing.length === 0, missing, found };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const pkgPath = join(SP_ROOT, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
  const deps = Object.keys(pkg.dependencies || {});
  console.log(`检查依赖: ${deps.join(', ')}`);
  const result = await checkDeps(deps);
  if (result.ok) {
    console.log('所有依赖已就绪');
    for (const [dep, loc] of result.found) console.log(`  ${dep}: ${loc}`);
  }
  process.exit(result.ok ? 0 : 1);
}
