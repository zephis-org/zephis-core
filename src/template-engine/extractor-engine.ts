import * as cheerio from "cheerio";
import logger from "../utils/logger";

export class ExtractorEngine {
  async extract(
    pageContent: string,
    selectors: Record<string, string>,
  ): Promise<Record<string, any>> {
    try {
      const $ = cheerio.load(pageContent);
      const extractedData: Record<string, any> = {};

      for (const [field, selector] of Object.entries(selectors)) {
        try {
          const value = await this.extractValue($, selector);
          extractedData[field] = value;
        } catch (error) {
          logger.warn(
            `Failed to extract field ${field} with selector ${selector}:`,
            error,
          );
          extractedData[field] = null;
        }
      }

      return extractedData;
    } catch (error) {
      logger.error("Failed to extract data:", error);
      throw new Error(`Extraction failed: ${error}`);
    }
  }

  private async extractValue(
    $: any,
    selector: string,
  ): Promise<string | null> {
    // Handle XPath selectors
    if (selector.startsWith("//") || selector.startsWith("/")) {
      return this.extractXPath($, selector);
    }

    // Handle CSS selectors
    const element = $(selector);

    if (element.length === 0) {
      return null;
    }

    // Try different extraction methods
    let value = element.text().trim();

    if (!value) {
      value = element.val() as string;
    }

    if (!value) {
      value = element.attr("value") || "";
    }

    if (!value) {
      value = element.attr("data-value") || "";
    }

    if (!value) {
      value = element.attr("content") || "";
    }

    return value || null;
  }

  private extractXPath($: any, xpath: string): string | null {
    // Simplified XPath support - convert common patterns to CSS
    let cssSelector = xpath;

    // Convert simple XPath to CSS
    cssSelector = cssSelector
      .replace(/^\/\//, "")
      .replace(/\//g, " > ")
      .replace(/\[@([^=]+)='([^']+)'\]/g, '[$1="$2"]')
      .replace(/\[@([^=]+)="([^"]+)"\]/g, '[$1="$2"]')
      .replace(/\[(\d+)\]/g, ":nth-child($1)");

    const element = $(cssSelector);
    return element.length > 0 ? element.text().trim() : null;
  }

  async extractMultiple(
    pageContent: string,
    selector: string,
    fields: string[],
  ): Promise<Array<Record<string, any>>> {
    try {
      const $ = cheerio.load(pageContent);
      const elements = $(selector);
      const results: Array<Record<string, any>> = [];

      elements.each((_index, element) => {
        const item: Record<string, any> = {};
        const $el = $(element);

        for (const field of fields) {
          item[field] =
            $el.find(field).text().trim() || $el.attr(field) || null;
        }

        results.push(item);
      });

      return results;
    } catch (error) {
      logger.error("Failed to extract multiple items:", error);
      throw error;
    }
  }

  async extractTable(
    pageContent: string,
    tableSelector: string,
    options?: {
      headers?: boolean;
      skipRows?: number;
      maxRows?: number;
    },
  ): Promise<Array<Array<string>>> {
    try {
      const $ = cheerio.load(pageContent);
      const table = $(tableSelector);
      const rows: Array<Array<string>> = [];

      if (table.length === 0) {
        return rows;
      }

      const allRows = table.find("tr");
      const startIndex = options?.skipRows || 0;
      const maxRows = options?.maxRows || allRows.length;

      allRows.slice(startIndex, startIndex + maxRows).each((_index, row) => {
        const cells: string[] = [];
        $(row)
          .find("td, th")
          .each((_cellIndex, cell) => {
            cells.push($(cell).text().trim());
          });

        if (cells.length > 0) {
          rows.push(cells);
        }
      });

      return rows;
    } catch (error) {
      logger.error("Failed to extract table:", error);
      throw error;
    }
  }

  async extractForm(
    pageContent: string,
    formSelector: string,
  ): Promise<Record<string, any>> {
    try {
      const $ = cheerio.load(pageContent);
      const form = $(formSelector);
      const formData: Record<string, any> = {};

      if (form.length === 0) {
        return formData;
      }

      // Extract form action and method
      formData.action = form.attr("action") || "";
      formData.method = form.attr("method") || "GET";
      formData.fields = {};

      // Extract input fields
      form.find("input, select, textarea").each((_index, element) => {
        const $el = $(element);
        const name = $el.attr("name");

        if (name) {
          const type = $el.attr("type") || "text";
          const value = $el.val() || $el.attr("value") || "";

          formData.fields[name] = {
            type,
            value,
            required: $el.attr("required") !== undefined,
            placeholder: $el.attr("placeholder") || "",
          };
        }
      });

      return formData;
    } catch (error) {
      logger.error("Failed to extract form:", error);
      throw error;
    }
  }

  async extractMetadata(pageContent: string): Promise<Record<string, string>> {
    try {
      const $ = cheerio.load(pageContent);
      const metadata: Record<string, string> = {};

      // Extract title
      metadata.title = $("title").text() || "";

      // Extract meta tags
      $("meta").each((_index, element) => {
        const $el = $(element);
        const name = $el.attr("name") || $el.attr("property");
        const content = $el.attr("content");

        if (name && content) {
          metadata[name] = content;
        }
      });

      // Extract OpenGraph tags
      $('meta[property^="og:"]').each((_index, element) => {
        const $el = $(element);
        const property = $el.attr("property");
        const content = $el.attr("content");

        if (property && content) {
          metadata[property] = content;
        }
      });

      return metadata;
    } catch (error) {
      logger.error("Failed to extract metadata:", error);
      throw error;
    }
  }

  async extractLinks(
    pageContent: string,
    options?: {
      absolute?: boolean;
      internal?: boolean;
      external?: boolean;
    },
  ): Promise<string[]> {
    try {
      const $ = cheerio.load(pageContent);
      const links: string[] = [];

      $("a[href]").each((_index, element) => {
        const href = $(element).attr("href");

        if (href) {
          const isExternal =
            href.startsWith("http://") || href.startsWith("https://");
          const isInternal = !isExternal;

          if (options?.internal && !isInternal) return;
          if (options?.external && !isExternal) return;

          links.push(href);
        }
      });

      return links;
    } catch (error) {
      logger.error("Failed to extract links:", error);
      throw error;
    }
  }

  async extractImages(
    pageContent: string,
  ): Promise<Array<{ src: string; alt: string }>> {
    try {
      const $ = cheerio.load(pageContent);
      const images: Array<{ src: string; alt: string }> = [];

      $("img").each((_index, element) => {
        const $el = $(element);
        const src = $el.attr("src");

        if (src) {
          images.push({
            src,
            alt: $el.attr("alt") || "",
          });
        }
      });

      return images;
    } catch (error) {
      logger.error("Failed to extract images:", error);
      throw error;
    }
  }
}
