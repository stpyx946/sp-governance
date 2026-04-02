import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = fileURLToPath(new URL('../../../../auth', import.meta.url));

/**
 * 创建浏览器上下文，复用 storageState 登录态
 */
export async function createBrowserContext(options = {}) {
  const { user = 'default', headed = false } = options;

  const storageStatePath = path.join(AUTH_DIR, user, 'storage-state.json');
  const hasStorageState = await fs.access(storageStatePath).then(() => true).catch(() => false);

  const browser = await chromium.launch({
    headless: !headed,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const contextOptions = {
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    permissions: ['clipboard-read', 'clipboard-write'],
  };

  if (hasStorageState) {
    contextOptions.storageState = storageStatePath;
  }

  const context = await browser.newContext(contextOptions);
  return { browser, context };
}

/**
 * 保存登录态到 storageState
 */
export async function saveStorageState(context, user = 'default') {
  const userDir = path.join(AUTH_DIR, user);
  await fs.mkdir(userDir, { recursive: true });
  const statePath = path.join(userDir, 'storage-state.json');
  await context.storageState({ path: statePath });
  return statePath;
}

/**
 * 从 storageState 中提取飞书租户域名
 * 例如 ccnu3rikxjjp.feishu.cn
 */
export async function getTenantDomain(user = 'default') {
  const storageStatePath = path.join(AUTH_DIR, user, 'storage-state.json');
  try {
    const state = JSON.parse(await fs.readFile(storageStatePath, 'utf-8'));
    // 从 origins 中查找租户域名
    const tenantOrigin = state.origins?.find(o => o.origin.includes('.feishu.cn') && !o.origin.includes('www.') && !o.origin.includes('accounts.'));
    if (tenantOrigin) return new URL(tenantOrigin.origin).hostname;
    // 从 cookies 中查找
    const sessionCookie = state.cookies?.find(c => c.name === 'session' && c.domain === '.feishu.cn');
    if (sessionCookie) {
      // 尝试从其他 cookie 的 domain 获取租户域名
      const tenantCookie = state.cookies?.find(c => c.domain.match(/^\.?[a-z0-9]+\.feishu\.cn$/) && !c.domain.includes('www') && !c.domain.includes('accounts'));
      if (tenantCookie) return tenantCookie.domain.replace(/^\./, '');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 获取飞书基础 URL
 */
export async function getFeishuBaseUrl(user = 'default') {
  const tenant = await getTenantDomain(user);
  return tenant ? `https://${tenant}` : 'https://www.feishu.cn';
}

/**
 * 检查登录态是否有效
 */
export async function isLoginValid(page, user = 'default') {
  try {
    const baseUrl = await getFeishuBaseUrl(user);
    await page.goto(`${baseUrl}/next/workplace/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000);
    const url = page.url();
    if (url.includes('/accounts/') || url.includes('/passport/')) return false;
    const body = await page.evaluate(() => document.body?.innerText?.substring(0, 200) || '');
    if (body.includes('404') || body.includes('page not found')) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * 输出标准 JSON 结果
 */
export function outputResult(data) {
  console.log(JSON.stringify(data));
}

/**
 * 包装飞书操作，统一错误处理和截图
 */
export async function wrapFeishuOperation(name, fn) {
  try {
    const result = await fn();
    outputResult({ success: true, operation: name, ...result });
  } catch (error) {
    const screenshotPath = path.join(__dirname, '..', 'output', `error-${name}-${Date.now()}.png`);
    outputResult({
      success: false,
      operation: name,
      error: error.message,
      screenshot: screenshotPath,
    });
    process.exitCode = 1;
  }
}
