#!/usr/bin/env node
/**
 * 飞书多维表格统一管理脚本
 *
 * 用法:
 *   node scripts/feishu/bitable-manager.mjs --action <action> [options]
 *
 * Actions:
 *   open          打开已有多维表格
 *   create        创建新多维表格
 *   add-fields    为已有表格添加字段
 *   fill-data     填充数据行
 *   add-subtable  添加子数据表
 *   add-view      添加视图（看板/甘特图）
 *   link-fields   创建关联字段（跨表关联）
 *   full-setup    完整设置：创建/打开 + 字段 + 数据 + 子表 + 视图
 *
 * Options:
 *   --url <url>           多维表格 URL（open/add-fields/fill-data 必需）
 *   --title <title>       表格标题（create 时使用）
 *   --project <id>        从 config/projects.json 读取项目 URL
 *   --data-file <path>    JSON 数据文件路径
 *   --template <name>     使用 templates/bitable/ 中的模板
 *   --user <user>         飞书用户标识（默认 default）
 *   --help                显示帮助信息
 *
 * 示例:
 *   # 用模板完整创建
 *   node scripts/feishu/bitable-manager.mjs --action full-setup --url "https://..." --template project-board
 *
 *   # 打开已有表格并添加字段
 *   node scripts/feishu/bitable-manager.mjs --action add-fields --url "https://..." --data-file ./fields.json
 *
 *   # 从项目配置读取 URL
 *   node scripts/feishu/bitable-manager.mjs --action full-setup --project 3d模型站项目-20260329 --template project-board
 */

import { createBrowserContext, isLoginValid, wrapFeishuOperation } from '../lib/feishu/browser-manager.mjs';
import { FeishuBitablePage } from '../lib/feishu/pages/feishu-bitable-page.mjs';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../..');

// ===== 参数解析 =====

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      params.help = true;
      continue;
    }
    if (args[i].startsWith('--') && i + 1 < args.length) {
      const key = args[i].replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      params[key] = args[++i];
    }
  }
  return params;
}

function showHelp() {
  console.log(`
飞书多维表格统一管理脚本

用法: node scripts/feishu/bitable-manager.mjs --action <action> [options]

Actions:
  open          打开已有多维表格
  create        创建新多维表格
  add-fields    为已有表格添加字段
  fill-data     填充数据行
  add-subtable  添加子数据表
  add-view      添加视图
  rename-table  重命名数据表
  delete-view   删除视图
  rename-title  重命名标题
  link-fields   创建关联字段（跨表关联）
  full-setup    完整设置（字段 + 数据 + 子表 + 视图）

Options:
  --url <url>           多维表格 URL
  --title <title>       表格标题（create 时使用）
  --project <id>        从 config/projects.json 读取项目 URL
  --data-file <path>    JSON 数据文件
  --template <name>     使用预设模板（templates/bitable/）
  --user <user>         飞书用户标识（默认 default）
  --view-type <type>    视图类型：看板 / 甘特图
  --subtable <name>     子表名称
  --old-name <name>     旧数据表名称（rename-table）
  --new-name <name>     新数据表名称（rename-table）
  --view-name <name>    视图名称（delete-view）
  --title <title>       新标题（rename-title）
  --help                显示帮助
  `.trim());
}

// ===== 数据加载 =====

function loadTemplate(name) {
  const templatePath = resolve(ROOT_DIR, 'templates', 'bitable', `${name}.json`);
  if (!existsSync(templatePath)) {
    throw new Error(`模板不存在: ${templatePath}`);
  }
  return JSON.parse(readFileSync(templatePath, 'utf-8'));
}

function loadDataFile(filePath) {
  const absPath = resolve(filePath);
  if (!existsSync(absPath)) {
    throw new Error(`数据文件不存在: ${absPath}`);
  }
  return JSON.parse(readFileSync(absPath, 'utf-8'));
}

function resolveUrl(params) {
  if (params.url) return params.url;

  if (params.project) {
    const projectsPath = resolve(ROOT_DIR, 'config', 'projects.json');
    if (existsSync(projectsPath)) {
      const config = JSON.parse(readFileSync(projectsPath, 'utf-8'));
      const project = config.projects.find(p => p.id === params.project || p.name === params.project);
      if (project?.urls?.bitable) return project.urls.bitable;
    }
    throw new Error(`项目 "${params.project}" 未找到或无 bitable URL`);
  }

  return null;
}

// ===== Action 处理 =====

async function actionOpen(bitablePage, url) {
  console.log(`Opening bitable: ${url}`);
  return await bitablePage.openBitable(url);
}

async function actionCreate(bitablePage, params, data) {
  const title = params.title || data?.name || '未命名多维表格';
  const mainTable = data?.tables?.[0];
  const fields = mainTable?.fields || data?.fields || [];
  const rows = mainTable?.sampleRows || data?.rows || [];

  console.log(`Creating bitable: "${title}" (${fields.length} fields, ${rows.length} rows)`);
  return await bitablePage.createBitable(title, fields, rows);
}

async function actionAddFields(bitablePage, url, data) {
  console.log(`Adding fields to: ${url}`);
  await bitablePage.openBitable(url);
  const mainTable = data?.tables?.[0];
  const fields = mainTable?.fields || data?.fields || [];
  await bitablePage.setupFields(fields);
  return { url, fieldsAdded: fields.length };
}

async function actionFillData(bitablePage, url, data) {
  console.log(`Filling data to: ${url}`);
  await bitablePage.openBitable(url);
  const mainTable = data?.tables?.[0];
  const fields = mainTable?.fields || data?.fields || [];
  const rows = mainTable?.sampleRows || data?.rows || [];
  await bitablePage.fillRows(fields, rows);
  return { url, rowsFilled: rows.length };
}

async function actionAddSubtable(bitablePage, url, subtableDef) {
  console.log(`Adding subtable "${subtableDef.name}" to: ${url}`);
  await bitablePage.openBitable(url);
  await bitablePage.addSubtable(
    subtableDef.name,
    subtableDef.fields || [],
    subtableDef.sampleRows || subtableDef.rows || []
  );
  return { url, subtable: subtableDef.name };
}

// 视图类型映射：模板中的简称 → 飞书 UI 中的完整名称
const VIEW_TYPE_MAP = {
  '看板': '看板视图',
  '甘特图': '甘特视图',
  '表格': '表格视图',
  '日历': '日历视图',
  '画册': '画册视图',
};

async function actionAddView(bitablePage, url, viewType, viewName) {
  const uiType = VIEW_TYPE_MAP[viewType] || viewType;
  console.log(`Adding view "${viewType}" → "${uiType}" to: ${url}`);
  await bitablePage.openBitable(url);
  await bitablePage._closeBitableSidebar();
  await bitablePage.addView(uiType, viewName);
  return { url, view: uiType };
}

async function actionFullSetup(bitablePage, params, data) {
  const url = resolveUrl(params);
  let currentUrl = url;
  const isNewBitable = !currentUrl;

  // 主表数据
  const mainTable = data?.tables?.[0];
  if (!mainTable) {
    throw new Error('模板或数据文件中未定义 tables');
  }

  // Step 1: 打开已有表格 或 创建新表格
  if (currentUrl) {
    console.log('\n[1/5] Opening existing bitable...');
    await bitablePage.openBitable(currentUrl);
  } else {
    console.log('\n[1/5] Creating new bitable...');
    // 先创建空白表格，标题在 Step 5 单独设置（createBitable 的 setTitle 在字段配置前调用可能被覆盖）
    const result = await bitablePage.createBitable('', [], []);
    currentUrl = result.url;
    console.log('  URL:', currentUrl);
  }

  // Step 2: 配置主表字段 + 数据
  await bitablePage._closeBitableSidebar();

  if (mainTable.fields?.length > 0) {
    console.log(`\n[2/5] Setting up fields (${mainTable.fields.length})...`);
    await bitablePage.setupFields(mainTable.fields);
  }
  if (mainTable.sampleRows?.length > 0) {
    console.log(`\n[2/5] Filling data (${mainTable.sampleRows.length} rows)...`);
    await bitablePage.fillRows(mainTable.fields, mainTable.sampleRows);
  }

  // Step 3: 创建子数据表
  const subtables = data?.tables?.slice(1) || [];
  if (subtables.length > 0) {
    console.log(`\n[3/5] Creating ${subtables.length} subtables...`);
    for (const sub of subtables) {
      await bitablePage.addSubtable(sub.name, sub.fields || [], sub.sampleRows || []);
    }
  } else {
    console.log('\n[3/5] No subtables to create.');
  }

  // Step 4: 创建视图（切换回主表后操作）
  const views = mainTable.views || [];
  if (views.length > 0) {
    console.log(`\n[4/5] Creating ${views.length} views...`);

    // 关闭任何打开的记录卡片和弹窗
    await bitablePage._closeRecordCard();
    await bitablePage._dismissUnsavedDialog();
    await bitablePage.page.waitForTimeout(500);

    // 切换回主表（如果创建了子表，需要切回第一个数据表）
    if (subtables.length > 0) {
      console.log('  Switching back to main table...');
      await bitablePage.switchToTableByIndex(0);
      await bitablePage.page.waitForTimeout(1000);
    }

    for (const view of views) {
      const uiType = VIEW_TYPE_MAP[view.type] || view.type;
      console.log(`  Adding view: ${view.type} → ${uiType} (${view.name})`);
      await bitablePage.addView(uiType, view.name);
    }
  } else {
    console.log('\n[4/5] No views to create.');
  }

  // Step 5: 设置标题
  const targetTitle = params.title || data?.name;
  if (targetTitle) {
    console.log(`\n[5/5] Setting title to "${targetTitle}"...`);
    await bitablePage.setTitle(targetTitle);
  } else {
    console.log('\n[5/5] No title specified, skipping.');
  }

  return { url: bitablePage.page.url(), tables: data.tables.map(t => t.name), views: views.map(v => v.name) };
}

async function actionRenameTable(bitablePage, url, oldName, newName) {
  console.log(`Renaming table "${oldName}" to "${newName}" in: ${url}`);
  await bitablePage.openBitable(url);
  await bitablePage.renameTable(oldName, newName);
  return { url, oldName, newName };
}

async function actionDeleteView(bitablePage, url, viewName) {
  console.log(`Deleting view "${viewName}" from: ${url}`);
  await bitablePage.openBitable(url);
  await bitablePage.deleteView(viewName);
  return { url, viewName };
}

async function actionRenameTitle(bitablePage, url, title) {
  console.log(`Setting title to "${title}" for: ${url}`);
  await bitablePage.openBitable(url);
  await bitablePage.setTitle(title);
  return { url, title };
}

async function actionLinkFields(bitablePage, url, data) {
  const links = data?.links || [];
  if (links.length === 0) throw new Error('links 数组为空');

  console.log(`Creating ${links.length} link field(s) in: ${url}`);
  await bitablePage.openBitable(url);

  let created = 0;
  for (const link of links) {
    const { table, field, linkedTable } = link;
    if (!field || typeof field !== 'string' || !linkedTable || typeof linkedTable !== 'string') {
      console.log(`  Skipping invalid link config: ${JSON.stringify(link)}`);
      continue;
    }
    if (table) {
      console.log(`  Switching to table: "${table}"`);
      const switched = await bitablePage.switchToTable(table);
      if (!switched) {
        console.log(`  Warning: Could not switch to table "${table}", skipping`);
        continue;
      }
    }
    console.log(`  Adding link field: "${field}" → "${linkedTable}"`);
    await bitablePage.setupFields([{ name: field, type: 'link', linkedTable }]);
    created++;
    await bitablePage.page.waitForTimeout(500);
  }
  return { url, linksCreated: created, linksTotal: links.length };
}

// ===== 主流程 =====

const params = parseArgs();

if (params.help) {
  showHelp();
  process.exit(0);
}

const action = params.action;
if (!action) {
  console.error('Error: --action 参数必填。使用 --help 查看帮助。');
  process.exit(1);
}

wrapFeishuOperation(`bitable_${action}`, async () => {
  // 加载数据
  let data = null;
  if (params.template) {
    data = loadTemplate(params.template);
  } else if (params.dataFile) {
    data = loadDataFile(params.dataFile);
  }

  // 创建浏览器
  const user = params.user || 'default';
  const { browser, context } = await createBrowserContext({ user });

  try {
    const page = await context.newPage();

    // 检查登录态
    if (!(await isLoginValid(page, user))) {
      throw new Error(`登录态已过期，请运行: node scripts/feishu/feishu-login.mjs ${user}`);
    }

    const bitablePage = new FeishuBitablePage(page, user);
    let result;

    switch (action) {
      case 'open': {
        const url = resolveUrl(params);
        if (!url) throw new Error('--url 或 --project 参数必填');
        result = await actionOpen(bitablePage, url);
        break;
      }
      case 'create': {
        result = await actionCreate(bitablePage, params, data);
        break;
      }
      case 'add-fields': {
        const url = resolveUrl(params);
        if (!url) throw new Error('--url 或 --project 参数必填');
        if (!data) throw new Error('--template 或 --data-file 参数必填');
        result = await actionAddFields(bitablePage, url, data);
        break;
      }
      case 'fill-data': {
        const url = resolveUrl(params);
        if (!url) throw new Error('--url 或 --project 参数必填');
        if (!data) throw new Error('--template 或 --data-file 参数必填');
        result = await actionFillData(bitablePage, url, data);
        break;
      }
      case 'add-subtable': {
        const url = resolveUrl(params);
        if (!url) throw new Error('--url 或 --project 参数必填');
        const subtableName = params.subtable;
        if (!subtableName && !data) throw new Error('--subtable 或 --data-file/--template 参数必填');
        let subtableDef;
        if (data) {
          subtableDef = data.tables?.find(t => t.name === subtableName) || data.tables?.[1];
        } else {
          subtableDef = { name: subtableName, fields: [], sampleRows: [] };
        }
        if (!subtableDef) throw new Error('未找到子表定义');
        result = await actionAddSubtable(bitablePage, url, subtableDef);
        break;
      }
      case 'add-view': {
        const url = resolveUrl(params);
        if (!url) throw new Error('--url 或 --project 参数必填');
        const viewType = params.viewType || '看板';
        result = await actionAddView(bitablePage, url, viewType, params.viewName);
        break;
      }
      case 'rename-table': {
        const url = resolveUrl(params);
        if (!url) throw new Error('--url 或 --project 参数必填');
        if (!params.oldName) throw new Error('--old-name 参数必填');
        if (!params.newName) throw new Error('--new-name 参数必填');
        result = await actionRenameTable(bitablePage, url, params.oldName, params.newName);
        break;
      }
      case 'delete-view': {
        const url = resolveUrl(params);
        if (!url) throw new Error('--url 或 --project 参数必填');
        if (!params.viewName) throw new Error('--view-name 参数必填');
        result = await actionDeleteView(bitablePage, url, params.viewName);
        break;
      }
      case 'rename-title': {
        const url = resolveUrl(params);
        if (!url) throw new Error('--url 或 --project 参数必填');
        if (!params.title) throw new Error('--title 参数必填');
        result = await actionRenameTitle(bitablePage, url, params.title);
        break;
      }
      case 'link-fields': {
        const url = resolveUrl(params);
        if (!url) throw new Error('--url 或 --project 参数必填');
        if (!data) throw new Error('--data-file 参数必填（需包含 links 数组）');
        result = await actionLinkFields(bitablePage, url, data);
        break;
      }
      case 'full-setup': {
        if (!data) throw new Error('--template 或 --data-file 参数必填');
        result = await actionFullSetup(bitablePage, params, data);
        break;
      }
      default:
        throw new Error(`未知 action: ${action}。使用 --help 查看可用 actions。`);
    }

    console.log('\nDone!', JSON.stringify(result, null, 2));
    return result;
  } finally {
    await browser.close();
  }
});
