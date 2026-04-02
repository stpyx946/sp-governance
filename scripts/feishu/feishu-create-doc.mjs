import { createBrowserContext, isLoginValid, wrapFeishuOperation } from '../lib/feishu/browser-manager.mjs';
import { FeishuDocPage } from '../lib/feishu/pages/feishu-doc-page.mjs';
import fs from 'fs/promises';

/**
 * 创建飞书文档入口脚本
 *
 * 使用方式：
 *   node scripts/feishu/feishu-create-doc.mjs --user zhangsan --title "PRD文档" --content "# 内容..."
 *   node scripts/feishu/feishu-create-doc.mjs --user zhangsan --title "PRD文档" --content-file "./output/prd.md"
 */

const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  params[key] = args[i + 1];
}

wrapFeishuOperation('create_doc', async () => {
  const user = params.user || 'default';
  const title = params.title;

  if (!title) throw new Error('缺少 --title 参数');

  // 获取内容：优先从文件读取
  let content;
  if (params.contentFile) {
    content = await fs.readFile(params.contentFile, 'utf-8');
  } else if (params.content) {
    content = params.content;
  } else {
    throw new Error('缺少 --content 或 --content-file 参数');
  }

  const { browser, context } = await createBrowserContext({ user });

  try {
    const page = await context.newPage();

    // 检查登录态
    if (!(await isLoginValid(page, user))) {
      throw new Error(`登录态已过期，请运行: node scripts/feishu/feishu-login.mjs ${user}`);
    }

    const docPage = new FeishuDocPage(page, user);
    const result = await docPage.withRetry(
      () => docPage.createDoc(title, content),
      { maxRetries: 1 }
    );

    return result;
  } finally {
    await browser.close();
  }
});
