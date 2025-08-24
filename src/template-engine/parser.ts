import { Template } from "../types";
import logger from "../utils/logger";

export class TemplateParser {
  parse(templateData: any): Template {
    try {
      this.validate(templateData);

      return {
        domain: templateData.domain,
        name: templateData.name,
        version: templateData.version || "1.0.0",
        selectors: templateData.selectors || {},
        extractors: templateData.extractors || {},
        validation: templateData.validation || {},
      };
    } catch (error) {
      logger.error("Failed to parse template:", error);
      throw new Error(`Invalid template format: ${error}`);
    }
  }

  private validate(templateData: any): void {
    if (!templateData.domain) {
      throw new Error("Template must have a domain");
    }

    if (!templateData.name) {
      throw new Error("Template must have a name");
    }

    if (!templateData.selectors || typeof templateData.selectors !== "object") {
      throw new Error("Template must have selectors object");
    }

    if (
      !templateData.extractors ||
      typeof templateData.extractors !== "object"
    ) {
      throw new Error("Template must have extractors object");
    }

    for (const [key, selector] of Object.entries(templateData.selectors)) {
      if (typeof selector !== "string") {
        throw new Error(`Selector ${key} must be a string`);
      }
    }

    for (const [key, extractor] of Object.entries(templateData.extractors)) {
      if (typeof extractor !== "string") {
        throw new Error(`Extractor ${key} must be a string`);
      }
    }
  }

  merge(base: Template, override: Partial<Template>): Template {
    return {
      ...base,
      ...override,
      selectors: {
        ...base.selectors,
        ...(override.selectors || {}),
      },
      extractors: {
        ...base.extractors,
        ...(override.extractors || {}),
      },
      validation: {
        ...base.validation,
        ...(override.validation || {}),
      },
    };
  }

  validateDomain(template: Template, currentDomain: string): boolean {
    if (template.validation?.allowedDomains) {
      return template.validation.allowedDomains.includes(currentDomain);
    }

    const templateDomain = template.domain.replace("www.", "");
    const current = currentDomain.replace("www.", "");

    return current.includes(templateDomain) || templateDomain.includes(current);
  }

  getRequiredFields(template: Template): string[] {
    return (
      template.validation?.requiredFields || Object.keys(template.selectors)
    );
  }

  generateSelectorMap(template: Template): Map<string, string> {
    const map = new Map<string, string>();

    for (const [key, selector] of Object.entries(template.selectors)) {
      map.set(key, selector);
    }

    return map;
  }

  generateExtractorFunction(
    template: Template,
    extractorName: string,
  ): Function | null {
    const extractorCode = template.extractors[extractorName];

    if (!extractorCode) {
      logger.warn(`Extractor ${extractorName} not found in template`);
      return null;
    }

    try {
      return new Function(
        "data",
        "params",
        `
        const { ${Object.keys(template.selectors).join(", ")} } = data;
        return (${extractorCode})(params);
      `,
      );
    } catch (error) {
      logger.error(
        `Failed to generate extractor function ${extractorName}:`,
        error,
      );
      return null;
    }
  }

  serialize(template: Template): string {
    return JSON.stringify(template, null, 2);
  }

  deserialize(templateString: string): Template {
    try {
      const data = JSON.parse(templateString);
      return this.parse(data);
    } catch (error) {
      throw new Error(`Failed to deserialize template: ${error}`);
    }
  }
}
