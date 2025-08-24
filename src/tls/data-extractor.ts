import { Page } from "puppeteer";
import { ExtractedData } from "../types";
import logger from "../utils/logger";

export class DataExtractor {
  private page: Page | null = null;

  async attachToPage(page: Page): Promise<void> {
    this.page = page;
  }

  async extractData(selectors: Record<string, string>): Promise<ExtractedData> {
    if (!this.page) {
      throw new Error("No page attached");
    }

    const url = this.page.url();
    const domain = new URL(url).hostname;
    const raw: Record<string, string> = {};
    const processed: Record<string, any> = {};

    for (const [key, selector] of Object.entries(selectors)) {
      try {
        const value = await this.extractBySelector(selector);
        raw[key] = value;
        processed[key] = this.processValue(key, value);
      } catch (_error) {
        logger.error(`Failed to extract data for ${key}:`, _error);
        raw[key] = "";
        processed[key] = null;
      }
    }

    return {
      raw,
      processed,
      timestamp: Date.now(),
      url,
      domain,
    };
  }

  private async extractBySelector(selector: string): Promise<string> {
    if (!this.page) {
      throw new Error("No page attached");
    }

    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });

      const value = await this.page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (!element) return "";

        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement
        ) {
          return element.value;
        }

        return element.textContent?.trim() || "";
      }, selector);

      return value;
    } catch (_error) {
      logger.warn(`Selector ${selector} not found or timed out`);
      return "";
    }
  }

  private processValue(key: string, value: string): any {
    if (!value) return null;

    if (
      key.toLowerCase().includes("amount") ||
      key.toLowerCase().includes("balance") ||
      key.toLowerCase().includes("price")
    ) {
      return this.parseAmount(value);
    }

    if (
      key.toLowerCase().includes("date") ||
      key.toLowerCase().includes("time")
    ) {
      return this.parseDate(value);
    }

    if (
      key.toLowerCase().includes("count") ||
      key.toLowerCase().includes("number") ||
      key.toLowerCase().includes("followers") ||
      key.toLowerCase().includes("likes")
    ) {
      return this.parseNumber(value);
    }

    return value;
  }

  private parseAmount(value: string): number {
    const cleaned = value.replace(/[^0-9.,\-]/g, "").replace(/,/g, "");

    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  }

  private parseDate(value: string): Date | null {
    try {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  private parseNumber(value: string): number {
    value = value.toLowerCase();

    let multiplier = 1;
    if (value.includes("k")) {
      multiplier = 1000;
      value = value.replace("k", "");
    } else if (value.includes("m")) {
      multiplier = 1000000;
      value = value.replace("m", "");
    } else if (value.includes("b")) {
      multiplier = 1000000000;
      value = value.replace("b", "");
    }

    const cleaned = value.replace(/[^0-9.\-]/g, "");
    const number = parseFloat(cleaned) * multiplier;

    return isNaN(number) ? 0 : Math.floor(number);
  }

  async extractWithCustomLogic(
    extractorFunction: string,
    context?: Record<string, any>,
  ): Promise<any> {
    if (!this.page) {
      throw new Error("No page attached");
    }

    try {
      const result = await this.page.evaluate(
        (funcStr, ctx) => {
          try {
            const func = new Function(
              "context",
              `return (${funcStr})(context)`,
            );
            return func(ctx);
          } catch (_error) {
            console.error("Custom extractor error:", _error);
            return null;
          }
        },
        extractorFunction,
        context || {},
      );

      return result;
    } catch (_error) {
      logger.error("Failed to execute custom extractor:", _error);
      return null;
    }
  }

  async extractAllText(): Promise<string> {
    if (!this.page) {
      throw new Error("No page attached");
    }

    return await this.page.evaluate(() => {
      return document.body.innerText || "";
    });
  }

  async extractMetadata(): Promise<Record<string, string>> {
    if (!this.page) {
      throw new Error("No page attached");
    }

    return await this.page.evaluate(() => {
      const metadata: Record<string, string> = {};

      const title = document.querySelector("title");
      if (title) metadata.title = title.textContent || "";

      const metaTags = document.querySelectorAll("meta");
      metaTags.forEach((tag) => {
        const name = tag.getAttribute("name") || tag.getAttribute("property");
        const content = tag.getAttribute("content");

        if (name && content) {
          metadata[name] = content;
        }
      });

      return metadata;
    });
  }

  async takeScreenshot(): Promise<Buffer> {
    if (!this.page) {
      throw new Error("No page attached");
    }

    const screenshot = await this.page.screenshot({
      fullPage: false,
      type: "png",
    });

    return Buffer.from(screenshot);
  }
}
