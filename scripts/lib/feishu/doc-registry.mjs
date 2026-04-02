/**
 * 飞书文档注册表管理
 * 存储: config/doc-registry.json
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const REGISTRY_PATH = fileURLToPath(new URL('../../../../config/doc-registry.json', import.meta.url));

export async function loadRegistry() {
  try {
    const content = await fs.readFile(REGISTRY_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { version: 1, docs: [] };
    }
    throw error;
  }
}

export async function saveRegistry(registry) {
  const dir = path.dirname(REGISTRY_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
}

export function generateDocId(title) {
  const hash = crypto.createHash('md5').update(title).digest('hex').slice(0, 8);
  return `doc-${hash}`;
}

export async function findExistingDoc(title, parentUrl = null) {
  const registry = await loadRegistry();
  return registry.docs.find(d =>
    d.title === title && d.parentUrl === (parentUrl || null)
  ) || null;
}

export async function registerDoc({ title, url, parentUrl, type, sourceFile }) {
  const registry = await loadRegistry();
  const now = new Date().toISOString();

  const existing = registry.docs.find(d =>
    d.title === title && d.parentUrl === (parentUrl || null)
  );
  if (existing) {
    existing.url = url;
    existing.updatedAt = now;
    existing.sourceFile = sourceFile || existing.sourceFile;
    await saveRegistry(registry);
    return { action: 'updated', doc: existing };
  }

  const doc = {
    id: generateDocId(title),
    title,
    url,
    parentUrl: parentUrl || null,
    type: type || 'doc',
    sourceFile: sourceFile || null,
    createdAt: now,
    updatedAt: now,
  };
  registry.docs.push(doc);
  await saveRegistry(registry);
  return { action: 'created', doc };
}

export async function listDocsByParent(parentUrl) {
  const registry = await loadRegistry();
  return registry.docs.filter(d => d.parentUrl === parentUrl);
}

export async function listAllDocs() {
  const registry = await loadRegistry();
  return registry.docs;
}
