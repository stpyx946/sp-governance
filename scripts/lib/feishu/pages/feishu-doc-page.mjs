import { BasePage } from './base-page.mjs';
import { selectors } from '../selectors.mjs';
import { getFeishuBaseUrl } from '../browser-manager.mjs';

export class FeishuDocPage extends BasePage {
  constructor(page, user = 'default') {
    super(page);
    this.user = user;
  }

  /**
   * 创建新文档并写入内容
   */
  async createDoc(title, markdownContent) {
    // 1. 导航到云文档首页（my.feishu.cn）
    await this.navigateTo('https://my.feishu.cn/drive/home/');
    await this.page.waitForTimeout(3000);

    // 2. 点击主内容区的"新建"卡片（通过唯一子文字定位）
    const newCard = this.page.locator('text=新建文档开始协作').first();
    await newCard.waitFor({ state: 'visible', timeout: 10000 });
    await newCard.click();
    await this.page.waitForTimeout(1000);

    // 3. 选择"文档"
    const docOption = await this.find(selectors.drive.newDocOption, { timeout: 5000 });
    await docOption.click();
    await this.page.waitForTimeout(2000);

    // 4. 关闭引导提示（如有）
    try {
      const dismissBtn = this.page.locator('button:has-text("我知道了")');
      if (await dismissBtn.isVisible({ timeout: 2000 })) {
        await dismissBtn.click();
        await this.page.waitForTimeout(500);
      }
    } catch {}

    // 5. 点击"新建空白文档"模板（会在新标签页打开）
    const newPagePromise = this.page.context().waitForEvent('page', { timeout: 15000 });
    const blankTemplate = this.page.locator('text=新建空白文档').first();
    await blankTemplate.waitFor({ state: 'visible', timeout: 5000 });
    await blankTemplate.click();

    // 6. 切换到新标签页
    const newPage = await newPagePromise;
    await newPage.waitForLoadState('domcontentloaded');
    await newPage.waitForTimeout(3000);
    this.page = newPage;

    // 7. 输入标题
    await this.setTitle(title);

    // 8. 写入内容
    await this.writeContent(markdownContent);

    // 9. 等待保存
    await this.page.waitForTimeout(2000);

    return { url: this.page.url(), title };
  }

  /**
   * 设置文档标题
   */
  async setTitle(title) {
    const titleEl = this.page.locator('.zone-container.text-editor').first();
    try {
      await titleEl.waitFor({ state: 'visible', timeout: 5000 });
      await titleEl.click();
    } catch {
      // Fallback: 使用选择器链
      const el = await this.find(selectors.doc.titleInput, { timeout: 5000 });
      await el.click();
    }
    await this.page.keyboard.type(title, { delay: 30 });
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(500);
  }

  /**
   * 解析 Markdown 为结构化 blocks，然后用飞书原生方式输入
   */
  async writeContent(markdownContent) {
    const blocks = this._parseMarkdown(markdownContent);

    for (const block of blocks) {
      switch (block.type) {
        case 'heading':
          await this._writeHeading(block.level, block.text);
          break;
        case 'paragraph':
          await this._writeParagraph(block.text);
          break;
        case 'bullet-list':
          await this._writeBulletList(block.items);
          break;
        case 'ordered-list':
          await this._writeOrderedList(block.items);
          break;
        case 'table':
          await this._writeTable(block.rows);
          break;
        case 'mermaid':
          await this._writeMermaid(block.code);
          break;
        case 'code':
          await this._writeCodeBlock(block.lang, block.code);
          break;
      }
    }
  }

  /**
   * 解析 Markdown 内容为 block 数组
   */
  _parseMarkdown(content) {
    const lines = content.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // 空行跳过
      if (trimmed === '') { i++; continue; }

      // 代码块（mermaid 或普通代码）
      const codeMatch = trimmed.match(/^```(\w*)/);
      if (codeMatch) {
        const lang = codeMatch[1];
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // 跳过结尾 ```
        if (lang === 'mermaid') {
          blocks.push({ type: 'mermaid', code: codeLines.join('\n') });
        } else {
          blocks.push({ type: 'code', lang, code: codeLines.join('\n') });
        }
        continue;
      }

      // 标题
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
        i++;
        continue;
      }

      // 表格（连续 | 开头的行）
      if (trimmed.startsWith('|')) {
        const tableLines = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }
        blocks.push({ type: 'table', rows: this._parseTable(tableLines) });
        continue;
      }

      // 无序列表（连续 - 或 * 开头的行）
      if (/^[-*]\s+/.test(trimmed)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
          i++;
        }
        blocks.push({ type: 'bullet-list', items });
        continue;
      }

      // 有序列表（连续数字. 开头的行）
      if (/^\d+\.\s+/.test(trimmed)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
          i++;
        }
        blocks.push({ type: 'ordered-list', items });
        continue;
      }

      // 普通段落（收集连续非空行）
      const paraLines = [];
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].trim().match(/^(#{1,6}\s|[-*]\s|\d+\.\s|\||```)/)) {
        paraLines.push(lines[i].trim());
        i++;
      }
      if (paraLines.length) {
        blocks.push({ type: 'paragraph', text: paraLines.join(' ') });
      }
    }

    return blocks;
  }

  /**
   * 解析 Markdown 表格行为结构化数据
   */
  _parseTable(tableLines) {
    const rows = [];
    for (const line of tableLines) {
      const cells = line.split('|').filter(c => c.trim() !== '');
      // 跳过分隔行（全是 - 或 :）
      if (cells.every(c => /^[\s:-]+$/.test(c))) continue;
      rows.push(cells.map(c => c.trim()));
    }
    return rows;
  }

  // ===== 写入方法 =====

  async _writeHeading(level, text) {
    const prefix = '#'.repeat(level) + ' ';
    await this.page.keyboard.type(prefix + text, { delay: 20 });
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(300);
  }

  async _writeParagraph(text) {
    await this.page.keyboard.type(text, { delay: 15 });
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(200);
  }

  async _writeBulletList(items) {
    for (let i = 0; i < items.length; i++) {
      if (i === 0) {
        // 第一项：输入 "- " 触发列表模式
        await this.page.keyboard.type('- ' + items[i], { delay: 15 });
      } else {
        // 后续项：飞书自动延续列表
        await this.page.keyboard.type(items[i], { delay: 15 });
      }
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(150);
    }
    // 多按一次 Enter 退出列表模式
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(200);
  }

  async _writeOrderedList(items) {
    for (let i = 0; i < items.length; i++) {
      if (i === 0) {
        await this.page.keyboard.type('1. ' + items[i], { delay: 15 });
      } else {
        await this.page.keyboard.type(items[i], { delay: 15 });
      }
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(150);
    }
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(200);
  }

  async _writeTable(rows) {
    if (!rows.length) return;

    // 生成 HTML 表格并通过剪贴板粘贴
    const headerRow = rows[0];
    const dataRows = rows.slice(1);

    let html = '<table><thead><tr>';
    for (const cell of headerRow) {
      html += `<th>${this._escapeHtml(cell)}</th>`;
    }
    html += '</tr></thead><tbody>';
    for (const row of dataRows) {
      html += '<tr>';
      for (const cell of row) {
        html += `<td>${this._escapeHtml(cell)}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';

    await this.page.evaluate(async (htmlContent) => {
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const item = new ClipboardItem({ 'text/html': blob });
      await navigator.clipboard.write([item]);
    }, html);
    await this.page.keyboard.press('Control+V');
    await this.page.waitForTimeout(1500);

    // 跳到表格后面继续输入
    await this.page.keyboard.press('ArrowDown');
    await this.page.waitForTimeout(300);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(300);
  }

  async _writeMermaid(code) {
    // 使用 /mermaid 斜杠命令创建 Mermaid 块
    await this.page.keyboard.type('/mermaid', { delay: 100 });
    await this.page.waitForTimeout(1500);

    // 选择"文本绘图"菜单项
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(3000); // iframe 加载需要更长时间

    // Mermaid 编辑器在 iframe 内部
    const mermaidFrame = this.page.frameLocator('iframe[src*="feishupkg"]').last();
    const editor = mermaidFrame.locator('div.content-editable');
    try {
      await editor.waitFor({ state: 'visible', timeout: 5000 });
      await editor.click();
      await this.page.waitForTimeout(500);
    } catch {
      // Fallback：点击 ISV 块区域
      const isvBlock = this.page.locator('.docx-isv-block').last();
      await isvBlock.click();
      await this.page.waitForTimeout(500);
    }

    // 逐行输入 mermaid 代码
    const codeLines = code.split('\n');
    for (let i = 0; i < codeLines.length; i++) {
      await this.page.keyboard.type(codeLines[i], { delay: 10 });
      if (i < codeLines.length - 1) {
        await this.page.keyboard.press('Enter');
      }
    }
    await this.page.waitForTimeout(1500);

    // 退出 Mermaid 编辑器，回到文档正文
    // 键盘 Escape 无法可靠退出 iframe，必须点击主文档元素
    // 1. 点击文档标题区域，强制将焦点从 iframe 移回主文档
    await this.page.locator('.zone-container.text-editor').first().click();
    await this.page.waitForTimeout(500);
    // 2. 滚动到文档底部
    await this.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await this.page.waitForTimeout(500);
    // 3. 点击文档正文底部区域（不是标题），使光标进入正文
    try {
      const rootBlock = this.page.locator('.page-block.root-block').first();
      const box = await rootBlock.boundingBox();
      if (box) {
        await this.page.mouse.click(box.x + box.width / 2, box.y + box.height - 10);
      }
    } catch {}
    await this.page.waitForTimeout(500);
    // 4. Ctrl+End 跳到正文末尾
    await this.page.keyboard.press('Control+End');
    await this.page.waitForTimeout(300);
    // 5. Enter 创建新行
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(1000);
  }

  async _writeCodeBlock(lang, code) {
    // 使用 /code 斜杠命令创建代码块
    await this.page.keyboard.type('/code', { delay: 100 });
    await this.page.waitForTimeout(1500);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(1000);

    // 输入代码
    const codeLines = code.split('\n');
    for (let i = 0; i < codeLines.length; i++) {
      await this.page.keyboard.type(codeLines[i], { delay: 10 });
      if (i < codeLines.length - 1) {
        await this.page.keyboard.press('Enter');
      }
    }
    await this.page.waitForTimeout(500);

    // 退出代码块
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(300);
  }

  _escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * 读取文档内容为 Markdown
   */
  async readDoc(docUrl) {
    await this.navigateTo(docUrl);
    await this.page.waitForTimeout(3000);

    // 滚动加载全部内容
    await this.scrollToBottom();

    // 获取文档正文内容（排除标题、元数据、UI 按钮）
    const { title, html } = await this.page.evaluate(() => {
      const root = document.querySelector('.page-block.root-block');
      if (!root) return { title: '', html: '' };

      const clone = root.cloneNode(true);
      // 移除页面头部（添加图标/封面按钮）
      clone.querySelectorAll('.page-block-header-top').forEach(e => e.remove());
      // 移除作者/修改时间信息
      clone.querySelectorAll('.doc-info-swipe-container').forEach(e => e.remove());
      // 提取标题（第一个 zone-container）
      const titleEl = clone.querySelector('.zone-container.text-editor');
      const title = titleEl ? titleEl.textContent.replace(/[\u200B\u200C\u200D\uFEFF]/g, '').trim() : '';
      if (titleEl) titleEl.remove();

      return { title, html: clone.innerHTML };
    });

    if (!html) {
      throw new Error('无法获取文档内容，编辑器未找到');
    }

    // HTML 转 Markdown
    const TurndownService = (await import('turndown')).default;
    const turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });

    let md = turndown.turndown(html);
    // 清理零宽字符和多余空行
    md = md.replace(/[\u200B\u200C\u200D\uFEFF]/g, '').replace(/\n{3,}/g, '\n\n').trim();
    return { title, markdown: md };
  }
}
