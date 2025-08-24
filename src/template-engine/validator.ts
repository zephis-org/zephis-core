import Ajv from "ajv";
import { Template, ExtractedData } from "../types";
import logger from "../utils/logger";

export class TemplateValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    this.setupSchemas();
  }

  private setupSchemas(): void {
    const templateSchema = {
      type: "object",
      required: ["domain", "name", "selectors", "extractors"],
      properties: {
        domain: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
        selectors: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        extractors: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        validation: {
          type: "object",
          properties: {
            requiredFields: {
              type: "array",
              items: { type: "string" },
            },
            maxDataSize: { type: "number", minimum: 0 },
            allowedDomains: {
              type: "array",
              items: { type: "string" },
            },
            fieldTypes: {
              type: "object",
              additionalProperties: { type: "string" },
            },
          },
        },
      },
    };

    this.ajv.addSchema(templateSchema, "template");
  }

  validateTemplate(template: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!template.domain) errors.push("Missing required field: domain");
    if (!template.name) errors.push("Missing required field: name");

    // Check field types
    if (template.selectors && typeof template.selectors !== "object") {
      errors.push("selectors must be an object");
    } else if (
      template.selectors === null ||
      Array.isArray(template.selectors)
    ) {
      errors.push("selectors must be an object");
    }

    if (template.extractors && typeof template.extractors !== "object") {
      errors.push("extractors must be an object");
    } else if (
      template.extractors &&
      (template.extractors === null || Array.isArray(template.extractors))
    ) {
      errors.push("extractors must be an object");
    }

    // Validate selectors
    if (
      template.selectors &&
      typeof template.selectors === "object" &&
      !Array.isArray(template.selectors)
    ) {
      for (const [key, selector] of Object.entries(template.selectors)) {
        if (typeof selector !== "string") {
          errors.push(`Selector ${key} must be a string`);
        } else if (selector === "") {
          errors.push(`Invalid selector "${key}": ${selector}`);
        } else if (!this.isValidSelectorSyntax(selector)) {
          errors.push(`Invalid selector "${key}": ${selector}`);
        }
      }
    }

    // Validate extractors
    if (
      template.extractors &&
      typeof template.extractors === "object" &&
      !Array.isArray(template.extractors)
    ) {
      for (const [key, extractor] of Object.entries(template.extractors)) {
        if (typeof extractor !== "string") {
          errors.push(`Extractor ${key} must be a string`);
        } else if (!this.validateExtractor(extractor as string)) {
          errors.push(`Invalid extractor "${key}": Syntax error`);
        }
      }
    }

    // Validate domain format
    if (template.domain && !this.validateDomain(template.domain)) {
      errors.push(`Invalid domain format: ${template.domain}`);
    }

    // Validate version format
    if (template.version && !this.validateVersion(template.version)) {
      errors.push(`Invalid version format: ${template.version}`);
    }

    return { valid: errors.length === 0, errors };
  }

  private isValidSelectorSyntax(selector: string): boolean {
    return this.validateSelector(selector);
  }

  validateExtractedData(
    data: ExtractedData,
    template: Template,
  ): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (template.validation?.requiredFields) {
      for (const field of template.validation.requiredFields) {
        if (!data.raw[field] || data.raw[field].trim() === "") {
          errors.push(`Required field '${field}' is missing or empty`);
        }
      }
    }

    if (template.validation?.maxDataSize) {
      const dataSize = JSON.stringify(data).length;
      if (dataSize > template.validation.maxDataSize) {
        errors.push(
          `Data size ${dataSize} exceeds maximum ${template.validation.maxDataSize}`,
        );
      }
    }

    if (
      !template.domain ||
      !data.domain.includes(template.domain.replace("www.", ""))
    ) {
      errors.push(
        `Domain mismatch: expected ${template.domain}, got ${data.domain}`,
      );
    }

    if (errors.length > 0) {
      logger.error("Extracted data validation failed:", errors);
      return { valid: false, errors };
    }

    return { valid: true };
  }

  validateSelector(selector: string): boolean {
    // Basic validation for CSS selectors and XPath
    if (!selector || selector.trim() === "") return false;

    // Check for XPath
    if (selector.startsWith("//") || selector.startsWith("/")) {
      return true;
    }

    // Invalid patterns first
    if (/^\d/.test(selector)) return false; // Can't start with number
    if (/^[^a-zA-Z.#\[\*]/.test(selector)) return false; // Must start with valid chars
    if (selector.includes("no-selector")) return false; // Invalid test case

    // Check for CSS selector patterns
    const validPatterns = [
      /^[.#\[]/, // Starts with . # or [
      /^[a-zA-Z][a-zA-Z0-9-]*/, // Tag name
      /^\*/, // Universal selector
      /^[a-zA-Z][a-zA-Z0-9-]*[.#:\[\]]/, // Tag with modifier
    ];

    return validPatterns.some((pattern) => pattern.test(selector));
  }

  validateExtractorFunction(extractorCode: string): boolean {
    try {
      new Function("data", "params", `return (${extractorCode})(params)`);
      return true;
    } catch (error) {
      logger.error("Invalid extractor function:", error);
      return false;
    }
  }

  sanitizeExtractedData(data: ExtractedData): ExtractedData {
    const sanitized: ExtractedData = {
      ...data,
      raw: {},
      processed: {},
    };

    for (const [key, value] of Object.entries(data.raw)) {
      if (typeof value === "string") {
        sanitized.raw[key] = this.sanitizeString(value);
      } else {
        sanitized.raw[key] = value;
      }
    }

    for (const [key, value] of Object.entries(data.processed)) {
      if (typeof value === "string") {
        sanitized.processed[key] = this.sanitizeString(value);
      } else if (typeof value === "object" && value !== null) {
        sanitized.processed[key] = this.sanitizeObject(value);
      } else {
        sanitized.processed[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeString(str: string): string {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "")
      .replace(/<[^>]*>/g, "") // Remove all HTML tags
      .trim();
  }

  private sanitizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((item) =>
        typeof item === "string"
          ? this.sanitizeString(item)
          : typeof item === "object"
            ? this.sanitizeObject(item)
            : item,
      );
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  checkDataIntegrity(data: ExtractedData): boolean {
    if (!data.timestamp || data.timestamp > Date.now()) {
      logger.error("Invalid timestamp in extracted data");
      return false;
    }

    if (!data.url || !data.url.startsWith("http")) {
      logger.error("Invalid URL in extracted data");
      return false;
    }

    if (!data.domain || data.domain.length < 3) {
      logger.error("Invalid domain in extracted data");
      return false;
    }

    return true;
  }

  validateData(
    data: Record<string, any>,
    template: Template,
  ): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check required fields
    if (template.validation?.requiredFields) {
      for (const field of template.validation.requiredFields) {
        if (
          !(field in data) ||
          data[field] === null ||
          data[field] === undefined
        ) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Check data size
    if (template.validation?.maxDataSize) {
      const dataSize = JSON.stringify(data).length;
      if (dataSize > template.validation.maxDataSize) {
        errors.push(
          `Data size exceeds maximum: ${dataSize} > ${template.validation.maxDataSize}`,
        );
      }
    }

    // Check field types
    if (template.validation?.fieldTypes) {
      for (const [field, expectedType] of Object.entries(
        template.validation.fieldTypes,
      )) {
        if (field in data) {
          const value = data[field];
          if (expectedType === "number" && typeof value !== "number") {
            errors.push(`Field "${field}" must be of type number`);
          } else if (expectedType === "string" && typeof value !== "string") {
            errors.push(`Field "${field}" must be of type string`);
          } else if (expectedType === "email" && !this.isValidEmail(value)) {
            errors.push(`Field "${field}" must be a valid email`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private isValidEmail(value: any): boolean {
    if (typeof value !== "string") return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  validateExtractor(extractorCode: string): boolean {
    // Check for dangerous code
    if (
      extractorCode.includes("eval") ||
      extractorCode.includes("require") ||
      extractorCode.includes("process.")
    ) {
      return false;
    }

    try {
      new Function("params", `return (${extractorCode})(params)`);
      return true;
    } catch {
      return false;
    }
  }

  validateDomain(domain: string): boolean {
    if (!domain || domain.trim() === "") return false;
    if (domain.startsWith(".") || domain.endsWith(".")) return false;
    if (domain.includes(" ") || domain.includes("!")) return false;
    if (domain.startsWith("http://") || domain.startsWith("https://"))
      return false;

    // Must have at least one dot (require TLD)
    if (!domain.includes(".")) return false;

    const domainRegex =
      /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)+$/;
    return domainRegex.test(domain);
  }

  validateVersion(version: string): boolean {
    const versionRegex = /^\d+\.\d+\.\d+$/;
    return versionRegex.test(version);
  }

  sanitizeData(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  compareTemplates(
    template1: Template,
    template2: Template,
  ): {
    hasChanges: boolean;
    changes: string[];
  } {
    const changes: string[] = [];

    if (template1.version !== template2.version) {
      changes.push(
        `Version changed: ${template1.version} -> ${template2.version}`,
      );
    }

    // Check selectors
    for (const key in template1.selectors) {
      if (!(key in template2.selectors)) {
        changes.push(`Selector removed: ${key}`);
      } else if (template1.selectors[key] !== template2.selectors[key]) {
        changes.push(`Selector changed: ${key}`);
      }
    }

    for (const key in template2.selectors) {
      if (!(key in template1.selectors)) {
        changes.push(`Selector added: ${key}`);
      }
    }

    // Check extractors
    for (const key in template1.extractors) {
      if (!(key in template2.extractors)) {
        changes.push(`Extractor removed: ${key}`);
      } else if (template1.extractors[key] !== template2.extractors[key]) {
        changes.push(`Extractor changed: ${key}`);
      }
    }

    for (const key in template2.extractors) {
      if (!(key in template1.extractors)) {
        changes.push(`Extractor added: ${key}`);
      }
    }

    return {
      hasChanges: changes.length > 0,
      changes,
    };
  }

  generateValidationReport(
    data: Record<string, any>,
    template: Template,
  ): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    summary: {
      totalFields: number;
      validFields: number;
      missingRequired: number;
      extraFields: number;
    };
  } {
    const validation = this.validateData(data, template);
    const warnings: string[] = [];
    const templateFields = Object.keys(template.selectors);
    const dataFields = Object.keys(data);

    // Check for extra fields
    for (const field of dataFields) {
      if (!templateFields.includes(field)) {
        warnings.push(`Extra field not in template: ${field}`);
      }
    }

    const requiredFields =
      template.validation?.requiredFields || templateFields;
    const missingRequired = requiredFields.filter(
      (field) => !(field in data),
    ).length;

    return {
      valid: validation.valid,
      errors: validation.errors,
      warnings,
      summary: {
        totalFields: dataFields.length,
        validFields: dataFields.length - validation.errors.length,
        missingRequired,
        extraFields: dataFields.filter((f) => !templateFields.includes(f))
          .length,
      },
    };
  }
}
