import { createBrowserContext, saveStorageState } from '../lib/feishu/browser-manager.mjs';

/**
 * 飞书登录脚本
 * 导航到需要登录的飞书应用页，用户完成登录后自动检测并保存 session
 */
const user = process.argv[2] || 'default';

console.error(`\n=== 飞书登录 ===`);
console.error(`用户: ${user}`);
console.error('浏览器即将打开飞书工作台，请完成登录...');
console.error('登录成功后脚本会自动检测并保存 session（最多等 5 分钟）\n');

const { browser, context } = await createBrowserContext({ user, headed: true });
const page = await context.newPage();

try {
  // 导航到飞书工作台（需要登录才能访问）
  await page.goto('https://www.feishu.cn/workplace/', { waitUntil: 'domcontentloaded', timeout: 30000 });

  const maxWait = 300000; // 5 分钟
  const start = Date.now();
  let loggedIn = false;

  while (Date.now() - start < maxWait) {
    await page.waitForTimeout(3000);
    const url = page.url();

    // 方法1: 检查 URL 是否已经离开登录页
    const isLoginPage = url.includes('/accounts/') || url.includes('/passport/') || url.includes('/login');
    const isLanding = url === 'https://www.feishu.cn/' || url === 'https://www.feishu.cn';

    // 方法2: 检查 session cookies
    const cookies = await context.cookies();
    const sessionCookies = cookies.filter(c =>
      c.name.includes('session') || c.name.includes('sid_tt') ||
      c.name.includes('uid_tt') || c.name === 'passport_csrf_token'
    );
    const hasSession = sessionCookies.length >= 2;

    console.error(`  [${Math.round((Date.now() - start) / 1000)}s] URL: ${url.substring(0, 60)} | Cookies: ${cookies.length} | Session: ${sessionCookies.length}`);

    // 登录成功的判定：有 session cookies 且不在登录页
    if (hasSession && !isLoginPage) {
      loggedIn = true;
      break;
    }

    // 或者 URL 已经到了飞书应用内
    if (!isLoginPage && !isLanding && url.includes('feishu.cn/')) {
      // 再确认一下有 cookies
      if (cookies.length > 5) {
        loggedIn = true;
        break;
      }
    }
  }

  if (!loggedIn) {
    throw new Error('登录超时（5分钟），请重试');
  }

  // 等待页面稳定
  await page.waitForTimeout(3000);

  // 保存完整的 storageState（cookies + localStorage + sessionStorage）
  const statePath = await saveStorageState(context, user);

  // 打印保存的 session 信息
  const cookies = await context.cookies();
  const sessionInfo = cookies
    .filter(c => c.name.includes('session') || c.name.includes('sid') || c.name.includes('uid'))
    .map(c => ({ name: c.name, domain: c.domain, expires: new Date(c.expires * 1000).toISOString() }));

  console.error(`\n登录成功！`);
  console.error(`Session 已保存到: ${statePath}`);
  console.error(`共保存 ${cookies.length} 个 cookies`);
  console.error(`Session cookies: ${JSON.stringify(sessionInfo, null, 2)}`);
  console.error('下次运行会自动复用此 session，无需重复登录。\n');

  console.log(JSON.stringify({
    success: true,
    user,
    statePath,
    cookieCount: cookies.length,
    sessionCookieCount: sessionInfo.length,
    currentUrl: page.url(),
  }));
} catch (error) {
  console.error(`\n失败: ${error.message}`);
  console.log(JSON.stringify({ success: false, error: error.message }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
