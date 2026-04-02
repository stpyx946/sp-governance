import { createBrowserContext, isLoginValid, wrapFeishuOperation } from '../lib/feishu/browser-manager.mjs';
import { FeishuDocPage } from '../lib/feishu/pages/feishu-doc-page.mjs';

/**
 * 读取飞书文档内容为 Markdown
 *
 * 使用方式：
 *   node scripts/feishu/feishu-read-doc.mjs --user zhangsan --url "https://feishu.cn/docx/xxx"
 */

const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  params[key] = args[i + 1];
}

wrapFeishuOperation('read_doc', async () => {
  const user = params.user || 'default';
  const url = params.url;

  if (!url) throw new Error('缺少 --url 参数');

  const { browser, context } = await createBrowserContext({ user });

  try {
    const page = await context.newPage();

    if (!(await isLoginValid(page))) {
      throw new Error(`登录态已过期，请运行: node scripts/feishu/feishu-login.mjs --user ${user}`);
    }

    const docPage = new FeishuDocPage(page);
    const { title, markdown } = await docPage.readDoc(url);

    return { url, title, contentLength: markdown.length, markdown };
  } finally {
    await browser.close();
  }
});
