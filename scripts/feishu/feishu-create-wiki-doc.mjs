#!/usr/bin/env node

/**
 * 在飞书 Wiki 中创建子页面
 *
 * 用法:
 *   node scripts/feishu/feishu-create-wiki-doc.mjs \
 *     --user default \
 *     --parent-url "https://my.feishu.cn/wiki/xxxxx" \
 *     --title "文档标题" \
 *     --content-file "path/to/file.md"
 *
 * 参数:
 *   --user          飞书账户标识 (默认: default)
 *   --parent-url    父 Wiki 页面 URL (必需)
 *   --title         文档标题 (必需)
 *   --content       文档内容 (与 --content-file 二选一)
 *   --content-file  文档内容文件路径
 *   --force         true 跳过去重检查
 */

import fs from 'fs/promises';
import { createBrowserContext, outputResult, wrapFeishuOperation } from '../lib/feishu/browser-manager.mjs';
import { FeishuWikiPage } from '../lib/feishu/pages/feishu-wiki-page.mjs';
import { findExistingDoc, registerDoc } from '../lib/feishu/doc-registry.mjs';

const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  params[key] = args[i + 1];
}

const user = params.user || 'default';
const parentUrl = params.parentUrl;
const title = params.title;
const force = params.force === 'true';

if (!parentUrl) {
  console.error('错误: 缺少 --parent-url 参数');
  process.exit(1);
}
if (!title) {
  console.error('错误: 缺少 --title 参数');
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

if (!force) {
  const existing = await findExistingDoc(title, parentUrl);
  if (existing) {
    console.error(`文档已存在: "${title}"`);
    console.error(`  URL: ${existing.url}`);
    console.error(`  创建时间: ${existing.createdAt}`);
    console.error(`  使用 --force true 强制重新创建`);
    outputResult({ status: 'skipped', reason: 'duplicate', existing });
    process.exit(0);
  }
}

await wrapFeishuOperation('create-wiki-doc', async () => {
  const { browser, context } = await createBrowserContext({ user, headed: true });
  const page = await context.newPage();

  try {
    const wikiPage = new FeishuWikiPage(page);
    const result = await wikiPage.createSubPage(parentUrl, title, content);

    const regResult = await registerDoc({
      title,
      url: result.url,
      parentUrl,
      type: 'wiki',
      sourceFile: params.contentFile || null,
    });

    outputResult({
      status: 'success',
      action: regResult.action,
      title: result.title,
      url: result.url,
      parentUrl,
      docId: regResult.doc.id,
    });
  } finally {
    await context.close();
    await browser.close();
  }
});
