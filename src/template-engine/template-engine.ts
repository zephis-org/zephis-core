import { Template } from "../types";
import { TemplateParser } from "./parser";
import { TemplateLoader } from "./template-loader";
import { TemplateValidator } from "./validator";
import { ExtractorEngine } from "./extractor-engine";
import logger from "../utils/logger";

export class TemplateEngine {
  private parser: TemplateParser;
  private loader: TemplateLoader;
  private validator: TemplateValidator;
  private extractorEngine: ExtractorEngine;
  private templates: Map<string, Template> = new Map();

  constructor() {
    this.parser = new TemplateParser();
    this.loader = new TemplateLoader();
    this.validator = new TemplateValidator();
    this.extractorEngine = new ExtractorEngine();
  }

  async loadTemplate(templateData: any): Promise<Template> {
    try {
      // Parse the template
      const template = this.parser.parse(templateData);

      // Validate the template
      const validation = this.validator.validateTemplate(template);
      if (!validation.valid) {
        throw new Error(`Invalid template: ${validation.errors.join(", ")}`);
      }

      // Store the template
      const templateId = this.generateTemplateId(template);
      this.templates.set(templateId, template);

      logger.info(`Template loaded: ${template.name} (${templateId})`);
      return template;
    } catch (error) {
      logger.error("Failed to load template:", error);
      throw new Error(`Failed to load template: ${error}`);
    }
  }

  async loadFromFile(filePath: string): Promise<Template> {
    const template = await this.loader.loadFromFile(filePath);
    return this.loadTemplate(template);
  }

  async loadFromUrl(url: string): Promise<Template> {
    const template = await this.loader.loadFromUrl(url);
    return this.loadTemplate(template);
  }

  getTemplate(templateId: string): Template | null {
    return this.templates.get(templateId) || null;
  }

  listTemplates(): Array<{ id: string; name: string; domain: string }> {
    return Array.from(this.templates.entries()).map(([id, template]) => ({
      id,
      name: template.name,
      domain: template.domain,
    }));
  }

  async extractData(
    templateId: string,
    pageContent: string,
    options?: { sanitize?: boolean },
  ): Promise<Record<string, any>> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    try {
      // Extract data using selectors
      const extractedData = await this.extractorEngine.extract(
        pageContent,
        template.selectors,
      );

      // Apply extractors if defined
      if (template.extractors && Object.keys(template.extractors).length > 0) {
        for (const [name, _extractorCode] of Object.entries(
          template.extractors,
        )) {
          const extractorFunc = this.parser.generateExtractorFunction(
            template,
            name,
          );
          if (extractorFunc) {
            extractedData[name] = extractorFunc(extractedData, {});
          }
        }
      }

      // Sanitize data if requested
      if (options?.sanitize) {
        return this.validator.sanitizeData(extractedData);
      }

      return extractedData;
    } catch (error) {
      logger.error(
        `Failed to extract data with template ${templateId}:`,
        error,
      );
      throw error;
    }
  }

  validateData(data: Record<string, any>, templateId: string): boolean {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const validation = this.validator.validateData(data, template);
    return validation.valid;
  }

  validateDomain(templateId: string, currentDomain: string): boolean {
    const template = this.templates.get(templateId);
    if (!template) {
      return false;
    }

    return this.parser.validateDomain(template, currentDomain);
  }

  private generateTemplateId(template: Template): string {
    return `${template.domain.replace(/\./g, "_")}_${template.name.toLowerCase().replace(/\s+/g, "_")}`;
  }

  clearTemplates(): void {
    this.templates.clear();
  }

  removeTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  exportTemplate(templateId: string): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    return this.parser.serialize(template);
  }

  importTemplate(templateString: string): Template {
    const template = this.parser.deserialize(templateString);
    const templateId = this.generateTemplateId(template);
    this.templates.set(templateId, template);
    return template;
  }
}
