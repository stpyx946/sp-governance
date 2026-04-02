/**
 * 项目注册表模块
 *
 * 管理 config/projects.json 中的项目注册信息，支持项目的查找、注册和更新。
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = fileURLToPath(new URL('../../../../config/projects.json', import.meta.url));

/**
 * 读取注册表
 * @returns {Promise<{projects: Array}>}
 */
export async function loadRegistry() {
  try {
    const content = await fs.readFile(REGISTRY_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // 如果文件不存在，返回空注册表
    if (error.code === 'ENOENT') {
      return { projects: [] };
    }
    throw error;
  }
}

/**
 * 保存注册表
 * @param {Object} registry - 注册表对象
 */
export async function saveRegistry(registry) {
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
}

/**
 * 根据名称查找项目
 * @param {string} name - 项目名称
 * @returns {Promise<Object|null>} 找到返回项目对象，否则返回 null
 */
export async function findProject(name) {
  const registry = await loadRegistry();
  const normalizedName = name.trim().toLowerCase();
  return registry.projects.find(
    p => p.name.trim().toLowerCase() === normalizedName
  ) || null;
}

/**
 * 注册新项目
 * @param {Object} projectInfo - 项目信息
 * @returns {Promise<Object>} 更新后的注册表
 */
export async function registerProject(projectInfo) {
  const registry = await loadRegistry();

  const newProject = {
    id: generateProjectId(projectInfo.name),
    name: projectInfo.name,
    createdAt: new Date().toISOString().split('T')[0],
    lastUpdated: new Date().toISOString().split('T')[0],
    members: projectInfo.members || [],
    urls: projectInfo.urls || {},
    bitable: projectInfo.bitable || {},
  };

  registry.projects.push(newProject);
  await saveRegistry(registry);

  return newProject;
}

/**
 * 更新项目信息
 * @param {string} id - 项目 ID
 * @param {Object} updates - 要更新的字段
 * @returns {Promise<Object|null>} 更新后的项目对象，或 null 如果未找到
 */
export async function updateProject(id, updates) {
  const registry = await loadRegistry();
  const index = registry.projects.findIndex(p => p.id === id);

  if (index === -1) {
    return null;
  }

  // 合并更新
  registry.projects[index] = {
    ...registry.projects[index],
    ...updates,
    lastUpdated: new Date().toISOString().split('T')[0],
  };

  await saveRegistry(registry);
  return registry.projects[index];
}

/**
 * 生成项目 ID（基于名称的 slug）
 * @param {string} name - 项目名称
 * @returns {string}
 */
function generateProjectId(name) {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-${date}`;
}
