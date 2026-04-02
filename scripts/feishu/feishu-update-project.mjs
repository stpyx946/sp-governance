/**
 * 更新飞书项目信息
 *
 * 使用方式：
 *   node scripts/feishu/feishu-update-project.mjs --project "3D模型站" --milestones '[{"name":"需求确认","date":"2026-04-07"}]'
 *   node scripts/feishu/feishu-update-project.mjs --project "3D模型站" --add-task '{"name":"新任务","owner":"张三"}'
 *   node scripts/feishu/feishu-update-project.mjs --project "3D模型站" --update-field '{"field":"members","value":["张三","李四"]}'
 *
 * 输出格式：
 *   {"success": true, "operation": "update_project", "project": {...}}
 */

import { findProject, updateProject } from '../lib/feishu/project-registry.mjs';
import { outputResult } from '../lib/feishu/browser-manager.mjs';

const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  params[key] = args[i + 1];
}

async function main() {
  const projectName = params.project;

  if (!projectName) {
    outputResult({
      success: false,
      operation: 'update_project',
      error: '缺少 --project 参数',
    });
    return;
  }

  // 查找项目
  const project = await findProject(projectName);

  if (!project) {
    outputResult({
      success: false,
      operation: 'update_project',
      error: `Project not found: ${projectName}. Run feishu-create-project-board.mjs first.`,
    });
    return;
  }

  const updates = {};

  // 处理 milestones
  if (params.milestones) {
    try {
      updates.milestones = JSON.parse(params.milestones);
    } catch (e) {
      outputResult({
        success: false,
        operation: 'update_project',
        error: `Invalid milestones JSON: ${e.message}`,
      });
      return;
    }
  }

  // 处理 add-task
  if (params.addTask) {
    try {
      const newTask = JSON.parse(params.addTask);
      updates.tasks = [...(project.tasks || []), newTask];
    } catch (e) {
      outputResult({
        success: false,
        operation: 'update_project',
        error: `Invalid add-task JSON: ${e.message}`,
      });
      return;
    }
  }

  // 处理 update-field（通用字段更新）
  if (params.updateField) {
    try {
      const { field, value } = JSON.parse(params.updateField);
      updates[field] = value;
    } catch (e) {
      outputResult({
        success: false,
        operation: 'update_project',
        error: `Invalid update-field JSON: ${e.message}`,
      });
      return;
    }
  }

  // 如果没有提供任何更新操作
  if (Object.keys(updates).length === 0) {
    outputResult({
      success: false,
      operation: 'update_project',
      error: 'No updates provided. Use --milestones, --add-task, or --update-field.',
    });
    return;
  }

  // 执行更新
  const updatedProject = await updateProject(project.id, updates);

  outputResult({
    success: true,
    operation: 'update_project',
    project: updatedProject,
  });
}

main();
