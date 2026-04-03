/**
 * 飞书 Wiki 页面操作
 * 支持在 Wiki 空间中创建子页面
 */

import { BasePage } from './base-page.mjs';
import { FeishuDocPage } from './feishu-doc-page.mjs';
import { dismissPopups } from '../selectors.mjs';

export class FeishuWikiPage extends BasePage {
  constructor(page) {
    super(page);
    this.docPage = new FeishuDocPage(page);
  }

  /**
   * 从 Wiki URL 中提取 node_token
   */
  _extractNodeToken(url) {
    const match = url.match(/\/wiki\/([A-Za-z0-9]+)/);
    return match ? match[1] : null;
  }

  /**
   * 在指定 Wiki 父页面下创建子页面
   */
  async createSubPage(parentUrl, title, markdownContent) {
    const parentToken = this._extractNodeToken(parentUrl);
    if (!parentToken) {
      throw new Error(`无法从 URL 提取 node_token: ${parentUrl}`);
    }

    // 1. 导航到父页面
    console.log(`导航到父 Wiki 页面: ${parentUrl}`);
    await this.navigateTo(parentUrl);
    await this.page.waitForLoadState('networkidle');
    await dismissPopups(this.page);
    await this.page.waitForTimeout(2000);

    // 2. 获取父页面标题（用于在侧边栏中定位）
    const pageTitle = await this._getPageTitle();
    console.log(`父页面标题: ${pageTitle}`);

    // 3. 触发创建子页面
    console.log('尝试创建子页面...');
    await this._createSubPage(pageTitle);

    // 4. 等待 URL 变化（新子页面有独立 node_token）
    console.log('等待跳转到新子页面...');
    await this._waitForNewPage(parentToken);

    const newUrl = this.page.url();
    console.log(`新子页面: ${newUrl}`);

    await dismissPopups(this.page);
    await this.page.waitForTimeout(1000);

    // 5. 设置标题
    console.log(`设置标题: ${title}`);
    await this.docPage.setTitle(title);

    // 6. 写入内容
    if (markdownContent && markdownContent.trim()) {
      console.log('写入内容...');
      await this.docPage.writeContent(markdownContent);
    }

    // 7. 等待自动保存
    await this.page.waitForTimeout(3000);
    console.log(`子页面创建完成: ${newUrl}`);
    return { url: newUrl, title };
  }

  /**
   * 获取当前 Wiki 页面标题
   */
  async _getPageTitle() {
    const titleEl = this.page.locator('[class*="note-title"] [contenteditable], h1[contenteditable], [class*="wiki-title"]').first();
    try {
      await titleEl.waitFor({ timeout: 5000 });
      return (await titleEl.textContent()).trim();
    } catch {
      // 备选：从顶部栏读取
      const headerTitle = this.page.locator('[class*="header"] [class*="title"]').first();
      return (await headerTitle.textContent()).trim();
    }
  }

  /**
   * 多策略创建子页面
   */
  async _createSubPage(pageTitle) {
    const strategies = [
      { name: 'content-body-create', fn: () => this._strategyContentBodyCreate() },
      { name: 'sidebar-hover', fn: () => this._strategySidebarHover(pageTitle) },
      { name: 'sidebar-rightclick', fn: () => this._strategySidebarRightClick(pageTitle) },
      { name: 'title-bar-create', fn: () => this._strategyTitleBarCreate() },
      { name: 'header-plus', fn: () => this._strategyHeaderPlus() },
    ];

    for (const { name, fn } of strategies) {
      try {
        console.log(`尝试策略: ${name}`);
        await fn();
        console.log(`策略 ${name} 成功`);
        return;
      } catch (e) {
        console.error(`策略 ${name} 失败: ${e.message}`);
      }
    }
    throw new Error('所有创建子页面策略均失败');
  }

  /**
   * 在侧边栏中按标题文本找到节点
   */
  async _findSidebarNode(pageTitle) {
    // 方法1: 精确匹配文本（侧边栏节点通常包含页面标题）
    // 遍历所有匹配项，找到在侧边栏区域的那个
    const allNodes = await this.page.locator(`text="${pageTitle}"`).all();
    for (const node of allNodes) {
      try {
        await node.scrollIntoViewIfNeeded({ timeout: 3000 });
        const box = await node.boundingBox();
        // 侧边栏区域: x < 300, y > 60 (排除顶部标题栏)
        if (box && box.x < 300 && box.y > 60) {
          return node;
        }
      } catch { /* continue */ }
    }

    // 方法2: 模糊匹配（标题可能被截断）
    const shortTitle = pageTitle.slice(0, 10);
    const fuzzyNodes = await this.page.locator(`text="${shortTitle}"`).all();
    for (const node of fuzzyNodes) {
      try {
        await node.scrollIntoViewIfNeeded({ timeout: 3000 });
        const box = await node.boundingBox();
        if (box && box.x < 300 && box.y > 60) {
          return node;
        }
      } catch { /* continue */ }
    }

    // 方法3: 查找当前选中/高亮的侧边栏节点
    const activeNode = this.page.locator('[class*="sidebar"] [class*="active"], [class*="sidebar"] [class*="selected"], [class*="tree-node-selected"], [class*="catalog-selected"]').first();
    try {
      await activeNode.waitFor({ timeout: 3000 });
      await activeNode.scrollIntoViewIfNeeded();
      const box = await activeNode.boundingBox();
      if (box && box.x < 300) {
        return activeNode;
      }
    } catch { /* continue */ }

    throw new Error(`侧边栏中未找到标题为 "${pageTitle}" 的节点`);
  }

  /**
   * 策略1: hover 侧边栏节点 → 点击出现的 "+" 按钮
   */
  async _strategySidebarHover(pageTitle) {
    const node = await this._findSidebarNode(pageTitle);
    const box = await node.boundingBox();
    console.log(`找到侧边栏节点: x=${box.x.toFixed(0)}, y=${box.y.toFixed(0)}`);

    // hover 节点
    await node.hover();
    await this.page.waitForTimeout(800);

    // 查找 hover 后出现的按钮（在节点附近，通常是 "+" 图标）
    // 搜索范围：节点所在行附近的所有按钮
    const y = box.y;
    const buttons = await this.page.locator('button:visible').all();
    for (const btn of buttons) {
      const btnBox = await btn.boundingBox().catch(() => null);
      if (!btnBox) continue;
      // 按钮应在侧边栏区域（x < 300），且与节点在同一行（y 差值 < 20）
      if (btnBox.x < 300 && Math.abs(btnBox.y - y) < 20) {
        const text = await btn.textContent().catch(() => '');
        const cls = await btn.getAttribute('class').catch(() => '');
        console.log(`hover 后发现按钮: text=[${text.trim()}] class=[${(cls || '').slice(0, 60)}] y=${btnBox.y.toFixed(0)}`);
        await btn.click();
        await this.page.waitForTimeout(1000);
        await this._handlePostClick();
        return;
      }
    }

    throw new Error('hover 后未发现可点击的添加按钮');
  }

  /**
   * 策略2: 右键侧边栏节点 → 菜单中选 "新建子页面"
   */
  async _strategySidebarRightClick(pageTitle) {
    const node = await this._findSidebarNode(pageTitle);
    await node.click({ button: 'right' });
    await this.page.waitForTimeout(500);

    // 查找右键菜单中的创建子页面选项
    const menuTexts = ['新建子页面', '添加子页面', '创建子节点', '新建子节点'];
    for (const text of menuTexts) {
      const item = this.page.locator(`text="${text}"`).first();
      try {
        await item.waitFor({ timeout: 2000 });
        if (await item.isVisible()) {
          console.log(`点击右键菜单: ${text}`);
          await item.click();
          await this.page.waitForTimeout(1000);
          await this._handlePostClick();
          return;
        }
      } catch { /* next */ }
    }

    // 关闭右键菜单
    await this.page.keyboard.press('Escape');
    throw new Error('右键菜单中未找到创建子页面选项');
  }

  /**
   * 策略0: 点击内容区域的 "新建子页面列表" 图标按钮
   * Wiki 空白页面会显示: 输入"/"快速插入内容，或点击 📄 新建子页面列表
   */
  async _strategyContentBodyCreate() {
    const texts = ['新建子页面列表', '新建子页面', '新建'];
    for (const text of texts) {
      const els = await this.page.locator(`text="${text}"`).all();
      for (const el of els) {
        try {
          const box = await el.boundingBox().catch(() => null);
          // 确保在内容区域（x > 250）而非侧边栏
          if (box && box.x > 250) {
            console.log(`点击内容区: "${text}" at x=${box.x.toFixed(0)}, y=${box.y.toFixed(0)}`);
            await el.click();
            await this.page.waitForTimeout(1500);
            await this._handlePostClick();
            return;
          }
        } catch { /* next */ }
      }
    }
    throw new Error('内容区域未找到创建入口');
  }

  /**
   * 策略4: 点击页面右上角的全局 "+" 按钮创建子文档
   */
  async _strategyHeaderPlus() {
    const plusBtns = await this.page.locator('button:visible, [role="button"]:visible').all();
    for (const btn of plusBtns) {
      const box = await btn.boundingBox().catch(() => null);
      if (!box) continue;
      const text = await btn.textContent().catch(() => '');
      if (box.y < 60 && box.x > 1200 && text.trim() === '+') {
        console.log(`点击右上角+按钮: x=${box.x.toFixed(0)}, y=${box.y.toFixed(0)}`);
        await btn.click();
        await this.page.waitForTimeout(1000);
        await this._handlePostClick();
        return;
      }
    }
    throw new Error('未找到右上角+按钮');
  }

  /**
   * 策略3: 点击标题栏旁的创建按钮（注意排除全局 "+" 按钮）
   */
  async _strategyTitleBarCreate() {
    // note-title__create 是 Wiki 标题栏旁的创建子页面按钮
    // 但要确保它不是右上角的全局 "+" 按钮（全局按钮 x > 1000）
    const createBtns = await this.page.locator('button[class*="note-title__create"]').all();
    for (const btn of createBtns) {
      const box = await btn.boundingBox().catch(() => null);
      if (!box) continue;
      // 标题栏创建按钮应在内容区域（300 < x < 900），而非右上角
      if (box.x > 300 && box.x < 900 && box.y < 200) {
        console.log(`标题栏创建按钮: x=${box.x.toFixed(0)}, y=${box.y.toFixed(0)}`);
        await btn.click();
        await this.page.waitForTimeout(1000);
        await this._handlePostClick();
        return;
      }
    }
    throw new Error('未找到标题栏创建按钮');
  }

  /**
   * 点击创建后的后续处理：
   * - 可能弹出文档类型选择菜单 → 选"文档"
   * - 可能弹出模板选择 → 选"空白文档"
   * - 可能直接创建新页面（无弹窗）
   */
  async _handlePostClick() {
    // 策略A: 尝试选择"文档"类型（菜单形式）
    const docTypeTexts = ['文档', 'Document'];
    for (const text of docTypeTexts) {
      const el = this.page.locator(`[role="menuitem"]:has-text("${text}"), [class*="menu"] :text-is("${text}"), [class*="popover"] :text-is("${text}")`).first();
      try {
        await el.waitFor({ timeout: 2000 });
        if (await el.isVisible()) {
          console.log(`选择文档类型: ${text}`);
          await el.click();
          await this.page.waitForTimeout(1000);
          return;
        }
      } catch { /* no menu, continue */ }
    }

    // 策略B: 模板选择对话框 → 点击空白文档卡片（通常是第一个带 "+" 图标的卡片）
    const blankTexts = ['空白文档', '空白', '新建空白文档'];
    for (const text of blankTexts) {
      const el = this.page.locator(`text="${text}"`).first();
      try {
        await el.waitFor({ timeout: 2000 });
        if (await el.isVisible()) {
          console.log(`选择模板: ${text}`);
          await el.click();
          await this.page.waitForTimeout(1500);
          return;
        }
      } catch { /* next */ }
    }

    // 策略C: 模板对话框中点击带 "+" 的大卡片（空白文档通常是左上角第一个卡片）
    const plusCard = this.page.locator('[class*="template"] [class*="blank"], [class*="modal"] [class*="create-blank"], [class*="dialog"] svg[class*="add"], [class*="template-card"]:first-child').first();
    try {
      await plusCard.waitFor({ timeout: 2000 });
      if (await plusCard.isVisible()) {
        console.log('点击空白文档卡片');
        await plusCard.click();
        await this.page.waitForTimeout(1500);
        return;
      }
    } catch { /* continue */ }

    console.log('未发现弹窗/菜单，可能已直接创建');
  }

  /**
   * 等待跳转到新页面（URL 中 token 变化）
   */
  async _waitForNewPage(parentToken) {
    try {
      await this.page.waitForURL(
        (url) => {
          const token = this._extractNodeToken(url.toString());
          return token && token !== parentToken;
        },
        { timeout: 15000 }
      );
    } catch {
      // 如果 URL 没变，截图调试
      console.log('URL 未自动变化，当前 URL:', this.page.url());
      try {
        await this.page.screenshot({ path: 'scripts/lib/output/debug-wait-newpage.png' });
      } catch { /* ignore */ }

      // 尝试点击侧边栏或内容区中新出现的未命名文档节点
      console.log('尝试点击新创建的未命名文档...');
      const untitledTexts = ['无标题', '未命名文档', '未命名', 'Untitled'];
      for (const text of untitledTexts) {
        try {
          const nodes = await this.page.locator(`text="${text}"`).all();
          for (const node of nodes) {
            await node.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
            const box = await node.boundingBox().catch(() => null);
            if (box) {
              console.log(`找到"${text}"节点: x=${box.x.toFixed(0)}, y=${box.y.toFixed(0)}`);
              await node.click();
              await this.page.waitForTimeout(3000);
              // 检查 URL 是否已变化
              const newToken = this._extractNodeToken(this.page.url());
              if (newToken && newToken !== parentToken) {
                return; // 成功导航到新页面
              }
            }
          }
        } catch { /* ignore */ }
      }

      const currentToken = this._extractNodeToken(this.page.url());
      if (!currentToken || currentToken === parentToken) {
        throw new Error('创建子页面后 URL 未变化，可能创建失败');
      }
    }
  }

  /**
   * 更新已有 Wiki 页面的内容
   * @param {string} wikiUrl - Wiki 页面 URL
   * @param {string} title - 新标题（可选，null 则不修改）
   * @param {string} markdownContent - 新的 Markdown 内容
   */
  async updateWikiPage(wikiUrl, title, markdownContent) {
    console.log(`导航到 Wiki 页面: ${wikiUrl}`);
    await this.navigateTo(wikiUrl);
    await this.page.waitForLoadState('networkidle');
    await dismissPopups(this.page);
    await this.page.waitForTimeout(2000);

    // 先清空正文并写入新内容（避免焦点冲突）
    if (markdownContent && markdownContent.trim()) {
      console.log('清空并写入新内容...');
      await this.docPage.clearAndWriteContent(markdownContent);
    }

    // 最后设置标题
    if (title) {
      console.log(`更新标题: ${title}`);
      await this.docPage.setTitle(title);
    }

    await this.page.waitForTimeout(3000);
    console.log(`页面更新完成: ${wikiUrl}`);
    return { url: wikiUrl, title };
  }

  /**
   * 读取 Wiki 页面内容
   */
  async readWikiPage(wikiUrl) {
    return await this.docPage.readDoc(wikiUrl);
  }
}
