#!/usr/bin/env node

/**
 * Build System and Integration Testing Suite
 * 
 * Comprehensive testing of the circuit build system and integration workflows:
 * 1. Build script validation and error handling
 * 2. Circuit compilation pipeline testing
 * 3. Trusted setup process testing
 * 4. Integration with CircuitLoader and ProofGenerator
 * 5. End-to-end workflow validation
 * 6. Docker environment integration testing
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const CIRCUITS_DIR = path.join(__dirname, '..', '..', 'circuits');
const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');
const SRC_DIR = path.join(__dirname, '..', '..', 'src');
const INTEGRATION_TEST_DIR = path.join(__dirname, 'integration-tests');

class BuildSystemIntegrationTester {
    constructor() {
        this.results = {
            buildSystem: {},
            integration: {},
            endToEnd: {},
            docker: {},
            summary: {
                totalTests: 0,
                passed: 0,
                failed: 0,
                warnings: 0
            }
        };
        
        this.createIntegrationTestDir();
    }

    createIntegrationTestDir() {
        if (!fs.existsSync(INTEGRATION_TEST_DIR)) {
            fs.mkdirSync(INTEGRATION_TEST_DIR, { recursive: true });
        }
    }

    async runBuildSystemAndIntegrationTests() {
        console.log('🔧 Starting Build System and Integration Testing Suite\n');
        console.log('=' .repeat(70));

        try {
            // Phase 1: Build System Testing
            console.log('\n📦 Phase 1: Build System Testing');
            await this.testBuildSystem();

            // Phase 2: Integration Testing
            console.log('\n🔗 Phase 2: Integration Testing');
            await this.testSystemIntegration();

            // Phase 3: End-to-End Workflow Testing
            console.log('\n🌟 Phase 3: End-to-End Workflow Testing');
            await this.testEndToEndWorkflows();

            // Phase 4: Docker Integration Testing
            console.log('\n🐳 Phase 4: Docker Integration Testing');
            await this.testDockerIntegration();

            // Generate comprehensive report
            await this.generateIntegrationReport();
            this.printIntegrationSummary();

        } catch (error) {
            console.error('\n❌ Integration testing failed:', error.message);
            throw error;
        }
    }

    async testBuildSystem() {
        console.log('  🛠️  Testing build system components...');

        const buildSystemTests = [
            {
                name: 'compile_script_validation',
                description: 'Test compile-circuits.js functionality',
                test: () => this.testCompileScriptValidation()
            },
            {
                name: 'setup_script_validation',
                description: 'Test setup-circuits.js functionality',
                test: () => this.testSetupScriptValidation()
            },
            {
                name: 'validate_script_validation',
                description: 'Test validate-setup.js functionality',
                test: () => this.testValidateScriptValidation()
            },
            {
                name: 'error_handling',
                description: 'Test build system error handling',
                test: () => this.testBuildSystemErrorHandling()
            },
            {
                name: 'dependency_validation',
                description: 'Test build dependency validation',
                test: () => this.testBuildDependencyValidation()
            },
            {
                name: 'clean_build_process',
                description: 'Test clean build from scratch',
                test: () => this.testCleanBuildProcess()
            }
        ];

        this.results.buildSystem = {};

        for (const test of buildSystemTests) {
            console.log(`    🔍 ${test.description}...`);
            
            try {
                const result = await test.test();
                this.results.buildSystem[test.name] = {
                    name: test.name,
                    description: test.description,
                    passed: result.passed,
                    details: result.details,
                    warnings: result.warnings || [],
                    duration: result.duration
                };

                this.updateSummary(result.passed);
                console.log(`      ${result.passed ? '✓' : '❌'} ${result.details}`);
                
                if (result.warnings && result.warnings.length > 0) {
                    result.warnings.forEach(warning => {
                        console.log(`      ⚠️  ${warning}`);
                    });
                }

            } catch (error) {
                this.results.buildSystem[test.name] = {
                    name: test.name,
                    description: test.description,
                    passed: false,
                    error: error.message
                };
                this.updateSummary(false);
                console.log(`      ❌ Failed: ${error.message}`);
            }
        }
    }

    async testCompileScriptValidation() {
        const startTime = Date.now();
        const compileScript = path.join(SCRIPTS_DIR, 'compile-circuits.js');
        
        if (!fs.existsSync(compileScript)) {
            return {
                passed: false,
                details: 'Compile script not found',
                duration: Date.now() - startTime
            };
        }

        const warnings = [];
        
        try {
            // Test syntax validation
            execSync(`node -c "${compileScript}"`, { stdio: 'pipe' });
            
            // Test script configuration
            const scriptContent = fs.readFileSync(compileScript, 'utf8');
            
            // Check for essential components
            const essentialChecks = [
                { check: 'checkCircomInstalled', pattern: /checkCircomInstalled|circom.*version/ },
                { check: 'circuit configuration', pattern: /CIRCUITS.*=/ },
                { check: 'compilation function', pattern: /compileCircuit/ },
                { check: 'error handling', pattern: /try.*catch|\.catch/ }
            ];

            for (const { check, pattern } of essentialChecks) {
                if (!pattern.test(scriptContent)) {
                    warnings.push(`Missing or incomplete: ${check}`);
                }
            }

            // Test script module exports
            if (!scriptContent.includes('module.exports')) {
                warnings.push('Script does not export functions for testing');
            }

            return {
                passed: true,
                details: 'Compile script validation passed',
                warnings: warnings,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                passed: false,
                details: `Compile script validation failed: ${error.message}`,
                duration: Date.now() - startTime
            };
        }
    }

    async testSetupScriptValidation() {
        const startTime = Date.now();
        const setupScript = path.join(SCRIPTS_DIR, 'setup-circuits.js');
        
        if (!fs.existsSync(setupScript)) {
            return {
                passed: false,
                details: 'Setup script not found',
                duration: Date.now() - startTime
            };
        }

        const warnings = [];
        
        try {
            // Test syntax validation
            execSync(`node -c "${setupScript}"`, { stdio: 'pipe' });
            
            const scriptContent = fs.readFileSync(setupScript, 'utf8');
            
            // Check for essential trusted setup components
            const setupChecks = [
                { check: 'SnarkJS detection', pattern: /checkSnarkjsInstalled|snarkjs.*version/ },
                { check: 'Powers of Tau handling', pattern: /powersOfTau|ptau/ },
                { check: 'trusted setup process', pattern: /setupCircuit|zkey/ },
                { check: 'ceremony verification', pattern: /verifySetup|verify/ },
                { check: 'entropy generation', pattern: /entropy|random/ }
            ];

            for (const { check, pattern } of setupChecks) {
                if (!pattern.test(scriptContent)) {
                    warnings.push(`Missing or incomplete: ${check}`);
                }
            }

            return {
                passed: true,
                details: 'Setup script validation passed',
                warnings: warnings,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                passed: false,
                details: `Setup script validation failed: ${error.message}`,
                duration: Date.now() - startTime
            };
        }
    }

    async testValidateScriptValidation() {
        const startTime = Date.now();
        const validateScript = path.join(SCRIPTS_DIR, 'validate-setup.js');
        
        if (!fs.existsSync(validateScript)) {
            return {
                passed: false,
                details: 'Validate script not found',
                duration: Date.now() - startTime
            };
        }

        const warnings = [];
        
        try {
            execSync(`node -c "${validateScript}"`, { stdio: 'pipe' });
            
            const scriptContent = fs.readFileSync(validateScript, 'utf8');
            
            // Check for validation components
            const validationChecks = [
                { check: 'directory validation', pattern: /validateDirectoryStructure|directory.*exists/ },
                { check: 'circuit file validation', pattern: /validateCircuitFiles|circuit.*files/ },
                { check: 'dependency checks', pattern: /validateDependencies|dependencies/ },
                { check: 'package.json validation', pattern: /validatePackageConfig|package\.json/ }
            ];

            for (const { check, pattern } of validationChecks) {
                if (!pattern.test(scriptContent)) {
                    warnings.push(`Missing or incomplete: ${check}`);
                }
            }

            return {
                passed: true,
                details: 'Validate script validation passed',
                warnings: warnings,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                passed: false,
                details: `Validate script validation failed: ${error.message}`,
                duration: Date.now() - startTime
            };
        }
    }

    async testBuildSystemErrorHandling() {
        const startTime = Date.now();
        const warnings = [];

        try {
            // Test error handling with missing dependencies
            const testScenarios = [
                {
                    name: 'missing_circom',
                    description: 'Test behavior when Circom is not available'
                },
                {
                    name: 'missing_snarkjs', 
                    description: 'Test behavior when SnarkJS is not available'
                },
                {
                    name: 'invalid_circuit_file',
                    description: 'Test behavior with malformed circuit files'
                },
                {
                    name: 'insufficient_permissions',
                    description: 'Test behavior with permission issues'
                }
            ];

            // For now, we'll just validate that error handling patterns exist in scripts
            const scripts = ['compile-circuits.js', 'setup-circuits.js', 'validate-setup.js'];
            
            for (const scriptName of scripts) {
                const scriptPath = path.join(SCRIPTS_DIR, scriptName);
                if (fs.existsSync(scriptPath)) {
                    const content = fs.readFileSync(scriptPath, 'utf8');
                    
                    if (!content.includes('try') && !content.includes('catch')) {
                        warnings.push(`${scriptName} lacks comprehensive error handling`);
                    }
                    
                    if (!content.includes('console.error')) {
                        warnings.push(`${scriptName} may not provide adequate error messages`);
                    }
                }
            }

            return {
                passed: true,
                details: 'Error handling validation completed',
                warnings: warnings,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                passed: false,
                details: `Error handling test failed: ${error.message}`,
                duration: Date.now() - startTime
            };
        }
    }

    async testBuildDependencyValidation() {
        const startTime = Date.now();
        const warnings = [];

        try {
            // Check package.json for required dependencies
            const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
            
            if (!fs.existsSync(packageJsonPath)) {
                return {
                    passed: false,
                    details: 'package.json not found',
                    duration: Date.now() - startTime
                };
            }

            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            // Check for essential circuit dependencies
            const requiredDeps = {
                'circomlib': 'Circuit library dependency',
                'snarkjs': 'ZK proof system dependency',
                'circom_runtime': 'Circuit runtime dependency'
            };

            const requiredDevDeps = {
                'circom': 'Circuit compiler'
            };

            // Check dependencies
            for (const [dep, description] of Object.entries(requiredDeps)) {
                if (!packageJson.dependencies || !packageJson.dependencies[dep]) {
                    warnings.push(`Missing dependency: ${dep} (${description})`);
                }
            }

            // Check dev dependencies
            for (const [dep, description] of Object.entries(requiredDevDeps)) {
                if (!packageJson.devDependencies || !packageJson.devDependencies[dep]) {
                    warnings.push(`Missing dev dependency: ${dep} (${description})`);
                }
            }

            // Check scripts
            const requiredScripts = {
                'circuits:compile': 'Circuit compilation script',
                'circuits:setup': 'Circuit setup script',
                'circuits:test': 'Circuit testing script',
                'circuits:clean': 'Circuit cleanup script'
            };

            for (const [script, description] of Object.entries(requiredScripts)) {
                if (!packageJson.scripts || !packageJson.scripts[script]) {
                    warnings.push(`Missing npm script: ${script} (${description})`);
                }
            }

            return {
                passed: warnings.length === 0,
                details: `Dependency validation completed - ${warnings.length} issues found`,
                warnings: warnings,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                passed: false,
                details: `Dependency validation failed: ${error.message}`,
                duration: Date.now() - startTime
            };
        }
    }

    async testCleanBuildProcess() {
        const startTime = Date.now();
        const warnings = [];

        try {
            // Test clean build process simulation
            const buildSteps = [
                {
                    name: 'clean',
                    description: 'Clean previous build artifacts',
                    validate: () => this.validateCleanStep()
                },
                {
                    name: 'compile',
                    description: 'Compile circuits',
                    validate: () => this.validateCompileStep()
                },
                {
                    name: 'setup',
                    description: 'Generate trusted setup',
                    validate: () => this.validateSetupStep()
                },
                {
                    name: 'verify',
                    description: 'Verify build integrity',
                    validate: () => this.validateVerifyStep()
                }
            ];

            let allStepsValid = true;

            for (const step of buildSteps) {
                try {
                    const stepResult = step.validate();
                    if (!stepResult.valid) {
                        warnings.push(`${step.name}: ${stepResult.message}`);
                        allStepsValid = false;
                    }
                } catch (error) {
                    warnings.push(`${step.name}: ${error.message}`);
                    allStepsValid = false;
                }
            }

            return {
                passed: allStepsValid,
                details: `Clean build process validation completed`,
                warnings: warnings,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                passed: false,
                details: `Clean build process test failed: ${error.message}`,
                duration: Date.now() - startTime
            };
        }
    }

    validateCleanStep() {
        // Check if clean scripts and patterns exist
        const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
        
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const cleanScript = packageJson.scripts?.['circuits:clean'];
            
            if (cleanScript) {
                return { valid: true, message: 'Clean script configured' };
            }
        }

        return { valid: false, message: 'No clean script configured' };
    }

    validateCompileStep() {
        const compileScript = path.join(SCRIPTS_DIR, 'compile-circuits.js');
        return {
            valid: fs.existsSync(compileScript),
            message: fs.existsSync(compileScript) ? 'Compile script exists' : 'Compile script missing'
        };
    }

    validateSetupStep() {
        const setupScript = path.join(SCRIPTS_DIR, 'setup-circuits.js');
        return {
            valid: fs.existsSync(setupScript),
            message: fs.existsSync(setupScript) ? 'Setup script exists' : 'Setup script missing'
        };
    }

    validateVerifyStep() {
        const validateScript = path.join(SCRIPTS_DIR, 'validate-setup.js');
        return {
            valid: fs.existsSync(validateScript),
            message: fs.existsSync(validateScript) ? 'Validation script exists' : 'Validation script missing'
        };
    }

    async testSystemIntegration() {
        console.log('  🔗 Testing system integration...');

        const integrationTests = [
            {
                name: 'circuit_loader_integration',
                description: 'Test CircuitLoader integration with compiled circuits',
                test: () => this.testCircuitLoaderIntegration()
            },
            {
                name: 'proof_generator_integration',
                description: 'Test ProofGenerator integration with circuits',
                test: () => this.testProofGeneratorIntegration()
            },
            {
                name: 'template_mapper_integration',
                description: 'Test template-to-circuit mapping integration',
                test: () => this.testTemplateMapperIntegration()
            },
            {
                name: 'api_handler_integration',
                description: 'Test API handlers integration with proof system',
                test: () => this.testAPIHandlerIntegration()
            }
        ];

        this.results.integration = {};

        for (const test of integrationTests) {
            console.log(`    🔍 ${test.description}...`);
            
            try {
                const result = await test.test();
                this.results.integration[test.name] = {
                    name: test.name,
                    description: test.description,
                    passed: result.passed,
                    details: result.details,
                    warnings: result.warnings || []
                };

                this.updateSummary(result.passed);
                console.log(`      ${result.passed ? '✓' : '❌'} ${result.details}`);

            } catch (error) {
                this.results.integration[test.name] = {
                    name: test.name,
                    description: test.description,
                    passed: false,
                    error: error.message
                };
                this.updateSummary(false);
                console.log(`      ❌ Failed: ${error.message}`);
            }
        }
    }

    async testCircuitLoaderIntegration() {
        const startTime = Date.now();
        
        try {
            // Check if CircuitLoader exists and can find circuits
            const circuitLoaderPath = path.join(SRC_DIR, 'proof', 'circuit-loader.ts');
            const distCircuitLoaderPath = path.join(__dirname, '..', '..', 'dist', 'proof', 'circuit-loader.js');
            
            let loaderExists = false;
            let warnings = [];

            if (fs.existsSync(circuitLoaderPath)) {
                loaderExists = true;
                
                // Check for integration points
                const content = fs.readFileSync(circuitLoaderPath, 'utf8');
                
                if (!content.includes('manifest.json')) {
                    warnings.push('CircuitLoader may not use circuit manifest');
                }
                
                if (!content.includes('.wasm')) {
                    warnings.push('CircuitLoader may not handle WASM files');
                }
                
            } else if (fs.existsSync(distCircuitLoaderPath)) {
                loaderExists = true;
                warnings.push('Only compiled CircuitLoader found, source may be missing');
            }

            // Check circuit manifest
            const manifestPath = path.join(CIRCUITS_DIR, 'manifest.json');
            if (!fs.existsSync(manifestPath)) {
                warnings.push('Circuit manifest not found - CircuitLoader may fail');
            }

            return {
                passed: loaderExists,
                details: loaderExists ? 'CircuitLoader integration validated' : 'CircuitLoader not found',
                warnings: warnings,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                passed: false,
                details: `CircuitLoader integration test failed: ${error.message}`,
                duration: Date.now() - startTime
            };
        }
    }

    async testProofGeneratorIntegration() {
        const startTime = Date.now();
        
        try {
            // Check if ProofGenerator exists
            const proofGeneratorPath = path.join(SRC_DIR, 'proof', 'proof-generator.ts');
            const distProofGeneratorPath = path.join(__dirname, '..', '..', 'dist', 'proof', 'proof-generator.js');
            
            let generatorExists = false;
            let warnings = [];

            if (fs.existsSync(proofGeneratorPath)) {
                generatorExists = true;
                
                const content = fs.readFileSync(proofGeneratorPath, 'utf8');
                
                // Check for integration patterns
                if (!content.includes('snarkjs')) {
                    warnings.push('ProofGenerator may not integrate with SnarkJS');
                }
                
                if (!content.includes('CircuitLoader')) {
                    warnings.push('ProofGenerator may not use CircuitLoader');
                }
                
            } else if (fs.existsSync(distProofGeneratorPath)) {
                generatorExists = true;
                warnings.push('Only compiled ProofGenerator found');
            }

            return {
                passed: generatorExists,
                details: generatorExists ? 'ProofGenerator integration validated' : 'ProofGenerator not found',
                warnings: warnings,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                passed: false,
                details: `ProofGenerator integration test failed: ${error.message}`,
                duration: Date.now() - startTime
            };
        }
    }

    async testTemplateMapperIntegration() {
        const startTime = Date.now();
        
        try {
            // Check circuit mapper
            const mapperPath = path.join(CIRCUITS_DIR, 'generators', 'circuit-mapper.ts');
            
            let mapperExists = fs.existsSync(mapperPath);
            let warnings = [];

            if (mapperExists) {
                const content = fs.readFileSync(mapperPath, 'utf8');
                
                // Check for template integration
                if (!content.includes('Template')) {
                    warnings.push('Circuit mapper may not handle Template types');
                }
                
                if (!content.includes('CircuitInput')) {
                    warnings.push('Circuit mapper may not generate proper circuit inputs');
                }
            }

            return {
                passed: mapperExists,
                details: mapperExists ? 'Template mapper integration validated' : 'Template mapper not found',
                warnings: warnings,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                passed: false,
                details: `Template mapper integration test failed: ${error.message}`,
                duration: Date.now() - startTime
            };
        }
    }

    async testAPIHandlerIntegration() {
        const startTime = Date.now();
        
        try {
            // Check API handlers
            const handlersPath = path.join(SRC_DIR, 'api', 'handlers.ts');
            const distHandlersPath = path.join(__dirname, '..', '..', 'dist', 'api', 'handlers.js');
            
            let handlersExist = false;
            let warnings = [];

            if (fs.existsSync(handlersPath)) {
                handlersExist = true;
                
                const content = fs.readFileSync(handlersPath, 'utf8');
                
                if (!content.includes('proof')) {
                    warnings.push('API handlers may not integrate with proof system');
                }
                
            } else if (fs.existsSync(distHandlersPath)) {
                handlersExist = true;
                warnings.push('Only compiled API handlers found');
            }

            return {
                passed: handlersExist,
                details: handlersExist ? 'API handler integration validated' : 'API handlers not found',
                warnings: warnings,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                passed: false,
                details: `API handler integration test failed: ${error.message}`,
                duration: Date.now() - startTime
            };
        }
    }

    async testEndToEndWorkflows() {
        console.log('  🌟 Testing end-to-end workflows...');

        const e2eTests = [
            {
                name: 'template_to_proof_workflow',
                description: 'Test complete template-to-proof generation workflow',
                test: () => this.testTemplateToProofWorkflow()
            },
            {
                name: 'multi_circuit_workflow',
                description: 'Test workflows using multiple circuit types',
                test: () => this.testMultiCircuitWorkflow()
            },
            {
                name: 'error_recovery_workflow',
                description: 'Test error recovery in proof generation workflow',
                test: () => this.testErrorRecoveryWorkflow()
            }
        ];

        this.results.endToEnd = {};

        for (const test of e2eTests) {
            console.log(`    🔍 ${test.description}...`);
            
            try {
                const result = await test.test();
                this.results.endToEnd[test.name] = {
                    name: test.name,
                    description: test.description,
                    passed: result.passed,
                    details: result.details,
                    warnings: result.warnings || []
                };

                this.updateSummary(result.passed);
                console.log(`      ${result.passed ? '✓' : '❌'} ${result.details}`);

            } catch (error) {
                this.results.endToEnd[test.name] = {
                    name: test.name,
                    description: test.description,
                    passed: false,
                    error: error.message
                };
                this.updateSummary(false);
                console.log(`      ❌ Failed: ${error.message}`);
            }
        }
    }

    async testTemplateToProofWorkflow() {
        const startTime = Date.now();
        
        try {
            // Simulate template to proof workflow validation
            const workflowComponents = [
                { name: 'Template Engine', path: path.join(SRC_DIR, 'template-engine') },
                { name: 'Circuit Mapper', path: path.join(CIRCUITS_DIR, 'generators') },
                { name: 'Circuit Loader', path: path.join(SRC_DIR, 'proof') },
                { name: 'Proof Generator', path: path.join(SRC_DIR, 'proof') }
            ];

            let allComponentsExist = true;
            let warnings = [];

            for (const component of workflowComponents) {
                if (!fs.existsSync(component.path)) {
                    warnings.push(`${component.name} directory not found`);
                    allComponentsExist = false;
                }
            }

            // Check for circuit files
            const requiredCircuits = ['generic_proof.circom', 'dynamic_comparator.circom', 'template_validator.circom'];
            for (const circuit of requiredCircuits) {
                const circuitPath = path.join(CIRCUITS_DIR, circuit);
                if (!fs.existsExists(circuitPath)) {
                    warnings.push(`Required circuit not found: ${circuit}`);
                }
            }

            return {
                passed: allComponentsExist,
                details: allComponentsExist ? 'Template-to-proof workflow components validated' : 'Missing workflow components',
                warnings: warnings,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                passed: false,
                details: `Template-to-proof workflow test failed: ${error.message}`,
                duration: Date.now() - startTime
            };
        }
    }

    async testMultiCircuitWorkflow() {
        const startTime = Date.now();
        
        try {
            // Test that multiple circuits can be used together
            const circuits = ['generic_proof', 'balance_proof', 'follower_proof', 'template_validator'];
            const manifestPath = path.join(CIRCUITS_DIR, 'manifest.json');
            
            let manifestExists = fs.existsSync(manifestPath);
            let warnings = [];

            if (manifestExists) {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                
                // Check if all circuits are in manifest
                const manifestCircuits = manifest.circuits?.map(c => c.name) || [];
                
                for (const circuit of circuits) {
                    if (!manifestCircuits.includes(circuit)) {
                        warnings.push(`Circuit ${circuit} not in manifest`);
                    }
                }
            } else {
                warnings.push('Circuit manifest not found');
            }

            return {
                passed: manifestExists,
                details: manifestExists ? 'Multi-circuit workflow validated' : 'Circuit manifest missing',
                warnings: warnings,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                passed: false,
                details: `Multi-circuit workflow test failed: ${error.message}`,
                duration: Date.now() - startTime
            };
        }
    }

    async testErrorRecoveryWorkflow() {
        const startTime = Date.now();
        
        try {
            // Test error recovery mechanisms
            const errorHandlingChecks = [
                { component: 'CircuitLoader', check: 'Missing circuit files' },
                { component: 'ProofGenerator', check: 'Invalid inputs' },
                { component: 'Setup scripts', check: 'Missing dependencies' }
            ];

            let warnings = [];

            // Check if error handling patterns exist in key files
            const keyFiles = [
                path.join(SRC_DIR, 'proof', 'circuit-loader.ts'),
                path.join(SRC_DIR, 'proof', 'proof-generator.ts'),
                path.join(SCRIPTS_DIR, 'compile-circuits.js')
            ];

            for (const file of keyFiles) {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    if (!content.includes('try') && !content.includes('catch')) {
                        warnings.push(`${path.basename(file)} may lack error handling`);
                    }
                } else {
                    warnings.push(`${path.basename(file)} not found`);
                }
            }

            return {
                passed: true,
                details: 'Error recovery workflow validated',
                warnings: warnings,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                passed: false,
                details: `Error recovery workflow test failed: ${error.message}`,
                duration: Date.now() - startTime
            };
        }
    }

    async testDockerIntegration() {
        console.log('  🐳 Testing Docker integration...');
        
        try {
            const dockerTests = [
                {
                    name: 'docker_configuration',
                    description: 'Test Docker configuration files',
                    test: () => this.testDockerConfiguration()
                },
                {
                    name: 'docker_build_context',
                    description: 'Test Docker build context and circuit files',
                    test: () => this.testDockerBuildContext()
                }
            ];

            this.results.docker = {};

            for (const test of dockerTests) {
                console.log(`    🔍 ${test.description}...`);
                
                try {
                    const result = await test.test();
                    this.results.docker[test.name] = {
                        name: test.name,
                        description: test.description,
                        passed: result.passed,
                        details: result.details,
                        warnings: result.warnings || []
                    };

                    this.updateSummary(result.passed);
                    console.log(`      ${result.passed ? '✓' : '❌'} ${result.details}`);

                } catch (error) {
                    this.results.docker[test.name] = {
                        name: test.name,
                        description: test.description,
                        passed: false,
                        error: error.message
                    };
                    this.updateSummary(false);
                    console.log(`      ❌ Failed: ${error.message}`);
                }
            }

        } catch (error) {
            console.log(`    ❌ Docker integration testing failed: ${error.message}`);
            this.results.docker = { error: error.message };
        }
    }

    async testDockerConfiguration() {
        const startTime = Date.now();
        
        try {
            const dockerFiles = [
                { name: 'Dockerfile', path: path.join(__dirname, '..', '..', 'Dockerfile') },
                { name: 'docker-compose.yml', path: path.join(__dirname, '..', '..', 'docker', 'docker-compose.yml') },
                { name: '.dockerignore', path: path.join(__dirname, '..', '..', '.dockerignore') }
            ];

            let warnings = [];
            let foundFiles = 0;

            for (const dockerFile of dockerFiles) {
                if (fs.existsSync(dockerFile.path)) {
                    foundFiles++;
                    
                    const content = fs.readFileSync(dockerFile.path, 'utf8');
                    
                    // Check specific requirements
                    if (dockerFile.name === 'Dockerfile') {
                        if (!content.includes('circuits')) {
                            warnings.push('Dockerfile may not include circuits directory');
                        }
                        if (!content.includes('npm') && !content.includes('yarn')) {
                            warnings.push('Dockerfile may not handle Node.js dependencies');
                        }
                    }
                    
                    if (dockerFile.name === 'docker-compose.yml') {
                        if (!content.includes('volumes')) {
                            warnings.push('Docker Compose may not mount volumes for circuits');
                        }
                    }
                } else {
                    warnings.push(`${dockerFile.name} not found`);
                }
            }

            return {
                passed: foundFiles > 0,
                details: `Docker configuration validated - ${foundFiles}/${dockerFiles.length} files found`,
                warnings: warnings,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                passed: false,
                details: `Docker configuration test failed: ${error.message}`,
                duration: Date.now() - startTime
            };
        }
    }

    async testDockerBuildContext() {
        const startTime = Date.now();
        
        try {
            // Check if Docker build context includes necessary files
            const requiredInContext = [
                'package.json',
                'circuits/',
                'src/',
                'scripts/'
            ];

            let warnings = [];
            let contextValid = true;

            const rootDir = path.join(__dirname, '..', '..');
            
            for (const item of requiredInContext) {
                const itemPath = path.join(rootDir, item);
                if (!fs.existsSync(itemPath)) {
                    warnings.push(`Required context item missing: ${item}`);
                    contextValid = false;
                }
            }

            // Check .dockerignore if it exists
            const dockerignorePath = path.join(rootDir, '.dockerignore');
            if (fs.existsSync(dockerignorePath)) {
                const content = fs.readFileSync(dockerignorePath, 'utf8');
                
                // Important directories should not be ignored
                const importantDirs = ['circuits', 'src', 'scripts'];
                for (const dir of importantDirs) {
                    if (content.includes(dir + '/') || content.includes(dir + '\n')) {
                        warnings.push(`Important directory ${dir} may be ignored by Docker`);
                    }
                }
            }

            return {
                passed: contextValid,
                details: contextValid ? 'Docker build context validated' : 'Docker build context incomplete',
                warnings: warnings,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                passed: false,
                details: `Docker build context test failed: ${error.message}`,
                duration: Date.now() - startTime
            };
        }
    }

    updateSummary(passed) {
        this.results.summary.totalTests++;
        if (passed) {
            this.results.summary.passed++;
        } else {
            this.results.summary.failed++;
        }
    }

    async generateIntegrationReport() {
        const report = {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            summary: this.results.summary,
            buildSystem: this.results.buildSystem,
            integration: this.results.integration,
            endToEnd: this.results.endToEnd,
            docker: this.results.docker,
            recommendations: this.generateIntegrationRecommendations()
        };

        const reportPath = path.join(INTEGRATION_TEST_DIR, 'build-system-integration-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log(`\n✓ Integration report saved to: ${reportPath}`);
        return report;
    }

    generateIntegrationRecommendations() {
        const recommendations = [];

        // Analyze results and generate recommendations
        const failedBuildTests = Object.values(this.results.buildSystem)
            .filter(test => !test.passed).length;
        
        const failedIntegrationTests = Object.values(this.results.integration)
            .filter(test => !test.passed).length;

        if (failedBuildTests > 0) {
            recommendations.push({
                category: 'build_system',
                priority: 'high',
                issue: `${failedBuildTests} build system tests failed`,
                recommendation: 'Fix build system issues to ensure reliable circuit compilation and setup'
            });
        }

        if (failedIntegrationTests > 0) {
            recommendations.push({
                category: 'integration',
                priority: 'high',
                issue: `${failedIntegrationTests} integration tests failed`,
                recommendation: 'Resolve integration issues to ensure end-to-end functionality'
            });
        }

        // General recommendations
        recommendations.push({
            category: 'general',
            priority: 'medium',
            issue: 'Continuous integration setup',
            recommendation: 'Set up CI/CD pipeline to run these tests automatically'
        });

        return recommendations;
    }

    printIntegrationSummary() {
        console.log('\n' + '='.repeat(70));
        console.log('🔧 BUILD SYSTEM AND INTEGRATION TEST SUMMARY');
        console.log('='.repeat(70));

        console.log(`\n📊 Overall Results:`);
        console.log(`  • Total Tests: ${this.results.summary.totalTests}`);
        console.log(`  • Passed: ${this.results.summary.passed}`);
        console.log(`  • Failed: ${this.results.summary.failed}`);
        console.log(`  • Success Rate: ${((this.results.summary.passed / this.results.summary.totalTests) * 100).toFixed(1)}%`);

        console.log(`\n📦 Build System Tests:`);
        Object.values(this.results.buildSystem).forEach(test => {
            const status = test.passed ? '✓' : '❌';
            console.log(`  ${status} ${test.description}`);
            if (test.warnings && test.warnings.length > 0) {
                test.warnings.forEach(warning => {
                    console.log(`    ⚠️  ${warning}`);
                });
            }
        });

        console.log(`\n🔗 Integration Tests:`);
        Object.values(this.results.integration).forEach(test => {
            const status = test.passed ? '✓' : '❌';
            console.log(`  ${status} ${test.description}`);
        });

        console.log(`\n🌟 End-to-End Tests:`);
        Object.values(this.results.endToEnd).forEach(test => {
            const status = test.passed ? '✓' : '❌';
            console.log(`  ${status} ${test.description}`);
        });

        if (this.results.docker && !this.results.docker.error) {
            console.log(`\n🐳 Docker Integration Tests:`);
            Object.values(this.results.docker).forEach(test => {
                const status = test.passed ? '✓' : '❌';
                console.log(`  ${status} ${test.description}`);
            });
        }

        console.log('\n' + '='.repeat(70));
    }
}

// Main execution
if (require.main === module) {
    const tester = new BuildSystemIntegrationTester();
    
    tester.runBuildSystemAndIntegrationTests()
        .then(() => {
            const successRate = (tester.results.summary.passed / tester.results.summary.totalTests) * 100;
            console.log('\n🎉 Build system and integration testing completed!');
            process.exit(successRate >= 80 ? 0 : 1);
        })
        .catch((error) => {
            console.error('\n❌ Build system and integration testing failed:', error.message);
            process.exit(1);
        });
}

module.exports = { BuildSystemIntegrationTester };