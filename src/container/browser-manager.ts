import puppeteer, { Browser, Page } from "puppeteer";
import { EventEmitter } from "events";
import { BrowserConfig } from "../types";
import logger from "../utils/logger";

export class BrowserManager extends EventEmitter {
  private browsers: Map<string, Browser> = new Map();
  private pages: Map<string, Page> = new Map();
  private config: BrowserConfig;

  constructor(config?: Partial<BrowserConfig>) {
    super();
    this.config = {
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--allow-running-insecure-content",
        "--disable-blink-features=AutomationControlled",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      ],
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
      timeout: 300000,
      ...config,
    };
  }

  async createBrowser(sessionId: string): Promise<Browser> {
    try {
      logger.info(`Creating browser for session ${sessionId}`);

      const browser = await puppeteer.launch({
        headless: this.config.headless,
        args: this.config.args,
        defaultViewport: this.config.defaultViewport,
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
      });

      this.browsers.set(sessionId, browser);

      const page = await browser.newPage();
      await this.configurePage(page);
      this.pages.set(sessionId, page);

      this.emit("browser:created", { sessionId, browser });

      return browser;
    } catch (error) {
      logger.error(`Failed to create browser for session ${sessionId}:`, error);
      throw error;
    }
  }

  private async configurePage(page: Page): Promise<void> {
    await page.setDefaultTimeout(this.config.timeout);

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });

      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === "notifications"
          ? Promise.resolve({
              state: "prompt",
              onchange: null,
            } as PermissionStatus)
          : originalQuery(parameters);
    });

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    page.on("console", (msg) => {
      logger.debug(`Browser console [${msg.type()}]: ${msg.text()}`);
    });

    page.on("error", (error) => {
      logger.error("Browser error:", error);
    });

    page.on("pageerror", (error) => {
      logger.error("Page error:", error);
    });
  }

  async navigateTo(sessionId: string, url: string): Promise<void> {
    const page = this.pages.get(sessionId);
    if (!page) {
      throw new Error(`No page found for session ${sessionId}`);
    }

    logger.info(`Navigating to ${url} for session ${sessionId}`);
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: this.config.timeout,
    });
  }

  async waitForSelector(
    sessionId: string,
    selector: string,
    timeout?: number,
  ): Promise<void> {
    const page = this.pages.get(sessionId);
    if (!page) {
      throw new Error(`No page found for session ${sessionId}`);
    }

    await page.waitForSelector(selector, {
      timeout: timeout || this.config.timeout,
    });
  }

  async extractData(
    sessionId: string,
    selectors: Record<string, string>,
  ): Promise<Record<string, string>> {
    const page = this.pages.get(sessionId);
    if (!page) {
      throw new Error(`No page found for session ${sessionId}`);
    }

    const data: Record<string, string> = {};

    for (const [key, selector] of Object.entries(selectors)) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await page.evaluate(
            (el) => el.textContent?.trim() || "",
            element,
          );
          data[key] = text;
        } else {
          logger.warn(`Selector not found: ${selector}`);
          data[key] = "";
        }
      } catch (error) {
        logger.error(`Error extracting data for selector ${selector}:`, error);
        data[key] = "";
      }
    }

    return data;
  }

  async injectTLSInterceptor(sessionId: string): Promise<void> {
    const page = this.pages.get(sessionId);
    if (!page) {
      throw new Error(`No page found for session ${sessionId}`);
    }

    await page.evaluateOnNewDocument(() => {
      const originalFetch = window.fetch;
      (window as any).__tlsData = [];

      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        (window as any).__tlsData.push({
          url: args[0],
          timestamp: Date.now(),
          headers: response.headers,
        });
        return response;
      };
    });
  }

  async destroyBrowser(sessionId: string): Promise<void> {
    try {
      const browser = this.browsers.get(sessionId);
      if (browser) {
        await browser.close();
        this.browsers.delete(sessionId);
        this.pages.delete(sessionId);
        this.emit("browser:destroyed", { sessionId });
        logger.info(`Browser destroyed for session ${sessionId}`);
      }
    } catch (error) {
      logger.error(`Error destroying browser for session ${sessionId}:`, error);
      // Even if close fails, remove from maps to prevent memory leaks
      this.browsers.delete(sessionId);
      this.pages.delete(sessionId);
    }
  }

  async destroyAll(): Promise<void> {
    const promises = Array.from(this.browsers.keys()).map((sessionId) =>
      this.destroyBrowser(sessionId),
    );
    await Promise.all(promises);
  }

  getPage(sessionId: string): Page | undefined {
    return this.pages.get(sessionId);
  }

  getBrowser(sessionId: string): Browser | undefined {
    return this.browsers.get(sessionId);
  }
}
