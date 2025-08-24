import { Template, ExtractedData } from "../types";
import {
  CircuitMapper,
  TemplateCircuitConfig,
} from "../circuits/generators/circuit-mapper";
import logger from "../utils/logger";

export interface TemplateCircuitMapping {
  templateName: string;
  domain: string;
  circuitConfigs: TemplateCircuitConfig[];
  claimMappings: Record<string, ClaimMapping>;
}

export interface ClaimMapping {
  circuitConfig: TemplateCircuitConfig;
  inputMappings: Record<string, string>;
  validationRules: ValidationRule[];
}

export interface ValidationRule {
  field: string;
  type: "required" | "numeric" | "pattern" | "range";
  constraint?: any;
  errorMessage: string;
}

export class TemplateCircuitMapper {
  private circuitMapper: CircuitMapper;
  private templateMappings: Map<string, TemplateCircuitMapping> = new Map();

  constructor() {
    this.circuitMapper = new CircuitMapper();
  }

  /**
   * Registers a template's circuit configuration
   */
  registerTemplate(template: Template): void {
    logger.info(`Registering circuit mapping for template: ${template.name}`);

    const circuitConfig = this.extractCircuitConfig(template);
    const claimMappings = this.buildClaimMappings(template, circuitConfig);

    const templateMapping: TemplateCircuitMapping = {
      templateName: template.name,
      domain: template.domain,
      circuitConfigs: [circuitConfig], // Can support multiple configs per template
      claimMappings,
    };

    this.templateMappings.set(template.domain, templateMapping);
    logger.info(`Template circuit mapping registered: ${template.name}`);
  }

  /**
   * Gets the circuit configuration for a specific template and claim
   */
  getCircuitConfig(
    templateDomain: string,
    claim: string,
  ): TemplateCircuitConfig | null {
    const mapping = this.templateMappings.get(templateDomain);
    if (!mapping) {
      logger.warn(`No circuit mapping found for domain: ${templateDomain}`);
      return null;
    }

    const claimMapping = mapping.claimMappings[claim];
    if (!claimMapping) {
      logger.warn(
        `No circuit mapping found for claim: ${claim} on domain: ${templateDomain}`,
      );
      return null;
    }

    return claimMapping.circuitConfig;
  }

  /**
   * Validates extracted data against template's circuit requirements
   */
  validateDataForCircuit(
    templateDomain: string,
    claim: string,
    extractedData: ExtractedData,
    _params: Record<string, any> = {},
  ): { isValid: boolean; errors: string[] } {
    const mapping = this.templateMappings.get(templateDomain);
    if (!mapping) {
      return { isValid: false, errors: ["Template mapping not found"] };
    }

    const claimMapping = mapping.claimMappings[claim];
    if (!claimMapping) {
      return { isValid: false, errors: ["Claim mapping not found"] };
    }

    const errors: string[] = [];

    // Validate against defined rules
    for (const rule of claimMapping.validationRules) {
      const error = this.validateRule(rule, extractedData, _params);
      if (error) {
        errors.push(error);
      }
    }

    // Additional circuit-specific validations
    const circuitErrors = this.validateCircuitConstraints(
      claimMapping.circuitConfig,
      extractedData,
      _params,
    );
    errors.push(...circuitErrors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generates circuit input using the template-specific mapping
   */
  generateCircuitInput(
    template: Template,
    extractedData: ExtractedData,
    tlsData: any,
    claim: string,
    _params: Record<string, any> = {},
  ) {
    const circuitConfig = this.getCircuitConfig(template.domain, claim);
    if (!circuitConfig) {
      throw new Error(
        `No circuit configuration found for ${template.domain}:${claim}`,
      );
    }

    // Use the base circuit mapper with template-specific configuration
    return this.circuitMapper.convertToCircuitInput(
      template,
      extractedData,
      tlsData,
      claim,
      _params,
    );
  }

  /**
   * Extracts circuit configuration from template JSON
   */
  private extractCircuitConfig(template: Template): TemplateCircuitConfig {
    const templateAny = template as any;

    if (templateAny.circuitConfig) {
      return {
        dataType: templateAny.circuitConfig.dataType || "numeric",
        claimType: templateAny.circuitConfig.claimType || "comparison",
        maxDataLength: templateAny.circuitConfig.maxDataLength || 32,
      };
    }

    // Fallback to default configuration
    return {
      dataType: "numeric",
      claimType: "comparison",
      maxDataLength: 32,
    };
  }

  /**
   * Builds claim mappings from template configuration
   */
  private buildClaimMappings(
    template: Template,
    baseConfig: TemplateCircuitConfig,
  ): Record<string, ClaimMapping> {
    const mappings: Record<string, ClaimMapping> = {};
    const templateAny = template as any;

    if (templateAny.circuitConfig?.supportedClaims) {
      for (const claimDef of templateAny.circuitConfig.supportedClaims) {
        const claimConfig: TemplateCircuitConfig = {
          dataType: claimDef.dataType || baseConfig.dataType,
          claimType: claimDef.claimType || baseConfig.claimType,
          maxDataLength: claimDef.maxDataLength || baseConfig.maxDataLength,
        };

        const validationRules = this.generateValidationRules(claimDef);
        const inputMappings = this.generateInputMappings(
          template,
          claimDef.name,
        );

        mappings[claimDef.name] = {
          circuitConfig: claimConfig,
          inputMappings,
          validationRules,
        };
      }
    } else {
      // Generate mappings from extractors for backward compatibility
      for (const extractorName of Object.keys(template.extractors)) {
        const claimConfig = this.inferConfigFromExtractor(
          extractorName,
          baseConfig,
        );
        const validationRules =
          this.generateValidationRulesFromExtractor(extractorName);
        const inputMappings = this.generateInputMappings(
          template,
          extractorName,
        );

        mappings[extractorName] = {
          circuitConfig: claimConfig,
          inputMappings,
          validationRules,
        };
      }
    }

    return mappings;
  }

  /**
   * Generates validation rules from claim definition
   */
  private generateValidationRules(claimDef: any): ValidationRule[] {
    const rules: ValidationRule[] = [];

    // Common validation rules based on claim type
    switch (claimDef.claimType) {
      case "comparison":
        if (claimDef.dataType === "numeric") {
          rules.push({
            field: "actualValue",
            type: "numeric",
            errorMessage: "Value must be numeric for comparison",
          });
        }
        break;

      case "existence":
        rules.push({
          field: "actualValue",
          type: "required",
          errorMessage: "Value must exist for existence check",
        });
        break;

      case "pattern":
        if (claimDef.pattern) {
          rules.push({
            field: "actualValue",
            type: "pattern",
            constraint: claimDef.pattern,
            errorMessage: "Value does not match required pattern",
          });
        }
        break;
    }

    // Add specific validation rules if defined
    if (claimDef.validation) {
      for (const validationRule of claimDef.validation) {
        rules.push(validationRule);
      }
    }

    return rules;
  }

  /**
   * Generates validation rules from extractor names (backward compatibility)
   */
  private generateValidationRulesFromExtractor(
    extractorName: string,
  ): ValidationRule[] {
    const rules: ValidationRule[] = [];

    if (
      extractorName.includes("GreaterThan") ||
      extractorName.includes("MinimumBalance")
    ) {
      rules.push({
        field: "actualValue",
        type: "numeric",
        errorMessage: "Numeric value required for comparison",
      });
    }

    if (extractorName.startsWith("has") || extractorName.startsWith("is")) {
      rules.push({
        field: "actualValue",
        type: "required",
        errorMessage: "Value must exist for boolean check",
      });
    }

    return rules;
  }

  /**
   * Generates input mappings for circuit inputs
   */
  private generateInputMappings(
    template: Template,
    claimName: string,
  ): Record<string, string> {
    const mappings: Record<string, string> = {};

    // Map template selectors to circuit inputs based on claim type
    switch (claimName) {
      case "balanceGreaterThan":
      case "hasMinimumBalance":
        mappings.balance = "balance";
        mappings.availableBalance = "availableBalance";
        break;

      case "followersGreaterThan":
      case "isInfluencer":
        mappings.followers = "followers";
        break;

      case "hasVerifiedBadge":
        mappings.verifiedBadge = "verifiedBadge";
        break;

      case "isVerifiedAccount":
        mappings.accountStatus = "accountStatus";
        break;

      case "hasRecentActivity":
      case "hasRecentTransaction":
        mappings.lastActivity = "lastActivity";
        mappings.lastTransactionDate = "lastTransactionDate";
        break;

      case "currencyCheck":
        mappings.currency = "currency";
        mappings.primaryCurrency = "primaryCurrency";
        break;

      default:
        // Generic mapping - map all selectors
        for (const selectorName of Object.keys(template.selectors)) {
          mappings[selectorName] = selectorName;
        }
    }

    return mappings;
  }

  /**
   * Infers circuit configuration from extractor name
   */
  private inferConfigFromExtractor(
    extractorName: string,
    baseConfig: TemplateCircuitConfig,
  ): TemplateCircuitConfig {
    let dataType: "numeric" | "string" | "boolean" = "numeric";
    let claimType: "comparison" | "existence" | "pattern" = "comparison";

    if (
      extractorName.includes("GreaterThan") ||
      extractorName.includes("Balance")
    ) {
      dataType = "numeric";
      claimType = "comparison";
    } else if (
      extractorName.startsWith("has") ||
      extractorName.startsWith("is")
    ) {
      dataType = "boolean";
      claimType = "existence";
    } else if (
      extractorName.includes("Check") &&
      extractorName.includes("currency")
    ) {
      dataType = "string";
      claimType = "pattern";
    }

    return {
      dataType,
      claimType,
      maxDataLength: baseConfig.maxDataLength,
    };
  }

  /**
   * Validates a single rule against extracted data
   */
  private validateRule(
    rule: ValidationRule,
    extractedData: ExtractedData,
    _params: Record<string, any>,
  ): string | null {
    const value =
      extractedData.processed[rule.field] || extractedData.raw[rule.field];

    switch (rule.type) {
      case "required":
        if (value === undefined || value === null || value === "") {
          return rule.errorMessage;
        }
        break;

      case "numeric":
        if (
          typeof value !== "number" &&
          (typeof value !== "string" || isNaN(Number(value)))
        ) {
          return rule.errorMessage;
        }
        break;

      case "pattern":
        if (rule.constraint && typeof value === "string") {
          const regex = new RegExp(rule.constraint);
          if (!regex.test(value)) {
            return rule.errorMessage;
          }
        }
        break;

      case "range":
        if (rule.constraint && typeof value === "number") {
          const { min, max } = rule.constraint;
          if (
            (min !== undefined && value < min) ||
            (max !== undefined && value > max)
          ) {
            return rule.errorMessage;
          }
        }
        break;
    }

    return null;
  }

  /**
   * Validates circuit-specific constraints
   */
  private validateCircuitConstraints(
    config: TemplateCircuitConfig,
    extractedData: ExtractedData,
    _params: Record<string, any>,
  ): string[] {
    const errors: string[] = [];

    // Check data length constraints
    const dataString = JSON.stringify(extractedData.processed);
    if (dataString.length > config.maxDataLength * 4) {
      // Rough estimate for UTF-8 encoding
      errors.push(
        `Data size exceeds maximum length for circuit: ${config.maxDataLength}`,
      );
    }

    // Type-specific validations
    switch (config.dataType) {
      case "numeric":
        // Ensure numeric fields are actually numeric
        for (const [key, value] of Object.entries(extractedData.processed)) {
          if (
            typeof value === "string" &&
            value.match(/[0-9.,]+/) &&
            isNaN(Number(value.replace(/[,]/g, "")))
          ) {
            errors.push(
              `Field ${key} appears to be numeric but cannot be parsed`,
            );
          }
        }
        break;

      case "boolean":
        // Check for boolean-like values
        const hasBoolean = Object.values(extractedData.processed).some(
          (value) =>
            typeof value === "boolean" ||
            value === "true" ||
            value === "false" ||
            value === 1 ||
            value === 0,
        );
        if (!hasBoolean) {
          errors.push("No boolean values found for boolean circuit type");
        }
        break;
    }

    return errors;
  }

  /**
   * Gets all registered templates
   */
  getRegisteredTemplates(): string[] {
    return Array.from(this.templateMappings.keys());
  }

  /**
   * Gets supported claims for a template
   */
  getSupportedClaims(templateDomain: string): string[] {
    const mapping = this.templateMappings.get(templateDomain);
    return mapping ? Object.keys(mapping.claimMappings) : [];
  }

  /**
   * Clears all template mappings (useful for testing)
   */
  clearMappings(): void {
    this.templateMappings.clear();
    logger.info("All template circuit mappings cleared");
  }
}
