import { BasePage } from './base-page.mjs';
import { selectors, dismissPopups } from '../selectors.mjs';

/**
 * 飞书多维表格字段类型映射
 * key: 代码中使用的类型名 → value: 飞书 UI 中显示的中文名
 */
const FIELD_TYPE_LABELS = {
  text: '文本',
  number: '数字',
  single_select: '单选',
  multi_select: '多选',
  date: '日期',
  person: '人员',
  checkbox: '复选框',
  url: '超链接',
  phone: '电话号码',
  email: '邮箱',
  link: '关联',
};

/** 需要通过下拉选择的字段类型（输入后按 Enter 确认/创建选项） */
const SELECT_TYPES = new Set(['single_select', 'multi_select']);

export class FeishuBitablePage extends BasePage {
  constructor(page, user = 'default') {
    super(page);
    this.user = user;
  }

  // ===================================================================
  //  公共 API
  // ===================================================================

  /**
   * 打开已有多维表格
   * @param {string} url - 多维表格 URL（需含 table= 参数）
   * @returns {{ url: string }}
   */
  async openBitable(url) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this._waitForBitableReady();
    await this._dismissGuides();
    return { url: this.page.url() };
  }

  /**
   * 从云空间创建新的多维表格
   * @param {string} title - 表格标题
   * @param {Array} fields - 字段定义 [{ name, type }]
   * @param {Array} rows - 数据行 [{ fieldName: value }]
   * @returns {{ url: string, title: string }}
   */
  async createBitable(title, fields = [], rows = []) {
    await this.navigateTo('https://my.feishu.cn/drive/home/');
    await this.page.waitForTimeout(3000);

    // 点击"新建文档开始协作"
    const newCard = this.page.locator('text=新建文档开始协作').first();
    await newCard.waitFor({ state: 'visible', timeout: 10000 });
    await newCard.click();
    await this.page.waitForTimeout(1000);

    // 选择"多维表格" — 可能在当前页面导航，也可能打开新标签页
    const newPagePromise = this.page.context().waitForEvent('page', { timeout: 10000 }).catch(() => null);
    const bitableOption = await this.find(selectors.bitable.newBitableOption, { timeout: 5000 });
    await bitableOption.click();
    await this.page.waitForTimeout(3000);

    // 检查是否打开了新标签页
    const newPage = await newPagePromise;
    if (newPage) {
      console.log('  Bitable opened in new tab');
      await newPage.waitForLoadState('domcontentloaded');
      this.page = newPage;
      await this.page.waitForTimeout(3000);
    }

    // 检查当前 URL 是否已经包含 table=（直接创建了空白表格）
    if (this.page.url().includes('table=')) {
      console.log('  Bitable created directly (URL has table=)');
    } else {
      // 需要选择空白模板
      console.log('  Looking for blank template...');
      await this._clickBlankTemplate();

      // 再次检查新标签页
      const templateNewPage = await this.page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null);
      if (templateNewPage) {
        console.log('  Template opened in new tab');
        await templateNewPage.waitForLoadState('domcontentloaded');
        this.page = templateNewPage;
        await this.page.waitForTimeout(3000);
      }
    }

    // 等待 bitable 加载
    await this._waitForBitableReady();
    await this._dismissGuides();

    // 设置标题
    if (title) await this.setTitle(title);

    // 配置字段
    if (fields.length > 0) await this.setupFields(fields);

    // 填充数据
    if (rows.length > 0) await this.fillRows(fields, rows);

    await this.page.waitForTimeout(2000);
    const finalUrl = this.page.url();
    const tableId = new URL(finalUrl).searchParams.get('table') || '';
    const viewId = new URL(finalUrl).searchParams.get('view') || '';
    return { url: finalUrl, title, tableId, viewId };
  }

  /**
   * 设置多维表格标题
   * 通过双击 breadcrumb 进入编辑模式，然后键盘输入
   */
  async setTitle(title) {
    await this.page.waitForTimeout(1000);

    console.log('  setTitle: looking for breadcrumb element...');
    // 找到 breadcrumb 中的标题元素并双击进入编辑
    const titlePos = await this.page.evaluate(() => {
      // 精确定位: breadcrumb-editable-title 中的 breadcrumb-container-item__value
      const el = document.querySelector('.breadcrumb-editable-title .breadcrumb-container-item__value');
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      // 兜底：查找包含 "未命名" 的 breadcrumb 项
      for (const item of document.querySelectorAll('.breadcrumb-container-item__value')) {
        const text = (item.textContent || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        if (text && (text.includes('未命名') || text.includes('多维表格'))) {
          const r = item.getBoundingClientRect();
          if (r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
      return null;
    });

    if (!titlePos) {
      console.log('  Warning: Could not find title element');
      return;
    }

    console.log('  setTitle: found title at', titlePos);

    // 单击触发编辑模式（双击不会创建input，单击会）
    await this.page.mouse.click(titlePos.x, titlePos.y);
    await this.page.waitForTimeout(1200);

    // 查找并填写出现的 input（放宽条件并增加调试信息）
    const inputFound = await this.page.evaluate(() => {
      const results = [];
      for (const inp of document.querySelectorAll('input')) {
        const r = inp.getBoundingClientRect();
        if (r.width > 30 && r.y < 80 && inp.offsetParent !== null) {
          results.push({
            x: Math.round(r.x + r.width / 2),
            y: Math.round(r.y + r.height / 2),
            width: Math.round(r.width),
            height: Math.round(r.height),
            top: Math.round(r.y),
            className: inp.className || '',
            value: inp.value || '',
            placeholder: inp.placeholder || ''
          });
        }
      }
      // 返回第一个找到的 input，并返回调试信息
      return results.length > 0 ? { target: results[0], all: results } : null;
    });

    if (inputFound) {
      console.log('  setTitle: found input at', inputFound.target);
      console.log('  setTitle: all inputs found:', inputFound.all);
      await this.page.mouse.click(inputFound.target.x, inputFound.target.y);
      await this.page.waitForTimeout(200);
      await this.page.keyboard.press('Control+a');
      await this.page.waitForTimeout(100);
      await this.page.keyboard.type(title, { delay: 20 });
      await this.page.waitForTimeout(300);
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(1000);
      console.log(`  Title set to: "${title}"`);
    } else {
      console.log('  setTitle: no input found, trying direct keyboard input');
      // 没有 input 出现，尝试直接键盘输入（某些模式下双击后直接可编辑）
      await this.page.keyboard.press('Control+a');
      await this.page.waitForTimeout(200);
      await this.page.keyboard.type(title, { delay: 20 });
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * 配置字段（添加缺失字段、重命名已有字段）
   * 策略：通过工具栏 "字段配置" 打开面板 → 面板中操作
   * @param {Array} fields - [{ name, type }]
   */
  async setupFields(fields) {
    if (fields.length === 0) return;

    // 标准化字段类型：中文 → 英文 key
    fields = fields.map(f => ({
      ...f,
      type: f.type === '关联' ? 'link' : f.type,
    }));

    await this._closeAIOverlays();
    await this._dismissGuides();
    await this.page.waitForTimeout(1000);

    // 先关闭 bitable sidebar，否则点击 "字段配置" 可能打开搜索面板
    await this._closeBitableSidebar();

    // 打开字段配置面板
    await this._openFieldPanel();
    await this.page.waitForTimeout(1000);

    // 从面板中读取已有字段
    const existingFields = await this._getFieldNamesFromPanel();
    console.log('  Existing fields from panel:', existingFields);

    // 重命名第一个默认字段（如果存在且名称不同）
    if (existingFields.length > 0 && existingFields[0] !== fields[0].name) {
      console.log(`  Renaming first field: "${existingFields[0]}" → "${fields[0].name}"`);
      await this._renameFieldViaEditMenu(0, fields[0].name, fields[0].type);
    }

    // 通过面板 "新增字段" 按钮添加新字段
    for (let i = existingFields.length; i < fields.length; i++) {
      console.log(`  Adding field: "${fields[i].name}" (${fields[i].type})`);
      await this._addFieldViaPanel(fields[i].name, fields[i].type, fields[i].linkedTable);
    }

    // 关闭字段配置面板
    await this._closeFieldPanel();
  }

  /**
   * 填充数据行
   * 策略：通过 "添加记录" 打开记录卡片 → 逐字段填写 → 提交
   * @param {Array} fields - 字段定义（用于列顺序和类型判断）
   * @param {Array} rows - 数据行数组
   */
  async fillRows(fields, rows) {
    if (rows.length === 0) return;
    console.log(`  Filling ${rows.length} rows via record card...`);

    // 确保字段配置面板已关闭
    await this._closeFieldPanel();
    await this.page.waitForTimeout(500);
    await this._closeRecordCard();

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];

      // 打开记录卡片
      if (rowIdx === 0) {
        await this._clickAddRecordButton();
        await this.page.waitForTimeout(1500);

        // 展开隐藏字段（如果有的话）
        await this._expandHiddenFields();

        // 勾选 "提交后继续添加记录"（多行时需要）
        if (rows.length > 1) {
          await this._checkContinueAdd();
        }
      }
      // 后续行：提交后自动打开新记录卡片，等待加载
      if (rowIdx > 0) {
        await this.page.waitForTimeout(800);
        // 展开隐藏字段（如果有的话）
        await this._expandHiddenFields();
      }

      // 填写每个字段
      for (const field of fields) {
        const value = row[field.name];
        if (value === undefined || value === null || String(value).trim() === '' || String(value) === '-') continue;

        await this._fillRecordCardField(field.name, String(value), field.type);
      }

      // 点击 "提交"
      await this._clickSubmitButton();
      await this.page.waitForTimeout(800);

      console.log(`    Row ${rowIdx + 1}/${rows.length} submitted`);
    }

    // 最后关闭记录卡片
    await this._closeRecordCard();
    console.log(`  Filled ${rows.length} rows.`);
  }

  /**
   * 创建子数据表
   * @param {string} name - 子表名称
   * @param {Array} fields - 字段定义
   * @param {Array} rows - 数据行
   */
  async addSubtable(name, fields = [], rows = []) {
    console.log(`  Creating subtable: "${name}"`);

    // 创建新的数据表（通过侧边栏或下拉菜单）
    const created = await this._clickSidebarNewButton();
    if (!created) {
      throw new Error('无法创建新数据表');
    }

    await this.page.waitForTimeout(3000);
    await this._dismissGuides();
    await this._waitForBitableReady();

    // 重命名新建的子表
    await this._renameCurrentTable(name);

    // 配置字段
    if (fields.length > 0) {
      await this._closeBitableSidebar();
      await this.setupFields(fields);
    }

    // 填充数据
    if (rows.length > 0) await this.fillRows(fields, rows);

    console.log(`  Subtable "${name}" created.`);
  }

  /**
   * 添加视图（看板/甘特图等）
   * @param {string} type - 视图类型中文名：'看板' | '甘特图' | '表格' | '画册'
   * @param {string} [viewName] - 可选的视图名称
   */
  async addView(type, viewName) {
    console.log(`  Creating view: "${type}"${viewName ? ` (${viewName})` : ''}`);

    // 关闭可能存在的记录卡片和弹窗
    await this._dismissUnsavedDialog();
    await this._closeRecordCard();
    await this._dismissUnsavedDialog();
    await this.page.waitForTimeout(500);

    // 点击 "+ 新建视图" 按钮（在 tab 栏中）
    const newViewBtn = await this.page.evaluate(() => {
      const btn = document.querySelector('.bitable-add-new-view-btn');
      if (btn) {
        const r = btn.getBoundingClientRect();
        if (r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      return null;
    });

    if (!newViewBtn) {
      console.log('  Could not find "新建视图" button');
      return false;
    }

    await this.page.mouse.click(newViewBtn.x, newViewBtn.y);
    await this.page.waitForTimeout(1000);

    // 在弹出的 b-menu 中精确选择视图类型
    const typeClicked = await this.page.evaluate((targetType) => {
      // 精确匹配 b-menu__item 中的视图类型
      for (const li of document.querySelectorAll('.b-menu__item')) {
        const titleEl = li.querySelector('.b-menu-item-text-with-desc-content-title');
        const text = titleEl ? titleEl.textContent?.trim() : li.textContent?.trim();
        if (text === targetType) {
          const r = li.getBoundingClientRect();
          if (r.width > 0 && r.x > 0) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), text };
          }
        }
      }
      return null;
    }, type);

    if (typeClicked) {
      await this.page.mouse.click(typeClicked.x, typeClicked.y);
      await this.page.waitForTimeout(3000);
    } else {
      console.log(`  Could not find view type "${type}" in menu`);
      await this.page.keyboard.press('Escape');
      return false;
    }

    await this._dismissGuides();
    console.log(`  View "${type}" created.`);
    return true;
  }

  /**
   * 切换到指定名称的数据表
   * @param {string} name - 数据表名称
   * @returns {boolean}
   */
  async switchToTable(name) {
    // 点击 "数据表" 下拉按钮展开侧边栏
    const dtDropdown = await this.page.evaluate(() => {
      const el = document.querySelector('.bitable-view-menu-hover-block-button');
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      return null;
    });

    if (!dtDropdown) return false;

    await this.page.mouse.click(dtDropdown.x, dtDropdown.y);
    await this.page.waitForTimeout(1000);

    // 在展开的列表中找到目标数据表并点击
    const tableItem = await this.page.evaluate((targetName) => {
      for (const item of document.querySelectorAll('.bitable-new-table-tab__item-name-wrapper, .bitable-new-table-tab__item')) {
        const text = item.textContent?.trim();
        if (text && text.includes(targetName)) {
          const r = item.getBoundingClientRect();
          if (r.width > 0 && r.x >= 0) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
      }
      return null;
    }, name);

    if (tableItem) {
      await this.page.mouse.click(tableItem.x, tableItem.y);
      await this.page.waitForTimeout(2000);
      // 点击空白关闭侧边栏
      await this.page.mouse.click(700, 400);
      await this.page.waitForTimeout(500);
      await this._waitForBitableReady();
      return true;
    }

    // 关闭下拉
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
    return false;
  }

  /**
   * 切换到第 N 个数据表（从 0 开始）
   */
  async switchToTableByIndex(index) {
    const dtDropdown = await this.page.evaluate(() => {
      const el = document.querySelector('.bitable-view-menu-hover-block-button');
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      return null;
    });

    if (!dtDropdown) return false;

    await this.page.mouse.click(dtDropdown.x, dtDropdown.y);
    await this.page.waitForTimeout(1000);

    const tableItem = await this.page.evaluate((idx) => {
      const items = document.querySelectorAll('.bitable-new-table-tab__item');
      let dataTableIdx = 0;
      for (const item of items) {
        const parent = item.closest('.bitable-new-table-tab-wrap');
        // 只计算数据表（排除仪表盘和工作流）
        if (parent && !parent.className.includes('dashboard') && !parent.className.includes('workflow')) {
          if (dataTableIdx === idx) {
            const r = item.getBoundingClientRect();
            if (r.width > 0 && r.x >= 0) {
              return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
            }
          }
          dataTableIdx++;
        }
      }
      return null;
    }, index);

    if (tableItem) {
      await this.page.mouse.click(tableItem.x, tableItem.y);
      await this.page.waitForTimeout(2000);
      await this.page.mouse.click(700, 400);
      await this.page.waitForTimeout(500);
      await this._waitForBitableReady();
      return true;
    }

    await this.page.keyboard.press('Escape');
    return false;
  }

  /**
   * 重命名数据表
   * @param {string} oldName - 旧数据表名称
   * @param {string} newName - 新数据表名称
   * @returns {boolean}
   */
  async renameTable(oldName, newName) {
    console.log(`  Renaming table: "${oldName}" → "${newName}"`);

    // 1. 展开侧边栏（点击 >> 或 数据表 tab）
    const expandBtn = await this.page.evaluate(() => {
      for (const el of document.querySelectorAll('div, span, button')) {
        const cls = typeof el.className === 'string' ? el.className : '';
        const r = el.getBoundingClientRect();
        if (r.x >= 0 && r.x < 60 && r.y > 50 && r.y < 120 && r.width > 10 && r.width < 50 && r.height > 10) {
          if (cls.includes('expand') || cls.includes('toggle') || cls.includes('sidebar') || cls.includes('collapse')) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
      }
      return null;
    });

    if (expandBtn) {
      await this.page.mouse.click(expandBtn.x, expandBtn.y);
      await this.page.waitForTimeout(1500);
    }

    // 展开数据表列表
    const dtTab = await this.page.evaluate(() => {
      for (const el of document.querySelectorAll('.bitable-view-menu-hover-block-button, [class*="table-tab"]')) {
        const text = el.textContent?.trim();
        if (text && text.includes('数据表')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
      return null;
    });
    if (dtTab) {
      await this.page.mouse.click(dtTab.x, dtTab.y);
      await this.page.waitForTimeout(1500);
    }

    // 2. 用 .bitable-new-table-tab__item-name 找到 oldName
    const target = await this.page.evaluate((targetName) => {
      for (const el of document.querySelectorAll('.bitable-new-table-tab__item-name')) {
        const text = el.textContent?.trim();
        if (text === targetName) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.x >= 0) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
      }
      return null;
    }, oldName);

    if (!target) {
      console.log(`    Table "${oldName}" not found`);
      return false;
    }

    // 3. 双击 → 找到 input (class table-tab-input, dist < 30) → Ctrl+A → type → Enter
    await this.page.mouse.dblclick(target.x, target.y);
    await this.page.waitForTimeout(1000);

    // 查找出现的 input（class 包含 table-tab-input 或距离目标位置很近）
    const inputInfo = await this.page.evaluate((targetY) => {
      let best = null;
      let bestDist = 999;
      for (const inp of document.querySelectorAll('input')) {
        const r = inp.getBoundingClientRect();
        if (r.width > 20 && r.x >= 0 && inp.offsetParent !== null) {
          const dist = Math.abs(r.y + r.height / 2 - targetY);
          const cls = (inp.className || '').toLowerCase();
          // 优先选择 table-tab-input 类的 input
          if (cls.includes('table-tab-input') || dist < bestDist) {
            bestDist = dist;
            best = {
              x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
              dist: Math.round(dist), cls: (inp.className || '').slice(0, 80),
            };
          }
        }
      }
      return best;
    }, target.y);

    if (inputInfo && inputInfo.dist < 30) {
      await this.page.mouse.click(inputInfo.x, inputInfo.y);
      await this.page.waitForTimeout(200);
      await this.page.keyboard.press('Control+a');
      await this.page.waitForTimeout(100);
      await this.page.keyboard.type(newName, { delay: 20 });
      await this.page.waitForTimeout(300);
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(1000);
      console.log(`    ✓ Renamed to "${newName}"`);
      return true;
    } else {
      console.log(`    No suitable input found for renaming`);
      return false;
    }
  }

  /**
   * 删除指定视图
   * @param {string} viewName - 视图名称
   * @returns {boolean}
   */
  async deleteView(viewName) {
    console.log(`  Deleting view: "${viewName}"`);

    // 在 tab 栏找到视图名称（y 约 70-100）
    const viewTab = await this.page.evaluate((name) => {
      for (const el of document.querySelectorAll('[class*="tab"], [class*="view"]')) {
        const text = el.textContent?.trim();
        const r = el.getBoundingClientRect();
        if (text === name && r.y > 60 && r.y < 120 && r.width > 0) {
          return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
      return null;
    }, viewName);

    if (!viewTab) {
      console.log(`    View "${viewName}" not found`);
      return false;
    }

    // 右键点击视图 tab
    await this.page.mouse.click(viewTab.x, viewTab.y, { button: 'right' });
    await this.page.waitForTimeout(800);

    // 在菜单中选择"删除视图"
    const deleteClicked = await this.page.evaluate(() => {
      const menuSelectors = '.b-menu__item, .ud__menu-item, .menu-item, [class*="menu"] [class*="item"], [role="menuitem"]';
      for (const el of document.querySelectorAll(menuSelectors)) {
        const text = el.textContent?.trim();
        if (text === '删除视图' || text === '删除') {
          const r = el.getBoundingClientRect();
          if (r.width > 0) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
      }
      return null;
    });

    if (deleteClicked) {
      await this.page.mouse.click(deleteClicked.x, deleteClicked.y);
      await this.page.waitForTimeout(500);

      // 确认弹窗
      const confirmClicked = await this.page.evaluate(() => {
        for (const btn of document.querySelectorAll('button')) {
          const text = btn.textContent?.trim();
          if (text === '确定' || text === '删除' || text === '确认') {
            const r = btn.getBoundingClientRect();
            if (r.width > 0 && r.x > 0) {
              return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
            }
          }
        }
        return null;
      });

      if (confirmClicked) {
        await this.page.mouse.click(confirmClicked.x, confirmClicked.y);
        await this.page.waitForTimeout(1000);
        console.log(`    ✓ Deleted view "${viewName}"`);
        return true;
      }
    }

    console.log(`    Could not delete view "${viewName}"`);
    return false;
  }

  // ===================================================================
  //  内部辅助方法
  // ===================================================================

  /**
   * 等待多维表格完全加载（Canvas 可见 + URL 含 table=）
   */
  async _waitForBitableReady() {
    // 等待 URL 中出现 table= 参数
    await this.page.waitForFunction(
      () => window.location.href.includes('table='),
      { timeout: 20000 }
    ).catch(() => {
      console.log('  Warning: URL does not contain table= parameter');
    });

    // 等待 Canvas 元素出现
    await this.page.locator('canvas').first().waitFor({
      state: 'visible',
      timeout: 15000,
    }).catch(() => {
      console.log('  Warning: Canvas not visible yet');
    });

    // 额外等待渲染稳定
    await this.page.waitForTimeout(3000);
  }

  /**
   * 关闭引导弹窗、AI 浮层等
   */
  async _dismissGuides() {
    await dismissPopups(this.page);

    const dismissTexts = ['知道了', '我知道了', '跳过', '开始使用', '稍后', '关闭'];
    for (let attempt = 0; attempt < 3; attempt++) {
      let closed = false;
      for (const text of dismissTexts) {
        try {
          const btn = this.page.locator(`button:has-text("${text}")`).first();
          if (await btn.isVisible({ timeout: 500 })) {
            await btn.click();
            await this.page.waitForTimeout(400);
            closed = true;
          }
        } catch {}
      }

      // 关闭 close 图标
      const closeSelectors = [
        '[class*="guide"] [class*="close"]',
        '[class*="onboarding"] [class*="close"]',
        '[class*="modal"] [class*="close"]',
        '[aria-label="关闭"]',
        '[aria-label="Close"]',
      ];
      for (const sel of closeSelectors) {
        try {
          const el = this.page.locator(sel).first();
          if (await el.isVisible({ timeout: 300 })) {
            await el.click();
            await this.page.waitForTimeout(300);
            closed = true;
          }
        } catch {}
      }

      if (!closed) break;
    }

    // 最终 Escape 兜底
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
  }

  /**
   * 关闭 AI 相关浮层
   */
  async _closeAIOverlays() {
    const aiCloseSelectors = [
      '[class*="ai-card"] [class*="close"]',
      '[class*="ai-banner"] [class*="close"]',
      '[class*="ai-promote"] [class*="close"]',
      '[class*="banner"] [class*="close"]',
      '[class*="base-ai"] [class*="close"]',
    ];
    for (const sel of aiCloseSelectors) {
      try {
        const el = this.page.locator(sel).first();
        if (await el.isVisible({ timeout: 500 })) {
          await el.click();
          await this.page.waitForTimeout(300);
        }
      } catch {}
    }
  }

  /**
   * 点击空白模板创建
   */
  async _clickBlankTemplate() {
    const candidates = [
      'text=新建空白多维表格',
      'text=空白表格',
      'text=空白',
      'text=从空白创建',
      'text=开始创建',
    ];
    for (const sel of candidates) {
      try {
        const el = this.page.locator(sel).first();
        if (await el.isVisible({ timeout: 1500 })) {
          await el.click();
          return;
        }
      } catch {}
    }
    // 兜底：点击第一个模板卡片
    const card = this.page.locator('[class*="template-card"], [class*="template-item"], [class*="create-card"]').first();
    await card.click();
  }

  // ----- 字段操作 -----

  /**
   * 关闭左侧 bitable sidebar（必须先关闭，否则 "字段配置" 会打开搜索面板）
   */
  async _closeBitableSidebar() {
    const closeBtn = await this.page.evaluate(() => {
      const el = document.querySelector('.bitable-sidebar-close-icon-wrap');
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.x > 0 && r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      return null;
    });
    if (closeBtn) {
      await this.page.mouse.click(closeBtn.x, closeBtn.y);
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * 打开字段配置面板（通过工具栏 "字段配置" 按钮）
   */
  async _openFieldPanel() {
    // 检查面板是否已经打开
    const alreadyOpen = await this.page.evaluate(() => {
      const panel = document.querySelector('.bitable-field-panel-v2-container');
      return panel && panel.getBoundingClientRect().width > 0;
    });
    if (alreadyOpen) return;

    // 使用 toolbar-field-wrapper 精确定位
    const pos = await this.page.evaluate(() => {
      const el = document.querySelector('.toolbar-field-wrapper');
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      return null;
    });
    if (pos) {
      await this.page.mouse.click(pos.x, pos.y);
    }
    await this.page.waitForTimeout(1500);

    // 验证面板打开
    const opened = await this.page.evaluate(() => {
      const panel = document.querySelector('.bitable-field-panel-v2-container');
      return panel && panel.getBoundingClientRect().width > 0;
    });
    if (!opened) {
      console.log('  Warning: Field config panel did not open');
    }
  }

  /**
   * 关闭字段配置面板
   */
  async _closeFieldPanel() {
    // 再次点击 "字段配置" 按钮来关闭面板
    const pos = await this.page.evaluate(() => {
      const el = document.querySelector('.toolbar-field-wrapper');
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      return null;
    });
    if (pos) {
      await this.page.mouse.click(pos.x, pos.y);
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * 从字段配置面板中读取已有字段名列表
   */
  async _getFieldNamesFromPanel() {
    return await this.page.evaluate(() => {
      const items = document.querySelectorAll('.bitable-field-panel-list-item');
      return Array.from(items).map(item => {
        const nameEl = item.querySelector('.item-name.bitable-field-name, .bitable-field-name');
        return nameEl ? nameEl.textContent.trim() : '';
      }).filter(Boolean);
    });
  }

  /**
   * 通过面板 "..." → "编辑" 菜单重命名并设置字段类型
   * @param {number} index - 字段在面板列表中的索引
   * @param {string} newName - 新字段名
   * @param {string} [type] - 可选的字段类型
   */
  async _renameFieldViaEditMenu(index, newName, type) {
    try {
      // hover 到字段项上使 "..." 按钮出现
      const itemPos = await this.page.evaluate((idx) => {
        const items = document.querySelectorAll('.bitable-field-panel-list-item');
        if (!items[idx]) return null;
        const r = items[idx].getBoundingClientRect();
        return { x: Math.round(r.x + r.width - 20), y: Math.round(r.y + r.height / 2) };
      }, index);

      if (!itemPos) return;

      await this.page.mouse.move(itemPos.x, itemPos.y);
      await this.page.waitForTimeout(800);

      // 获取 "..." 按钮位置
      const moreBtn = await this.page.evaluate((idx) => {
        const items = document.querySelectorAll('.bitable-field-panel-list-item');
        if (!items[idx]) return null;
        const btns = items[idx].querySelectorAll('button, [class*="more"], [class*="action"]');
        for (const btn of btns) {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.x > 0) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
        return null;
      }, index);

      if (!moreBtn) return;

      await this.page.mouse.click(moreBtn.x, moreBtn.y);
      await this.page.waitForTimeout(800);

      // 点击 "编辑" 菜单项
      await this._clickMenuItemByText('编辑');
      await this.page.waitForTimeout(1000);

      // 编辑弹窗中填写新名称 — 使用 "请输入字段标题" 的 input
      const titleInput = await this.page.evaluate(() => {
        for (const inp of document.querySelectorAll('input')) {
          if (inp.placeholder?.includes('字段标题') || inp.placeholder?.includes('字段名称')) {
            const r = inp.getBoundingClientRect();
            if (r.width > 0 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
        // 兜底：弹窗中第一个可见 input
        for (const inp of document.querySelectorAll('.b-field-popover-new input, [class*="field-popover"] input')) {
          const r = inp.getBoundingClientRect();
          if (r.width > 50 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
        return null;
      });

      if (titleInput) {
        await this.page.mouse.click(titleInput.x, titleInput.y);
        await this.page.waitForTimeout(200);
        await this.page.keyboard.press('Control+a');
        await this.page.waitForTimeout(100);
        await this.page.keyboard.type(newName, { delay: 20 });
        await this.page.waitForTimeout(300);
      }

      // 设置字段类型（如果不是 text）
      if (type && type !== 'text') {
        await this._selectFieldTypeInPopover(type);
      }

      // 点击 "确定"
      await this._clickConfirmInPopover();
      await this.page.waitForTimeout(800);
    } catch (e) {
      console.error(`  _renameFieldViaEditMenu error: ${e.message}`);
      await this.page.keyboard.press('Escape').catch(() => {});
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * 通过列头右侧 "+" 按钮添加新字段（备用方法，面板方式优先）
   * 飞书 bitable 的 "+" 按钮在最后一列右边的列头区域
   */
  async _addFieldViaColumnPlus(name, type) {
    // 委托给面板方式
    await this._addFieldViaPanel(name, type);
  }

  /**
   * 通过字段配置面板的 "新增字段" 按钮添加字段
   * 使用 page.mouse.click 确保 React 事件正确触发
   */
  async _addFieldViaPanel(name, type, linkedTable) {
    try {
      // 确保字段配置面板已打开
      await this._openFieldPanel();
      await this.page.waitForTimeout(500);

      // 用 mouse.click 点击 "新增字段" 按钮
      const addPos = await this.page.evaluate(() => {
        const el = document.querySelector('.bitable-field-panel-add-field');
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
        return null;
      });

      if (!addPos) {
        console.log('    Could not find "新增字段" button');
        return;
      }

      await this.page.mouse.click(addPos.x, addPos.y);
      await this.page.waitForTimeout(1500);

      // 等待弹窗出现（b-field-popover-new）
      const popoverVisible = await this.page.evaluate(() => {
        const el = document.querySelector('.b-field-popover-new');
        return el && el.getBoundingClientRect().width > 0;
      });
      if (!popoverVisible) {
        console.log('    Warning: field popover did not appear');
      }

      // 填写字段标题
      const titleInput = await this.page.evaluate(() => {
        for (const inp of document.querySelectorAll('input')) {
          if (inp.placeholder?.includes('字段标题') || inp.placeholder?.includes('字段名称')) {
            const r = inp.getBoundingClientRect();
            if (r.width > 0 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
        // 兜底：弹窗内第一个 input
        for (const inp of document.querySelectorAll('.b-field-popover-new input')) {
          const r = inp.getBoundingClientRect();
          if (r.width > 50 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
        return null;
      });

      if (titleInput) {
        await this.page.mouse.click(titleInput.x, titleInput.y);
        await this.page.waitForTimeout(200);
        await this.page.keyboard.type(name, { delay: 20 });
        await this.page.waitForTimeout(300);
      }

      // 选择字段类型（如果不是默认的 "文本"）
      if (type && type !== 'text') {
        await this._selectFieldTypeInPopover(type, linkedTable);
      }

      // 点击 "确定"
      await this._clickConfirmInPopover();
      await this.page.waitForTimeout(800);
    } catch (e) {
      console.error(`  _addFieldViaPanel error: ${e.message}`);
      await this.page.keyboard.press('Escape').catch(() => {});
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * 在字段编辑弹窗（b-field-popover-new）中选择字段类型
   * 步骤：点击 "文本 >" 行 → 右侧弹出 field-option-list → 选择目标类型
   */
  async _selectFieldTypeInPopover(type, linkedTable = null) {
    const typeLabel = FIELD_TYPE_LABELS[type] || type;

    // 点击类型选择行（"文本 >"）展开右侧类型列表
    const typeRowPos = await this.page.evaluate(() => {
      const el = document.querySelector('.build-in-field') || document.querySelector('.b-field-type.bitable-select-basic-field');
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      return null;
    });

    if (!typeRowPos) {
      console.log(`    Could not find type selector row`);
      return;
    }

    await this.page.mouse.click(typeRowPos.x, typeRowPos.y);
    await this.page.waitForTimeout(1000);

    // 在右侧弹出的 field-option-list 中选择目标类型
    const typeItemPos = await this.page.evaluate((label) => {
      // field-option-list__item 是类型列表中的项
      for (const el of document.querySelectorAll('.field-option-list__item')) {
        const text = el.textContent?.trim();
        if (text === label) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
      // 兜底：搜索所有精确匹配的元素
      for (const el of document.querySelectorAll('div, span')) {
        const text = el.textContent?.trim();
        if (text === label && el.children.length <= 1) {
          const r = el.getBoundingClientRect();
          // 类型列表项在弹窗右侧 (x > 600)
          if (r.width > 0 && r.x > 500 && r.height > 10 && r.height < 50) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
      }
      return null;
    }, typeLabel);

    if (typeItemPos) {
      await this.page.mouse.click(typeItemPos.x, typeItemPos.y);
      await this.page.waitForTimeout(800);
    } else {
      console.log(`    Could not find type "${typeLabel}" in dropdown`);
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(300);
    }

    // 关联字段：选择类型后需要在弹出面板中选择目标表
    if (type === 'link' && linkedTable) {
      const found = await this._selectLinkedTable(linkedTable);
      if (!found) {
        throw new Error(`关联目标表 "${linkedTable}" 未找到`);
      }
    }
  }

  /**
   * 在关联字段类型选择后，选择目标数据表
   * 飞书 UI 流程：选择"关联"类型后弹出面板，包含搜索框和数据表列表
   * @param {string} tableName - 目标数据表名称
   * @returns {boolean} 是否成功选择目标表
   */
  async _selectLinkedTable(tableName) {
    console.log(`    Selecting linked table: "${tableName}"`);
    await this.page.waitForTimeout(2000);

    // 在关联面板的搜索框中输入目标表名
    const searchInput = await this.page.evaluate(() => {
      // 关联面板中的搜索框
      const popover = document.querySelector('.b-field-popover-new') || document;
      for (const inp of popover.querySelectorAll('input')) {
        const ph = inp.placeholder || '';
        if (ph.includes('搜索') || ph.includes('查找') || ph.includes('数据表')) {
          const r = inp.getBoundingClientRect();
          if (r.width > 0 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
      // 兜底：弹窗内最后出现的 input（类型选择后新出现的搜索框）
      const inputs = popover.querySelectorAll('input');
      for (let i = inputs.length - 1; i >= 0; i--) {
        const r = inputs[i].getBoundingClientRect();
        if (r.width > 30 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      return null;
    });

    if (searchInput) {
      await this.page.mouse.click(searchInput.x, searchInput.y);
      await this.page.waitForTimeout(300);
      await this.page.keyboard.type(tableName, { delay: 20 });
      await this.page.waitForTimeout(800);
    }

    // 在列表中点击目标数据表
    const tableItem = await this.page.evaluate((name) => {
      // 查找关联面板中的数据表列表项
      const popover = document.querySelector('.b-field-popover-new') || document;
      for (const el of popover.querySelectorAll('div, span, li, [class*="item"], [class*="option"]')) {
        const text = el.textContent?.trim();
        if (text === name && el.children.length <= 2) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.x > 0 && r.height > 8 && r.height < 60) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
      }
      return null;
    }, tableName);

    if (tableItem) {
      await this.page.mouse.click(tableItem.x, tableItem.y);
      await this.page.waitForTimeout(800);
      console.log(`    Linked table "${tableName}" selected`);
      return true;
    } else {
      console.log(`    Warning: Could not find linked table "${tableName}" in panel`);
      return false;
    }
  }

  /**
   * 在字段编辑弹窗中点击 "确定" 按钮
   */
  async _clickConfirmInPopover() {
    const confirmPos = await this.page.evaluate(() => {
      // 查找弹窗内的 "确定" 按钮
      const popover = document.querySelector('.b-field-popover-new') || document;
      for (const btn of popover.querySelectorAll('button')) {
        const text = btn.textContent?.trim();
        if (text === '确定' || text === '确认') {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
      return null;
    });

    if (confirmPos) {
      await this.page.mouse.click(confirmPos.x, confirmPos.y);
    } else {
      // 兜底：按 Enter
      await this.page.keyboard.press('Enter');
    }
    await this.page.waitForTimeout(500);
  }

  // ----- 记录卡片操作 -----

  /**
   * 点击工具栏 "添加记录" 按钮
   */
  async _clickAddRecordButton() {
    const pos = await this.page.evaluate(() => {
      const el = document.querySelector('.bitable-append-record-btn-ud button');
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      for (const el of document.querySelectorAll('button, span')) {
        if (el.textContent?.trim() === '添加记录') {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.x > 0 && r.y < 150) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
      return null;
    });
    if (pos) {
      await this.page.mouse.click(pos.x, pos.y);
    }
  }

  /**
   * 展开记录卡片中的隐藏字段
   */
  async _expandHiddenFields() {
    const expandPos = await this.page.evaluate(() => {
      for (const el of document.querySelectorAll('span, div, a')) {
        const text = el.textContent?.trim();
        if (text && text.includes('隐藏字段') && text.includes('个')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
      return null;
    });
    if (expandPos) {
      await this.page.mouse.click(expandPos.x, expandPos.y);
      await this.page.waitForTimeout(800);
    }
  }

  /**
   * 勾选 "提交后继续添加记录" 复选框
   */
  async _checkContinueAdd() {
    // 飞书使用自定义 checkbox 组件（ud__checkbox__wrapper）
    // 检查是否已勾选：看 class 中是否含有 "checked" 相关标记
    const result = await this.page.evaluate(() => {
      for (const el of document.querySelectorAll('span, label, div')) {
        const text = el.textContent?.trim();
        if (text !== '提交后继续添加记录') continue;
        // 找到 checkbox wrapper（在文字的前面或父级中）
        const parent = el.parentElement;
        if (!parent) continue;
        const cbWrapper = parent.querySelector('[class*="checkbox"]');
        if (cbWrapper) {
          const cls = typeof cbWrapper.className === 'string' ? cbWrapper.className : '';
          const isChecked = cls.includes('checked') || cls.includes('selected') || cbWrapper.getAttribute('aria-checked') === 'true';
          const r = cbWrapper.getBoundingClientRect();
          if (r.width > 0) {
            return { isChecked, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
        // 兜底：点击文字区域左侧（checkbox 通常在文字左边）
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.x > 0) {
          return { isChecked: false, x: Math.round(r.x - 15), y: Math.round(r.y + r.height / 2) };
        }
      }
      return null;
    });

    if (result && !result.isChecked) {
      await this.page.mouse.click(result.x, result.y);
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * 在记录卡片中填写指定字段
   * 记录卡片结构: base_record_card_field_editor_wrapper > b-field-label >
   *   左侧 b-field-label__text (含 .bitable-field-name) + 右侧 b-field-label__editor
   */
  async _fillRecordCardField(fieldName, value, fieldType) {
    // 找到字段名对应的编辑器区域
    const editorPos = await this.page.evaluate((name) => {
      for (const nameEl of document.querySelectorAll('.bitable-field-name')) {
        const text = nameEl.textContent?.trim();
        if (text !== name) continue;
        const label = nameEl.closest('.b-field-label, .base_record_card_field_editor_wrapper');
        if (!label) continue;
        const editor = label.querySelector('.b-field-label__editor');
        if (editor) {
          const r = editor.getBoundingClientRect();
          if (r.width > 0 && r.x > 0) {
            return { x: Math.round(r.x + 50), y: Math.round(r.y + r.height / 2) };
          }
        }
      }
      return null;
    }, fieldName);

    if (!editorPos) {
      console.log(`    Warning: field "${fieldName}" not found in record card, skipping`);
      return;
    }

    // 点击编辑器区域激活输入
    await this.page.mouse.click(editorPos.x, editorPos.y);
    await this.page.waitForTimeout(500);

    if (fieldType === 'text' || fieldType === 'number') {
      // 文本/数字字段: contenteditable div，直接键盘输入
      await this.page.keyboard.type(value, { delay: 15 });
      await this.page.waitForTimeout(200);
    } else if (SELECT_TYPES.has(fieldType)) {
      // 单选字段: 点击编辑器后直接输入搜索文本
      await this.page.keyboard.type(value, { delay: 20 });
      await this.page.waitForTimeout(600);
      // 按 Enter 选择/创建选项
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(500);
    } else if (fieldType === 'date') {
      // 日期字段: 点击编辑器后出现日期 input + 日历弹窗
      // 等待日期 input 激活（可能需要多次点击）
      let dateInputReady = await this.page.evaluate(() => {
        const focused = document.activeElement;
        return focused?.tagName === 'INPUT' && (
          focused.className?.includes('date') ||
          focused.closest('[class*="date"]') !== null ||
          focused.placeholder?.includes('年') || focused.placeholder?.includes('/')
        );
      });
      if (!dateInputReady) {
        await this.page.mouse.click(editorPos.x, editorPos.y);
        await this.page.waitForTimeout(500);
      }
      await this.page.keyboard.press('Control+a');
      await this.page.waitForTimeout(100);
      await this.page.keyboard.type(value, { delay: 15 });
      await this.page.waitForTimeout(300);
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(500);
      // Enter 确认后日期已保存，但日历弹窗仍打开
      // 不能用 Escape（会触发"记录尚未提交"弹窗）
      // 点击记录卡片标题区域关闭日历弹窗
      await this._dismissDatePicker();
    }
  }

  /**
   * 点击记录卡片内的空白区域，取消当前字段焦点
   * 防止后续字段输入串到当前焦点字段
   */
  async _clickRecordCardBlank() {
    // 点击记录卡片标题区域（安全的空白位置）
    const blankPos = await this.page.evaluate(() => {
      // 找 "+ 新增字段" 下方的空白区域
      for (const el of document.querySelectorAll('*')) {
        const text = el.textContent?.trim();
        if (text === '+ 新增字段' || text === '新增字段') {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.x > 600) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height + 30) };
          }
        }
      }
      // 兜底：记录卡片右侧下半部分的空白区域
      return { x: 1050, y: 600 };
    });
    await this.page.mouse.click(blankPos.x, blankPos.y);
    await this.page.waitForTimeout(300);
  }

  /**
   * 关闭日期选择器的日历弹窗
   * 通过点击记录卡片标题区域（日历弹窗外部）来关闭
   */
  async _dismissDatePicker() {
    // 点击记录卡片的标题区域（通常在最上面，安全且不会触发其他操作）
    const titlePos = await this.page.evaluate(() => {
      // 找记录卡片的标题 contenteditable 区域上方的空白处
      // 记录卡片标题在右上区域
      const cardTitle = document.querySelector('[class*="record-card"] [class*="title"], [class*="card-modal"] [class*="title"]');
      if (cardTitle) {
        const r = cardTitle.getBoundingClientRect();
        if (r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      // 兜底：点击记录卡片最上方区域（字段列表上方）
      // 找 "扫码填写" 或 "获取填写链接" 文字附近（记录卡片右上角工具栏）
      for (const el of document.querySelectorAll('span, div')) {
        const text = el.textContent?.trim();
        if (text === '扫码填写' || text === '获取填写链接') {
          const r = el.getBoundingClientRect();
          if (r.width > 0) return { x: Math.round(r.x), y: Math.round(r.y + r.height + 15) };
        }
      }
      // 最终兜底：记录卡片区域中部空白（在 "新增字段" 下方）
      return { x: 1050, y: 550 };
    });
    await this.page.mouse.click(titlePos.x, titlePos.y);
    await this.page.waitForTimeout(500);

    // 检查是否误触发了 "记录尚未提交" 弹窗
    await this._dismissUnsavedDialog();
  }

  /**
   * 关闭 "记录尚未提交，退出后内容将不会保存" 弹窗
   * 点击 "继续编辑" 按钮
   */
  async _dismissUnsavedDialog() {
    const continueBtn = await this.page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        const text = btn.textContent?.trim();
        if (text === '继续编辑') {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
      return null;
    });
    if (continueBtn) {
      await this.page.mouse.click(continueBtn.x, continueBtn.y);
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * 点击记录卡片 "提交" 按钮
   */
  async _clickSubmitButton() {
    const pos = await this.page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        const text = btn.textContent?.trim();
        if (text === '提交') {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
      return null;
    });
    if (pos) {
      await this.page.mouse.click(pos.x, pos.y);
    }
  }

  // ----- 数据操作 -----

  /**
   * 获取 Canvas 边界
   */
  async _getCanvasBounds() {
    const canvas = this.page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 10000 });
    return await canvas.boundingBox();
  }

  /**
   * 双击第一个单元格进入编辑
   */
  async _clickFirstCell() {
    const box = await this._getCanvasBounds();
    if (!box) throw new Error('Canvas not found');
    // 点击第一行第一列区域（Canvas 内，相对偏移）
    await this.page.mouse.dblclick(box.x + 150, box.y + 45);
    await this.page.waitForTimeout(600);
  }

  /**
   * 通过 "添加记录" 按钮添加新行并确保聚焦到第一个单元格
   */
  async _addRowAndFocus() {
    // 点击工具栏 "添加记录" 按钮
    const addBtnPos = await this.page.evaluate(() => {
      const el = document.querySelector('.bitable-append-record-btn-ud button, .bitable-toolbar-add');
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      // 兜底：搜索 "添加记录" 文字
      for (const el of document.querySelectorAll('button, span')) {
        if (el.textContent?.trim() === '添加记录') {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.x > 0 && r.y < 150) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
      return null;
    });

    if (addBtnPos) {
      await this.page.mouse.click(addBtnPos.x, addBtnPos.y);
    } else {
      // 兜底：尝试文字匹配
      await this._clickByText('添加记录');
    }
    await this.page.waitForTimeout(800);

    // 检查是否弹出了记录展开卡片（而非行内编辑）
    const hasRecordCard = await this.page.evaluate(() => {
      // 记录展开卡片的标志性元素
      return !!document.querySelector('.bitable-record-card, [class*="record-card"], [class*="expand-record"]');
    });

    if (hasRecordCard) {
      // 关闭记录卡片，改用行内编辑
      await this._closeRecordCard();
      await this.page.waitForTimeout(300);
      // 在 Canvas 中找到新行的第一个单元格并点击
      await this._clickLastRowFirstCell();
    }

    // 确保有编辑焦点
    const hasFocus = await this.page.evaluate(() => {
      return !!document.querySelector('[class*="cell-editor"], [class*="cell-input"], input:focus, textarea:focus, [contenteditable="true"]:focus');
    });
    if (!hasFocus) {
      // 再尝试双击最后一行的第一个单元格
      await this._clickLastRowFirstCell();
    }
  }

  /**
   * 关闭记录展开卡片
   */
  async _closeRecordCard() {
    // 查找记录卡片的关闭按钮
    const closePos = await this.page.evaluate(() => {
      const closeSelectors = [
        '.bitable-record-card [class*="close"]',
        '[class*="record-card"] [class*="close"]',
        '[class*="expand-record"] [class*="close"]',
        '[class*="record-detail"] [class*="close"]',
      ];
      for (const sel of closeSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
      return null;
    });

    if (closePos) {
      await this.page.mouse.click(closePos.x, closePos.y);
      await this.page.waitForTimeout(500);
    } else {
      // 按 Escape 关闭
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(500);
    }

    // 处理 "记录尚未提交" 弹窗 — 点击 "退出"
    const exitBtn = await this.page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent?.trim() === '退出') {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.x > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
      return null;
    });
    if (exitBtn) {
      await this.page.mouse.click(exitBtn.x, exitBtn.y);
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * 点击最后一行的第一个单元格
   */
  async _clickLastRowFirstCell() {
    const box = await this._getCanvasBounds();
    if (!box) return;
    // 获取当前行数来计算最后一行的 y 坐标
    // 飞书 bitable 行高默认约 36px，列头高约 36px
    const rowCount = await this.page.evaluate(() => {
      const text = document.querySelector('[class*="record-count"], [class*="row-count"]')?.textContent || '';
      const match = text.match(/(\d+)/);
      return match ? parseInt(match[1]) : 1;
    });
    // 最后一行的 y = canvas.y + 36(列头) + (rowCount - 1) * 36 + 18(行中心)
    const lastRowY = Math.min(box.y + 36 + (rowCount - 1) * 36 + 18, box.y + box.height - 20);
    const firstCellX = box.x + 150;
    await this.page.mouse.dblclick(firstCellX, lastRowY);
    await this.page.waitForTimeout(600);
  }

  /**
   * 添加新行并聚焦到第一个单元格（旧方法，保持兼容）
   */
  async _addRow() {
    // 策略1：通过 DOM 查找"添加记录"按钮
    const addClicked = await this._clickByText('添加记录');
    if (!addClicked) {
      // 策略2：通过选择器链查找
      try {
        const addBtn = await this.find(selectors.bitable.addRowButton, { timeout: 2000 });
        await addBtn.click();
      } catch {
        console.log('    Warning: Could not find "添加记录" button');
      }
    }
    await this.page.waitForTimeout(800);
    // 飞书点击"添加记录"后会自动聚焦到新行第一个单元格
    // 如果未自动聚焦，尝试点击最后一行
    const hasFocus = await this.page.evaluate(() => {
      return !!document.querySelector('[class*="cell-editor"], [class*="cell-input"], input:focus, textarea:focus');
    });
    if (!hasFocus) {
      await this._clickFirstCell();
    }
  }

  // ----- 子表格操作 -----

  /**
   * 点击侧边栏底部的"新建"按钮，并在菜单中选择"数据表"
   * 飞书 bitable 的侧边栏需要先通过 ">>" 按钮展开
   */
  async _clickSidebarNewButton() {
    // Step 0: 检查侧边栏是否已展开（wiki 嵌入场景默认展开）
    const sidebarAlreadyOpen = await this.page.evaluate(() => {
      const sidebar = document.querySelector('.bitable-table-tab-sidebar, .bitable-new-table-tab-wrap, [class*="table-tab-sidebar"]');
      if (sidebar) {
        const r = sidebar.getBoundingClientRect();
        return r.width > 50 && r.x >= 0;
      }
      return false;
    });

    // Step 1: 先展开左侧侧边栏（点击 ">>" 按钮），wiki 嵌入时跳过
    if (!sidebarAlreadyOpen) {
      const expandBtn = await this.page.evaluate(() => {
        // ">>" 按钮在左上角，class 中包含 "expand" 或 "toggle"
        // 也可能是 bitable-sidebar 相关的展开按钮
        for (const el of document.querySelectorAll('div, span, button')) {
          const text = el.textContent?.trim();
          const cls = typeof el.className === 'string' ? el.className : '';
          const r = el.getBoundingClientRect();
          // 左上角区域的展开按钮
          if (r.x >= 0 && r.x < 50 && r.y > 50 && r.y < 120 && r.width > 10 && r.width < 50 && r.height > 10) {
            if (cls.includes('expand') || cls.includes('toggle') || cls.includes('sidebar') || cls.includes('collapse')) {
              return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), cls: cls.slice(0, 60) };
            }
          }
          // ">>" 文字按钮
          if (text === '>>' && r.x < 50 && r.y < 120 && r.width > 0) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), cls: cls.slice(0, 60) };
          }
        }
        return null;
      });

      if (expandBtn) {
        await this.page.mouse.click(expandBtn.x, expandBtn.y);
        await this.page.waitForTimeout(1500);
      }
    }

    // Step 2: 在展开的侧边栏中找到 "新建" 区域下的 "数据表" 菜单项
    const newTableBtn = await this.page.evaluate(() => {
      // 方法1：直接找 bitable-block-creation-menu-item 中的 "数据表"
      for (const li of document.querySelectorAll('.bitable-block-creation-menu-item, [class*="creation-menu"] li')) {
        const text = li.textContent?.trim();
        if (text === '数据表') {
          const r = li.getBoundingClientRect();
          if (r.width > 0 && r.x >= 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
      // 方法2：查找 "新建" 标题下方的 "数据表" 文字
      for (const el of document.querySelectorAll('li, div[role="menuitem"]')) {
        const text = el.textContent?.trim();
        if (text === '数据表') {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.x >= 0 && r.y > 400) { // "新建" 部分在下方
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
      }
      return null;
    });

    if (newTableBtn) {
      await this.page.mouse.click(newTableBtn.x, newTableBtn.y);
      await this.page.waitForTimeout(2000);
      return true;
    }

    // 方法3: wiki 嵌入场景 — 侧边栏底部的 "新建" 文字按钮
    const wikiNewBtn = await this.page.evaluate(() => {
      for (const el of document.querySelectorAll('span, div, button')) {
        const text = el.textContent?.trim();
        if (text === '新建' || text === '+ 新建') {
          const r = el.getBoundingClientRect();
          // 侧边栏区域（x < 300, y > 300）
          if (r.width > 0 && r.x < 300 && r.y > 300) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
      }
      return null;
    });

    if (wikiNewBtn) {
      await this.page.mouse.click(wikiNewBtn.x, wikiNewBtn.y);
      await this.page.waitForTimeout(1000);

      // 等待菜单出现后选择 "数据表"
      const dataTableItem = await this.page.evaluate(() => {
        for (const el of document.querySelectorAll('.b-menu__item, [class*="menu-item"], li, div[role="menuitem"]')) {
          const text = el.textContent?.trim();
          if (text === '数据表') {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.x >= 0) {
              return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
            }
          }
        }
        return null;
      });

      if (dataTableItem) {
        await this.page.mouse.click(dataTableItem.x, dataTableItem.y);
        await this.page.waitForTimeout(2000);
        return true;
      }
    }

    // 方法4：如果侧边栏没有展开，尝试直接通过 "数据表" 下拉菜单的 "新建" 部分
    // 点击顶部 "数据表" 下拉
    const dtDropdown = await this.page.evaluate(() => {
      const el = document.querySelector('.bitable-view-menu-hover-block-button');
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      return null;
    });

    if (dtDropdown) {
      await this.page.mouse.click(dtDropdown.x, dtDropdown.y);
      await this.page.waitForTimeout(1000);

      // 查找弹出菜单中的 "新建" → "数据表"
      // 需要先滚动到 "新建" 部分
      const menuNewTable = await this.page.evaluate(() => {
        for (const li of document.querySelectorAll('.bitable-block-creation-menu-item, [class*="menu-item"]')) {
          const text = li.textContent?.trim();
          if (text === '数据表') {
            const r = li.getBoundingClientRect();
            // 这里取 y > 400 排除顶部 tab 中已存在的 "数据表" tab
            if (r.width > 0 && r.x >= 0 && r.y > 400) {
              return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
            }
          }
        }
        return null;
      });

      if (menuNewTable) {
        await this.page.mouse.click(menuNewTable.x, menuNewTable.y);
        await this.page.waitForTimeout(2000);
        return true;
      }
    }

    return false;
  }

  /**
   * 重命名当前数据表（侧边栏中的当前选中表）
   */
  async _renameCurrentTable(newName) {
    // 尝试通过右键菜单重命名
    // 查找侧边栏中当前选中的数据表标签
    const tabPos = await this.page.evaluate(() => {
      // 查找侧边栏中的数据表项（通常有 active/selected 样式）
      const items = document.querySelectorAll('[class*="table-item"], [class*="sheet-tab"], [class*="sidebar"] [class*="item"]');
      for (const item of items) {
        const cls = item.className || '';
        if (cls.includes('active') || cls.includes('selected') || cls.includes('current')) {
          const r = item.getBoundingClientRect();
          if (r.width > 0) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
      }
      // 备选：找最后一个数据表项（新建的通常在最后）
      const allItems = document.querySelectorAll('[class*="table-name"], [class*="sheet-name"]');
      if (allItems.length > 0) {
        const last = allItems[allItems.length - 1];
        const r = last.getBoundingClientRect();
        if (r.width > 0) {
          return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
      return null;
    });

    if (tabPos) {
      // 双击触发重命名
      await this.page.mouse.dblclick(tabPos.x, tabPos.y);
      await this.page.waitForTimeout(800);

      // 尝试填写出现的 input
      const filled = await this._fillVisibleInput(newName);
      if (filled) {
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(500);
        return;
      }
    }

    // wiki 嵌入场景：在侧边栏中找到最后一个数据表 tab 并双击重命名
    const wikiTabPos = await this.page.evaluate(() => {
      const items = document.querySelectorAll('.bitable-new-table-tab__item-name');
      if (items.length > 0) {
        const last = items[items.length - 1];
        const r = last.getBoundingClientRect();
        if (r.width > 0 && r.x >= 0) {
          return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
      return null;
    });

    if (wikiTabPos) {
      await this.page.mouse.dblclick(wikiTabPos.x, wikiTabPos.y);
      await this.page.waitForTimeout(800);

      const filled = await this._fillVisibleInput(newName);
      if (filled) {
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(500);
        return;
      }
    }

    // 备选方案：右键菜单 → 重命名
    const renameTarget = tabPos || wikiTabPos;
    if (renameTarget) {
      await this.page.mouse.click(renameTarget.x, renameTarget.y, { button: 'right' });
      await this.page.waitForTimeout(800);
      await this._clickMenuItemByText('重命名');
      await this.page.waitForTimeout(500);
      const filled = await this._fillVisibleInput(newName);
      if (filled) {
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(500);
      }
    }
  }

  // ===================================================================
  //  通用 DOM 交互辅助
  // ===================================================================

  /**
   * 通过可见文本点击元素（叶子节点优先）
   * @returns {boolean} 是否成功点击
   */
  async _clickByText(text) {
    const pos = await this.page.evaluate((target) => {
      // 优先找精确匹配的叶子节点
      for (const el of document.querySelectorAll('span, button, div, a, li')) {
        const elText = el.textContent?.trim();
        if (elText === target || elText === `+ ${target}`) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && el.offsetParent !== null) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
      }
      return null;
    }, text);

    if (pos) {
      await this.page.mouse.click(pos.x, pos.y);
      return true;
    }
    return false;
  }

  /**
   * 在弹出菜单中点击指定文字的菜单项
   */
  async _clickMenuItemByText(text) {
    const pos = await this.page.evaluate((target) => {
      // 查找菜单项
      const menuSelectors = '.b-menu__item, .ud__menu-item, .menu-item, [class*="menu"] [class*="item"], [role="menuitem"]';
      for (const el of document.querySelectorAll(menuSelectors)) {
        if (el.textContent?.trim() === target) {
          const r = el.getBoundingClientRect();
          if (r.width > 0) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
      }
      // 备选：任何可见元素精确匹配
      for (const el of document.querySelectorAll('*')) {
        if (el.textContent?.trim() === target && el.children.length === 0) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
      }
      return null;
    }, text);

    if (pos) {
      await this.page.mouse.click(pos.x, pos.y);
      await this.page.waitForTimeout(800);
      return true;
    }
    return false;
  }

  /**
   * 填写当前页面中第一个可见的 input
   * @returns {boolean}
   */
  async _fillVisibleInput(value) {
    const filled = await this.page.evaluate((val) => {
      const inputs = document.querySelectorAll('input, textarea');
      for (const inp of inputs) {
        const r = inp.getBoundingClientRect();
        if (r.width > 30 && r.height > 0 && inp.offsetParent !== null) {
          inp.focus();
          inp.select();
          const proto = inp.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) {
            setter.call(inp, val);
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return true;
        }
      }
      return false;
    }, value);

    return filled;
  }

  /**
   * 点击"确定"/"确认"按钮
   */
  async _clickConfirmButton() {
    for (const text of ['确定', '确认', '创建', 'OK']) {
      const clicked = await this.page.evaluate((label) => {
        for (const btn of document.querySelectorAll('button, div[role="button"]')) {
          if (btn.textContent?.trim() === label) {
            const r = btn.getBoundingClientRect();
            if (r.width > 0) { btn.click(); return true; }
          }
        }
        return false;
      }, text);
      if (clicked) return true;
    }
    return false;
  }
}
