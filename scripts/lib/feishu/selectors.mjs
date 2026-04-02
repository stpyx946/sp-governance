/**
 * 飞书选择器集中管理（Fallback 链）
 * 每个选择器是一个数组，按优先级排列
 */
export const selectors = {
  login: {
    phoneInput: [
      '[data-testid="phone-input"]',
      'input[placeholder*="手机号"]',
      'input[type="tel"]',
    ],
    passwordInput: [
      '[data-testid="password-input"]',
      'input[type="password"]',
    ],
    loginButton: [
      '[data-testid="login-btn"]',
      'button:has-text("登录")',
      'button[type="submit"]',
    ],
    qrCode: [
      '[data-testid="qr-code"]',
      '[class*="qrcode"]',
      'img[alt*="二维码"]',
    ],
  },
  doc: {
    editor: [
      '[data-testid="doc-editor"]',
      '[contenteditable="true"]',
      '[class*="doc-editor"] [contenteditable]',
      '[class*="editor-container"] [contenteditable]',
    ],
    titleInput: [
      '[data-testid="doc-title"]',
      '[placeholder*="无标题"]',
      '[class*="title"] [contenteditable]',
      '[class*="doc-title"]',
    ],
    newDocButton: [
      '[data-testid="new-doc-btn"]',
      'button:has-text("新建文档")',
      '[class*="create"] button',
    ],
  },
  wiki: {
    createNode: [
      '[data-testid="wiki-create"]',
      'button:has-text("创建")',
      '[class*="wiki"] button:has-text("新建")',
    ],
    sidebar: [
      '[data-testid="wiki-sidebar"]',
      '[class*="wiki-sidebar"]',
      '[class*="tree-container"]',
    ],
  },
  drive: {
    searchInput: [
      '[data-testid="search-input"]',
      'input[placeholder*="搜索"]',
      '[class*="search"] input',
    ],
    newButton: [
      'div.styles__Desc-dIrOoD:text("新建文档开始协作")',
      ':text("新建文档开始协作")',
      'div.workspace-next-layout-btn-wrapper:has-text("新建")',
    ],
    newDocOption: [
      'li.ud__menu-item:has-text("文档")',
      'li.explorer-upload-create-menu-item:has-text("文档")',
      'li:has-text("文档")',
    ],
    folderList: [
      '[data-testid="folder-list"]',
      '[class*="folder-list"]',
      '[class*="file-list"]',
    ],
  },
  bitable: {
    newBitableOption: [
      'li.ud__menu-item:has-text("多维表格")',
      'li:has-text("多维表格")',
      '[class*="menu-item"]:has-text("多维表格")',
    ],
    gridView: [
      '[class*="grid-view"]',
      '[class*="bitable-grid"]',
      '.bitable-body',
    ],
    fieldHeader: [
      '.bi-field-header',
      '[class*="field-header"]',
      '[class*="column-header"]',
    ],
    addFieldButton: [
      '.bi-field-add-btn',
      '[class*="add-field"]',
      'button:has-text("+")',
    ],
    addRowButton: [
      '.bi-row-add-btn',
      '[class*="add-record"]',
      'button:has-text("添加记录")',
      ':text("添加记录")',
    ],
    cellEditor: [
      '[class*="cell-editor"]',
      '[class*="cell"] [contenteditable="true"]',
      '[class*="cell-input"]',
    ],
    fieldTypeMenu: [
      '[class*="field-type-menu"]',
      '[class*="type-selector"]',
      '.ud__select-dropdown',
    ],
    fieldNameInput: [
      '[class*="field-name"] input',
      '[class*="field-editor"] input',
      'input[placeholder*="输入字段名"]',
    ],
  },
  common: {
    modalClose: [
      '[data-testid="modal-close"]',
      'button[aria-label="关闭"]',
      '[class*="modal"] [class*="close"]',
      '[class*="dialog"] button:has-text("关闭")',
    ],
    toast: [
      '[class*="toast"]',
      '[class*="message"]',
      '[role="alert"]',
    ],
    guideMask: [
      '[class*="guide-mask"]',
      '[class*="onboarding"]',
      '[class*="novice-guide"]',
    ],
  },
};

/**
 * 使用 Fallback 链查找元素
 */
export async function findElement(page, selectorChain, options = {}) {
  const { timeout = 10000 } = options;
  const perSelectorTimeout = Math.max(timeout / selectorChain.length, 2000);

  for (const selector of selectorChain) {
    try {
      const el = await page.waitForSelector(selector, { timeout: perSelectorTimeout, state: 'visible' });
      if (el) return el;
    } catch {
      continue;
    }
  }
  throw new Error(`所有选择器均失败: ${JSON.stringify(selectorChain)}`);
}

/**
 * 尝试关闭弹窗/引导浮层
 */
export async function dismissPopups(page) {
  const popupSelectors = [
    ...selectors.common.modalClose,
    ...selectors.common.guideMask,
    'button:has-text("我知道了")',
    'button:has-text("跳过")',
    'button:has-text("稍后")',
  ];

  for (const selector of popupSelectors) {
    try {
      const el = await page.$(selector);
      if (el && await el.isVisible()) {
        await el.click();
        await page.waitForTimeout(500);
      }
    } catch {
      // ignore
    }
  }
}
