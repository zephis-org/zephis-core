import fs from "fs/promises";
import path from "path";
import { Template } from "../types";
import { TemplateParser } from "./parser";
import { TemplateValidator } from "./validator";
import logger from "../utils/logger";

export class TemplateLoader {
  private templates: Map<string, Template> = new Map();
  private parser: TemplateParser;
  private validator: TemplateValidator;
  private templateDir: string;

  constructor(templateDir?: string) {
    this.parser = new TemplateParser();
    this.validator = new TemplateValidator();
    this.templateDir = templateDir || path.join(process.cwd(), "templates");
  }

  async loadTemplate(name: string): Promise<Template> {
    if (this.templates.has(name)) {
      return this.templates.get(name)!;
    }

    try {
      const templatePath = path.join(this.templateDir, `${name}.json`);
      const templateData = await fs.readFile(templatePath, "utf-8");
      const templateJson = JSON.parse(templateData);

      const validation = this.validator.validateTemplate(templateJson);
      if (!validation.valid) {
        throw new Error(
          `Template validation failed: ${validation.errors?.join(", ")}`,
        );
      }

      const template = this.parser.parse(templateJson);
      this.templates.set(name, template);

      logger.info(`Template loaded: ${name}`);
      return template;
    } catch (error) {
      logger.error(`Failed to load template ${name}:`, error);
      throw error;
    }
  }

  async loadAllTemplates(): Promise<Map<string, Template>> {
    try {
      const files = await fs.readdir(this.templateDir);
      const templateFiles = files.filter((file) => file.endsWith(".json"));

      for (const file of templateFiles) {
        const name = file.replace(".json", "");
        try {
          await this.loadTemplate(name);
        } catch (error) {
          logger.warn(`Skipping invalid template ${name}:`, error);
        }
      }

      logger.info(`Loaded ${this.templates.size} templates`);
      return this.templates;
    } catch (error) {
      logger.error("Failed to load templates:", error);
      return this.templates;
    }
  }

  async saveTemplate(name: string, template: Template): Promise<void> {
    try {
      const validation = this.validator.validateTemplate(template);
      if (!validation.valid) {
        throw new Error(
          `Template validation failed: ${validation.errors?.join(", ")}`,
        );
      }

      const templatePath = path.join(this.templateDir, `${name}.json`);
      const templateData = this.parser.serialize(template);

      await fs.writeFile(templatePath, templateData, "utf-8");
      this.templates.set(name, template);

      logger.info(`Template saved: ${name}`);
    } catch (error) {
      logger.error(`Failed to save template ${name}:`, error);
      throw error;
    }
  }

  async deleteTemplate(name: string): Promise<void> {
    try {
      const templatePath = path.join(this.templateDir, `${name}.json`);
      await fs.unlink(templatePath);
      this.templates.delete(name);

      logger.info(`Template deleted: ${name}`);
    } catch (error) {
      logger.error(`Failed to delete template ${name}:`, error);
      throw error;
    }
  }

  getTemplate(name: string): Template | undefined {
    return this.templates.get(name);
  }

  getTemplateForDomain(domain: string): Template | undefined {
    for (const template of this.templates.values()) {
      if (this.parser.validateDomain(template, domain)) {
        return template;
      }
    }
    return undefined;
  }

  listTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  clearCache(): void {
    this.templates.clear();
  }

  async reloadTemplates(): Promise<void> {
    this.clearCache();
    await this.loadAllTemplates();
  }

  async exportTemplate(name: string, outputPath: string): Promise<void> {
    const template = this.templates.get(name);
    if (!template) {
      throw new Error(`Template ${name} not found`);
    }

    const templateData = this.parser.serialize(template);
    await fs.writeFile(outputPath, templateData, "utf-8");

    logger.info(`Template ${name} exported to ${outputPath}`);
  }

  async importTemplate(inputPath: string, name?: string): Promise<void> {
    try {
      const templateData = await fs.readFile(inputPath, "utf-8");
      const templateJson = JSON.parse(templateData);

      const validation = this.validator.validateTemplate(templateJson);
      if (!validation.valid) {
        throw new Error(
          `Template validation failed: ${validation.errors?.join(", ")}`,
        );
      }

      const template = this.parser.parse(templateJson);
      const templateName =
        name || template.name.toLowerCase().replace(/\s+/g, "-");

      await this.saveTemplate(templateName, template);

      logger.info(`Template imported: ${templateName}`);
    } catch (error) {
      logger.error(`Failed to import template from ${inputPath}:`, error);
      throw error;
    }
  }

  async loadFromFile(filePath: string): Promise<any> {
    try {
      const templateData = await fs.readFile(filePath, "utf-8");
      const templateJson = JSON.parse(templateData);

      const validation = this.validator.validateTemplate(templateJson);
      if (!validation.valid) {
        throw new Error(
          `Template validation failed: ${validation.errors?.join(", ")}`,
        );
      }

      logger.info(`Template loaded from file: ${filePath}`);
      return templateJson;
    } catch (error) {
      logger.error(`Failed to load template from ${filePath}:`, error);
      throw error;
    }
  }

  async loadFromUrl(url: string): Promise<any> {
    try {
      // For now, throw an error as URL loading is not implemented
      // In a real implementation, you'd use fetch or similar
      throw new Error(`URL loading not implemented yet: ${url}`);
    } catch (error) {
      logger.error(`Failed to load template from ${url}:`, error);
      throw error;
    }
  }
}
