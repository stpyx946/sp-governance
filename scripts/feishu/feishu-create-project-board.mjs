/**
 * 创建飞书项目空间（知识库+文档+Bitable看板）
 *
 * 使用方式：
 *   node scripts/feishu/feishu-create-project-board.mjs --title "3D模型站项目" --members "张三,李四,王五"
 *   node scripts/feishu/feishu-create-project-board.mjs --title "3D模型站项目" --members "张三,李四,王五" --user zhangsan
 *
 * 输出格式：
 *   {"success": true, "operation": "create_project_board", "url": "项目URL", "bitable_url": "Bitable URL", "title": "项目名"}
 */

import { createBrowserContext, isLoginValid, wrapFeishuOperation, outputResult } from '../lib/feishu/browser-manager.mjs';
import { FeishuDocPage } from '../lib/feishu/pages/feishu-doc-page.mjs';
import { FeishuBitablePage } from '../lib/feishu/pages/feishu-bitable-page.mjs';
import { findProject, registerProject } from '../lib/feishu/project-registry.mjs';

const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  params[key] = args[i + 1];
}

wrapFeishuOperation('create_project_board', async () => {
  const user = params.user || 'default';
  const title = params.title;

  if (!title) throw new Error('缺少 --title 参数');

  // 幂等检查：已存在则直接返回
  const existingProject = await findProject(title);
  if (existingProject) {
    outputResult({
      success: true,
      operation: 'create_project_board',
      alreadyExists: true,
      url: existingProject.urls.rootDoc,
      bitable_url: existingProject.urls.bitable,
      project: existingProject,
    });
    return;
  }

  // 解析成员列表
  const members = params.members ? params.members.split(',').map(m => m.trim()) : [];

  // 项目概述文档内容
  const overviewContent = `# ${title}

## 项目背景
TODO: 填写项目背景

## 项目目标
TODO: 填写项目目标

## 团队介绍
${members.length > 0 ? members.map(m => `- ${m}`).join('\n') : 'TODO: 补充团队成员'}

## 项目周期
- 开始日期：TODO
- 预计结束日期：TODO
`;

  // 需求文档内容
  const prdContent = `# ${title} - 需求文档

## 一、概述
TODO: 填写产品概述

## 二、用户群体
TODO: 填写目标用户

## 三、功能需求

### 3.1 核心功能
TODO: 列出核心功能

### 3.2 辅助功能
TODO: 列出辅助功能

## 四、非功能需求
- 性能要求：TODO
- 安全要求：TODO
- 兼容性：TODO

## 五、验收标准
TODO: 填写验收标准
`;

  // 每周进展内容
  const weeklyContent = `# ${title} - 每周进展

## 当前周期
TODO: 填写当前周期

## 本周进展
| 日期 | 任务 | 负责人 | 状态 | 说明 |
|------|------|--------|------|------|
| - | - | - | - | - |

## 下周计划
- [ ]

## 风险与问题
TODO: 记录风险和问题
`;

  // Bitable 字段配置
  const bitableFields = [
    { name: '任务名称', type: 'text' },
    { name: '负责人', type: 'text' },
    { name: '状态', type: 'single_select' },
    { name: '开始日期', type: 'date' },
    { name: '截止日期', type: 'date' },
    { name: '优先级', type: 'single_select' },
    { name: '所属阶段', type: 'single_select' },
  ];

  // 初始任务数据
  const bitableRows = [
    { '任务名称': '需求分析', '负责人': members[0] || '张三', '状态': '待开始', '开始日期': '', '截止日期': '', '优先级': '高', '所属阶段': '策划' },
    { '任务名称': '原型设计', '负责人': members[1] || '李四', '状态': '待开始', '开始日期': '', '截止日期': '', '优先级': '高', '所属阶段': '设计' },
    { '任务名称': 'UI设计', '负责人': members[2] || '王五', '状态': '待开始', '开始日期': '', '截止日期': '', '优先级': '中', '所属阶段': '设计' },
    { '任务名称': '前端开发', '负责人': members[0] || '张三', '状态': '待开始', '开始日期': '', '截止日期': '', '优先级': '高', '所属阶段': '开发' },
    { '任务名称': '后端开发', '负责人': members[1] || '李四', '状态': '待开始', '开始日期': '', '截止日期': '', '优先级': '高', '所属阶段': '开发' },
  ];

  const { browser, context } = await createBrowserContext({ user });

  try {
    // 检查登录态
    const loginPage = await context.newPage();
    if (!(await isLoginValid(loginPage, user))) {
      throw new Error(`登录态已过期，请运行: node scripts/feishu/feishu-login.mjs ${user}`);
    }
    await loginPage.close();

    // 1. 创建项目根文档
    const page1 = await context.newPage();
    const docPage1 = new FeishuDocPage(page1, user);
    const rootDoc = await docPage1.withRetry(
      () => docPage1.createDoc(title, overviewContent),
      { maxRetries: 1 }
    );
    await page1.close();

    // 2. 创建"需求文档.md"子文档
    const page2 = await context.newPage();
    const docPage2 = new FeishuDocPage(page2, user);
    const prdDoc = await docPage2.withRetry(
      () => docPage2.createDoc(`${title} - 需求文档`, prdContent),
      { maxRetries: 1 }
    );
    await page2.close();

    // 3. 创建"每周进展.md"子文档
    const page3 = await context.newPage();
    const docPage3 = new FeishuDocPage(page3, user);
    const weeklyDoc = await docPage3.withRetry(
      () => docPage3.createDoc(`${title} - 每周进展`, weeklyContent),
      { maxRetries: 1 }
    );
    await page3.close();

    // 4. 创建任务看板 Bitable
    const page4 = await context.newPage();
    const bitablePage = new FeishuBitablePage(page4, user);
    const bitableResult = await bitablePage.withRetry(
      () => bitablePage.createBitable(`${title} - 任务看板`, bitableFields, bitableRows),
      { maxRetries: 1 }
    );
    await page4.close();

    // 注册项目到 registry
    const registeredProject = await registerProject({
      name: title,
      members,
      urls: {
        rootDoc: rootDoc.url,
        prdDoc: prdDoc.url,
        weeklyDoc: weeklyDoc.url,
        bitable: bitableResult.url,
      },
      bitable: {
        tableId: bitableResult.tableId,
        viewId: bitableResult.viewId,
      },
    });

    return {
      url: rootDoc.url,
      prd_url: prdDoc.url,
      weekly_url: weeklyDoc.url,
      bitable_url: bitableResult.url,
      title,
      members,
      projectId: registeredProject.id,
    };
  } finally {
    await browser.close();
  }
});
