import { Page } from "puppeteer";
import logger from "../utils/logger";

export class SelectorEngine {
  private page: Page | null = null;
  private cache: Map<string, any> = new Map();

  async attachToPage(page: Page): Promise<void> {
    this.page = page;
    this.cache.clear();
  }

  async selectSingle(selector: string): Promise<string | null> {
    if (!this.page) {
      throw new Error("No page attached");
    }

    const cacheKey = `single:${selector}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const result = await this.page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (!element) return null;

        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
        ) {
          return element.value;
        }

        if (element instanceof HTMLImageElement) {
          return element.src;
        }

        if (element instanceof HTMLAnchorElement) {
          return element.href;
        }

        return element.textContent?.trim() || null;
      }, selector);

      this.cache.set(cacheKey, result);
      return result;
    } catch (_error) {
      logger.error(`Error selecting single element with ${selector}:`, _error);
      return null;
    }
  }

  async selectMultiple(selector: string): Promise<string[]> {
    if (!this.page) {
      throw new Error("No page attached");
    }

    const cacheKey = `multiple:${selector}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const results = await this.page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        return Array.from(elements).map((element) => {
          if (
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement ||
            element instanceof HTMLSelectElement
          ) {
            return element.value;
          }

          if (element instanceof HTMLImageElement) {
            return element.src;
          }

          if (element instanceof HTMLAnchorElement) {
            return element.href;
          }

          return element.textContent?.trim() || "";
        });
      }, selector);

      this.cache.set(cacheKey, results);
      return results;
    } catch (_error) {
      logger.error(
        `Error selecting multiple elements with ${selector}:`,
        _error,
      );
      return [];
    }
  }

  async selectAttribute(
    selector: string,
    attribute: string,
  ): Promise<string | null> {
    if (!this.page) {
      throw new Error("No page attached");
    }

    const cacheKey = `attribute:${selector}:${attribute}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const result = await this.page.evaluate(
        (sel, attr) => {
          const element = document.querySelector(sel);
          return element ? element.getAttribute(attr) : null;
        },
        selector,
        attribute,
      );

      this.cache.set(cacheKey, result);
      return result;
    } catch (_error) {
      logger.error(
        `Error selecting attribute ${attribute} from ${selector}:`,
        _error,
      );
      return null;
    }
  }

  async exists(selector: string): Promise<boolean> {
    if (!this.page) {
      throw new Error("No page attached");
    }

    try {
      const element = await this.page.$(selector);
      return element !== null;
    } catch (_error) {
      logger.error(`Error checking if selector exists ${selector}:`, _error);
      return false;
    }
  }

  async waitForSelector(
    selector: string,
    options?: { timeout?: number; visible?: boolean },
  ): Promise<boolean> {
    if (!this.page) {
      throw new Error("No page attached");
    }

    try {
      await this.page.waitForSelector(selector, {
        timeout: options?.timeout || 30000,
        visible: options?.visible,
      });
      return true;
    } catch (_error) {
      logger.warn(`Timeout waiting for selector ${selector}`);
      return false;
    }
  }

  async selectWithXPath(xpath: string): Promise<string | null> {
    if (!this.page) {
      throw new Error("No page attached");
    }

    try {
      const result = await this.page.evaluate((xp) => {
        const xpath = document.evaluate(
          xp,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null,
        );
        const el = xpath.singleNodeValue;
        if (!el) return null;

        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement
        ) {
          return el.value;
        }
        return (el as HTMLElement).textContent?.trim() || null;
      }, xpath);

      return result;
    } catch (_error) {
      logger.error(`Error selecting with XPath ${xpath}:`, _error);
      return null;
    }
  }

  async selectTable(selector: string): Promise<any[][]> {
    if (!this.page) {
      throw new Error("No page attached");
    }

    try {
      const table = await this.page.evaluate((sel) => {
        const tableElement = document.querySelector(sel);
        if (!tableElement || !(tableElement instanceof HTMLTableElement)) {
          return [];
        }

        const rows = Array.from(tableElement.rows);
        return rows.map((row) =>
          Array.from(row.cells).map((cell) => cell.textContent?.trim() || ""),
        );
      }, selector);

      return table;
    } catch (_error) {
      logger.error(`Error selecting table ${selector}:`, _error);
      return [];
    }
  }

  async selectJSON(selector: string): Promise<any | null> {
    if (!this.page) {
      throw new Error("No page attached");
    }

    try {
      const text = await this.selectSingle(selector);
      if (!text) return null;

      return JSON.parse(text);
    } catch (_error) {
      logger.error(`Error parsing JSON from ${selector}:`, _error);
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
