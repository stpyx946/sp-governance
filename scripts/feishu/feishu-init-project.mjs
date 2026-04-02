/**
 * 初始化完整的飞书项目空间（文档 + Bitable 任务看板）
 *
 * 使用方式：
 *   node scripts/feishu/feishu-init-project.mjs
 *
 * 输出格式：
 *   {"success": true, "operation": "init_project", "urls": {...}, "project": {...}}
 */

import { createBrowserContext, isLoginValid, wrapFeishuOperation, outputResult } from '../lib/feishu/browser-manager.mjs';
import { FeishuDocPage } from '../lib/feishu/pages/feishu-doc-page.mjs';
import { FeishuBitablePage } from '../lib/feishu/pages/feishu-bitable-page.mjs';
import { findProject, registerProject } from '../lib/feishu/project-registry.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '../..', 'output');

const PROJECT_NAME = '3D模型站项目';
const MEMBERS = ['张三', '李四', '王五'];

// Bitable 字段配置
const BITABLE_FIELDS = [
  { name: '任务名称', type: 'text' },
  { name: '负责人', type: 'text' },
  { name: '状态', type: 'single_select' },
  { name: '开始日期', type: 'date' },
  { name: '截止日期', type: 'date' },
  { name: '优先级', type: 'single_select' },
  { name: '所属阶段', type: 'single_select' },
];

// Bitable 初始任务数据（15 个任务）
const BITABLE_ROWS = [
  { '任务名称': '需求分析', '负责人': '张三', '状态': '进行中', '开始日期': '2026-04-01', '截止日期': '2026-04-10', '优先级': '高', '所属阶段': '策划' },
  { '任务名称': '技术架构设计', '负责人': '王五', '状态': '待开始', '开始日期': '2026-04-11', '截止日期': '2026-04-20', '优先级': '高', '所属阶段': '开发' },
  { '任务名称': '前端框架搭建', '负责人': '李四', '状态': '待开始', '开始日期': '2026-04-21', '截止日期': '2026-04-30', '优先级': '高', '所属阶段': '开发' },
  { '任务名称': '后端框架搭建', '负责人': '王五', '状态': '待开始', '开始日期': '2026-04-21', '截止日期': '2026-04-30', '优先级': '高', '所属阶段': '开发' },
  { '任务名称': '用户系统-前端', '负责人': '李四', '状态': '待开始', '开始日期': '2026-05-05', '截止日期': '2026-05-20', '优先级': '高', '所属阶段': '开发' },
  { '任务名称': '用户系统-后端', '负责人': '王五', '状态': '待开始', '开始日期': '2026-05-05', '截止日期': '2026-05-20', '优先级': '高', '所属阶段': '开发' },
  { '任务名称': '模型管理-前端', '负责人': '李四', '状态': '待开始', '开始日期': '2026-05-21', '截止日期': '2026-06-10', '优先级': '高', '所属阶段': '开发' },
  { '任务名称': '模型管理-后端', '负责人': '王五', '状态': '待开始', '开始日期': '2026-05-21', '截止日期': '2026-06-10', '优先级': '高', '所属阶段': '开发' },
  { '任务名称': '搜索系统', '负责人': '王五', '状态': '待开始', '开始日期': '2026-06-01', '截止日期': '2026-06-15', '优先级': '中', '所属阶段': '开发' },
  { '任务名称': '社区功能-前端', '负责人': '李四', '状态': '待开始', '开始日期': '2026-06-16', '截止日期': '2026-06-30', '优先级': '中', '所属阶段': '开发' },
  { '任务名称': '社区功能-后端', '负责人': '王五', '状态': '待开始', '开始日期': '2026-06-16', '截止日期': '2026-06-30', '优先级': '中', '所属阶段': '开发' },
  { '任务名称': 'VIP体系', '负责人': '张三', '状态': '待开始', '开始日期': '2026-07-01', '截止日期': '2026-07-20', '优先级': '中', '所属阶段': '开发' },
  { '任务名称': '支付集成', '负责人': '王五', '状态': '待开始', '开始日期': '2026-07-01', '截止日期': '2026-07-20', '优先级': '中', '所属阶段': '开发' },
  { '任务名称': '性能测试', '负责人': '李四', '状态': '待开始', '开始日期': '2026-07-21', '截止日期': '2026-07-28', '优先级': '高', '所属阶段': '测试' },
  { '任务名称': '部署上线', '负责人': '王五', '状态': '待开始', '开始日期': '2026-07-29', '截止日期': '2026-07-31', '优先级': '高', '所属阶段': '运维' },
];

/**
 * 读取本地文件内容
 */
function readOutputFile(filename) {
  const filePath = path.join(OUTPUT_DIR, filename);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Warning: Cannot read ${filePath}: ${error.message}`);
    return `# ${filename}\n\n文件读取失败，请手动补充内容。`;
  }
}

/**
 * 生成每周进展模板内容
 */
function generateWeeklyProgressContent() {
  return readOutputFile('3D模型站-每周进展.md');
}

wrapFeishuOperation('init_project', async () => {
  // 幂等检查：已存在则直接返回
  const existingProject = await findProject(PROJECT_NAME);
  if (existingProject) {
    outputResult({
      success: true,
      operation: 'init_project',
      alreadyExists: true,
      urls: existingProject.urls,
      project: existingProject,
    });
    return;
  }

  // 读取本地文件内容
  const overviewContent = readOutputFile('3D模型站-项目概述.md');
  const prdContent = readOutputFile('3D模型站-需求文档.md');
  const archContent = readOutputFile('3D模型站-架构设计.md');
  const scheduleContent = readOutputFile('3D模型站-需求排期.md');
  const teamContent = readOutputFile('3D模型站-人员排期.md');
  const weeklyContent = generateWeeklyProgressContent();

  const { browser, context } = await createBrowserContext({ user: 'default' });

  try {
    // 检查登录态
    const loginPage = await context.newPage();
    if (!(await isLoginValid(loginPage, 'default'))) {
      throw new Error('登录态已过期，请运行: node scripts/feishu/feishu-login.mjs');
    }
    await loginPage.close();

    // 1. 创建项目根文档
    const page1 = await context.newPage();
    const docPage1 = new FeishuDocPage(page1, 'default');
    const rootDoc = await docPage1.withRetry(
      () => docPage1.createDoc(`${PROJECT_NAME} - 项目概述`, overviewContent),
      { maxRetries: 1 }
    );
    await page1.close();

    // 2. 创建"需求文档"子文档
    const page2 = await context.newPage();
    const docPage2 = new FeishuDocPage(page2, 'default');
    const prdDoc = await docPage2.withRetry(
      () => docPage2.createDoc(`${PROJECT_NAME} - 需求文档`, prdContent),
      { maxRetries: 1 }
    );
    await page2.close();

    // 3. 创建"架构设计"子文档
    const page3 = await context.newPage();
    const docPage3 = new FeishuDocPage(page3, 'default');
    const archDoc = await docPage3.withRetry(
      () => docPage3.createDoc(`${PROJECT_NAME} - 架构设计`, archContent),
      { maxRetries: 1 }
    );
    await page3.close();

    // 4. 创建"需求排期"子文档
    const page4 = await context.newPage();
    const docPage4 = new FeishuDocPage(page4, 'default');
    const scheduleDoc = await docPage4.withRetry(
      () => docPage4.createDoc(`${PROJECT_NAME} - 需求排期`, scheduleContent),
      { maxRetries: 1 }
    );
    await page4.close();

    // 5. 创建"人员排期"子文档
    const page5 = await context.newPage();
    const docPage5 = new FeishuDocPage(page5, 'default');
    const teamDoc = await docPage5.withRetry(
      () => docPage5.createDoc(`${PROJECT_NAME} - 人员排期`, teamContent),
      { maxRetries: 1 }
    );
    await page5.close();

    // 6. 创建"每周进展"子文档
    const page6 = await context.newPage();
    const docPage6 = new FeishuDocPage(page6, 'default');
    const weeklyDoc = await docPage6.withRetry(
      () => docPage6.createDoc(`${PROJECT_NAME} - 每周进展`, weeklyContent),
      { maxRetries: 1 }
    );
    await page6.close();

    // 7. 创建任务看板 Bitable
    const page7 = await context.newPage();
    const bitablePage = new FeishuBitablePage(page7, 'default');
    const bitableResult = await bitablePage.withRetry(
      () => bitablePage.createBitable(`${PROJECT_NAME} - 任务看板`, BITABLE_FIELDS, BITABLE_ROWS),
      { maxRetries: 1 }
    );
    await page7.close();

    // 注册项目到 registry
    const registeredProject = await registerProject({
      name: PROJECT_NAME,
      members: MEMBERS,
      urls: {
        rootDoc: rootDoc.url,
        prdDoc: prdDoc.url,
        archDoc: archDoc.url,
        scheduleDoc: scheduleDoc.url,
        teamDoc: teamDoc.url,
        weeklyDoc: weeklyDoc.url,
        bitable: bitableResult.url,
      },
      bitable: {
        tableId: bitableResult.tableId,
        viewId: bitableResult.viewId,
      },
    });

    return {
      urls: {
        rootDoc: rootDoc.url,
        prdDoc: prdDoc.url,
        archDoc: archDoc.url,
        scheduleDoc: scheduleDoc.url,
        teamDoc: teamDoc.url,
        weeklyDoc: weeklyDoc.url,
        bitable: bitableResult.url,
      },
      members: MEMBERS,
      projectId: registeredProject.id,
    };
  } finally {
    await browser.close();
  }
});
