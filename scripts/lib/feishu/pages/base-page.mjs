import { findElement, dismissPopups } from '../selectors.mjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class BasePage {
  constructor(page) {
    this.page = page;
  }

  async navigateTo(url) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.page.waitForTimeout(2000);
    await dismissPopups(this.page);
  }

  async find(selectorChain, options) {
    return findElement(this.page, selectorChain, options);
  }

  async screenshot(name) {
    const dir = path.join(__dirname, '..', '..', 'output');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${name}-${Date.now()}.png`);
    await this.page.screenshot({ path: filePath, fullPage: true });
    return filePath;
  }

  async withRetry(fn, { maxRetries = 2, delay = 1000 } = {}) {
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries) {
          await this.screenshot('retry-failed');
          throw error;
        }
        await this.page.waitForTimeout(delay * (i + 1));
      }
    }
  }

  async scrollToBottom() {
    let prevHeight = 0;
    for (let i = 0; i < 50; i++) {
      const height = await this.page.evaluate(() => document.body.scrollHeight);
      if (height === prevHeight) break;
      prevHeight = height;
      await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.page.waitForTimeout(500);
    }
  }
}
