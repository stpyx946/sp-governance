#!/usr/bin/env node

/**
 * 更新飞书 Wiki 页面内容
 *
 * 用法:
 *   node scripts/feishu/feishu-update-wiki-doc.mjs \
 *     --user default \
 *     --wiki-url "https://my.feishu.cn/wiki/xxxxx" \
 *     --title "新标题" \
 *     --content-file "path/to/file.md"
 *
 * 参数:
 *   --user          飞书账户标识 (默认: default)
 *   --wiki-url      Wiki 页面 URL (必需)
 *   --title         新标题 (可选，不传则不修改标题)
 *   --content       新内容 (与 --content-file 二选一)
 *   --content-file  新内容文件路径
 */

import fs from 'fs/promises';
import { createBrowserContext, outputResult, wrapFeishuOperation } from '../lib/feishu/browser-manager.mjs';
import { FeishuWikiPage } from '../lib/feishu/pages/feishu-wiki-page.mjs';

const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  params[key] = args[i + 1];
}

const user = params.user || 'default';
const wikiUrl = params.wikiUrl;
const title = params.title || null;

if (!wikiUrl) {
  console.error('错误: 缺少 --wiki-url 参数');
  process.exit(1);
}

let content = '';
if (params.contentFile) {
  content = await fs.readFile(params.contentFile, 'utf-8');
} else if (params.content) {
  content = params.content;
} else {
  console.error('错误: 缺少 --content 或 --content-file 参数');
  process.exit(1);
}

await wrapFeishuOperation('update-wiki-doc', async () => {
  const { browser, context } = await createBrowserContext({ user, headed: true });
  const page = await context.newPage();

  try {
    const wikiPage = new FeishuWikiPage(page);
    const result = await wikiPage.updateWikiPage(wikiUrl, title, content);
    outputResult({
      status: 'success',
      action: 'updated',
      title: result.title || title,
      url: result.url,
    });
  } finally {
    await context.close();
    await browser.close();
  }
});
