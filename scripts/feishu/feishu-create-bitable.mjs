/**
 * 创建飞书多维表格入口脚本
 *
 * 使用方式：
 *   node scripts/feishu/feishu-create-bitable.mjs --user zhangsan --title "项目跟踪" --data-file "./data.json"
 *   node scripts/feishu/feishu-create-bitable.mjs --user zhangsan --title "项目跟踪" --data '{"fields":[...],"rows":[...]}'
 *
 * 数据格式 (JSON):
 *   {
 *     "fields": [
 *       { "name": "任务名称", "type": "text" },
 *       { "name": "负责人", "type": "text" },
 *       { "name": "状态", "type": "single_select" },
 *       { "name": "截止日期", "type": "date" }
 *     ],
 *     "rows": [
 *       { "任务名称": "开发登录", "负责人": "张三", "状态": "进行中", "截止日期": "2024-03-01" }
 *     ]
 *   }
 */

import { createBrowserContext, isLoginValid, wrapFeishuOperation } from '../lib/feishu/browser-manager.mjs';
import { FeishuBitablePage } from '../lib/feishu/pages/feishu-bitable-page.mjs';
import fs from 'fs/promises';

const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  params[key] = args[i + 1];
}

wrapFeishuOperation('create_bitable', async () => {
  const user = params.user || 'default';
  const title = params.title;

  if (!title) throw new Error('缺少 --title 参数');

  // 获取数据：优先从文件读取
  let data;
  if (params.dataFile) {
    data = JSON.parse(await fs.readFile(params.dataFile, 'utf-8'));
  } else if (params.data) {
    data = JSON.parse(params.data);
  } else {
    throw new Error('缺少 --data-file 或 --data 参数');
  }

  const { fields = [], rows = [] } = data;

  const { browser, context } = await createBrowserContext({ user });

  try {
    const page = await context.newPage();

    if (!(await isLoginValid(page, user))) {
      throw new Error(`登录态已过期，请运行: node scripts/feishu/feishu-login.mjs ${user}`);
    }

    const bitablePage = new FeishuBitablePage(page, user);
    const result = await bitablePage.withRetry(
      () => bitablePage.createBitable(title, fields, rows),
      { maxRetries: 1 }
    );

    return result;
  } finally {
    await browser.close();
  }
});
