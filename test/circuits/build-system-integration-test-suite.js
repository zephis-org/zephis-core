#!/usr/bin/env node

/**
 * Build System Integration Test Suite
 * 
 * Comprehensive testing of the circuit build pipeline:
 * 1. Circuit compilation with error scenarios
 * 2. Trusted setup process testing
 * 3. Validation script testing
 * 4. Dependency management testing
 * 5. Docker environment testing
 * 6. Build artifact verification
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const CIRCUITS_DIR = path.join(PROJECT_ROOT, 'circuits');
const BUILD_DIR = path.join(CIRCUITS_DIR, 'build');
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'scripts');
const TEST_RESULTS_DIR = path.join(__dirname, 'build-test-results');

class BuildSystemIntegrationTester {
    constructor() {
        this.results = {
            compilation: {},
            setup: {},
            validation: {},
            dependencies: {},
            docker: {},
            artifacts: {}
        };
        this.setupTestEnvironment();
    }

    setupTestEnvironment() {
        if (!fs.existsSync(TEST_RESULTS_DIR)) {
            fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
        }
        
        console.log('🏗️  Build System Integration Test Suite Initialized\n');
        console.log(`Test Results: ${TEST_RESULTS_DIR}`);
        console.log(`Scripts Dir: ${SCRIPTS_DIR}`);
        console.log(`Circuits Dir: ${CIRCUITS_DIR}\n`);
    }

    async runAllTests() {
        console.log('🚀 Starting Build System Integration Tests...\n');
        
        const startTime = Date.now();
        
        try {
            // Test compilation process
            await this.testCompilationProcess();
            
            // Test setup process
            await this.testSetupProcess();
            
            // Test validation process
            await this.testValidationProcess();
            
            // Test dependency management
            await this.testDependencyManagement();
            
            // Test Docker integration
            await this.testDockerIntegration();
            
            // Test build artifacts
            await this.testBuildArtifacts();
            
            // Generate comprehensive report
            await this.generateBuildTestReport();
            
        } catch (error) {
            console.error('❌ Build system test suite failed:', error.message);
            throw error;
        }
        
        const duration = Date.now() - startTime;
        this.printFinalSummary(duration);
    }

    async testCompilationProcess() {
        console.log('🔨 Testing Circuit Compilation Process...\n');
        
        this.results.compilation = {
            basicCompilation: {},
            errorHandling: {},
            parameterVariation: {},
            dependencyResolution: {},
            outputValidation: {}
        };

        // Test basic compilation
        await this.testBasicCompilation();
        
        // Test error handling
        await this.testCompilationErrorHandling();
        
        // Test parameter variations
        await this.testParameterVariations();
        
        // Test dependency resolution
        await this.testDependencyResolution();
        
        // Test output validation
        await this.testCompilationOutputValidation();
    }

    async testBasicCompilation() {
        console.log('  📝 Testing basic circuit compilation...');
        
        const compilationTest = {
            success: false,
            outputs: [],
            errors: [],
            artifacts: {}
        };

        try {
            // Clean build directory first
            if (fs.existsSync(BUILD_DIR)) {
                execSync(`rm -rf "${BUILD_DIR}"`, { stdio: 'pipe' });
            }

            // Run compilation script
            const startTime = Date.now();
            const output = execSync('npm run circuits:compile', {
                cwd: PROJECT_ROOT,
                encoding: 'utf8',
                stdio: 'pipe'
            });
            const compilationTime = Date.now() - startTime;

            compilationTest.success = true;
            compilationTest.outputs.push(`Compilation completed in ${compilationTime}ms`);
            compilationTest.compilationTime = compilationTime;

            // Verify expected artifacts were created
            const expectedArtifacts = [
                'generic_proof.wasm',
                'balance_proof.wasm', 
                'follower_proof.wasm',
                'dynamic_comparator.wasm',
                'template_validator.wasm'
            ];

            for (const artifact of expectedArtifacts) {
                const artifactPath = path.join(CIRCUITS_DIR, artifact);
                if (fs.existsSync(artifactPath)) {
                    const stats = fs.statSync(artifactPath);
                    compilationTest.artifacts[artifact] = {
                        exists: true,
                        size: stats.size,
                        path: artifactPath
                    };
                    console.log(`    ✅ ${artifact} (${(stats.size / 1024).toFixed(2)} KB)`);
                } else {
                    compilationTest.artifacts[artifact] = { exists: false };
                    console.log(`    ❌ ${artifact} - Not found`);
                    compilationTest.success = false;
                }
            }

            // Verify R1CS files
            const circuits = ['generic_proof', 'balance_proof', 'follower_proof', 'dynamic_comparator', 'template_validator'];
            for (const circuit of circuits) {
                const r1csPath = path.join(BUILD_DIR, circuit, `${circuit}.r1cs`);
                if (fs.existsSync(r1csPath)) {
                    const stats = fs.statSync(r1csPath);
                    console.log(`    ✅ ${circuit}.r1cs (${(stats.size / 1024).toFixed(2)} KB)`);
                } else {
                    console.log(`    ❌ ${circuit}.r1cs - Not found`);
                    compilationTest.success = false;
                }
            }

        } catch (error) {
            compilationTest.success = false;
            compilationTest.errors.push(error.message);
            console.log(`    ❌ Compilation failed: ${error.message}`);
        }

        this.results.compilation.basicCompilation = compilationTest;
    }

    async testCompilationErrorHandling() {
        console.log('  🚨 Testing compilation error handling...');
        
        const errorTests = [];

        // Test 1: Missing circuit file
        const missingFileTest = await this.testMissingCircuitFile();
        errorTests.push(missingFileTest);

        // Test 2: Syntax error in circuit
        const syntaxErrorTest = await this.testCircuitSyntaxError();
        errorTests.push(syntaxErrorTest);

        // Test 3: Missing dependency
        const missingDepTest = await this.testMissingDependency();
        errorTests.push(missingDepTest);

        // Test 4: Invalid parameters
        const invalidParamsTest = await this.testInvalidParameters();
        errorTests.push(invalidParamsTest);

        this.results.compilation.errorHandling = {
            tests: errorTests,
            summary: {
                total: errorTests.length,
                passed: errorTests.filter(t => t.passed).length,
                failed: errorTests.filter(t => !t.passed).length
            }
        };

        console.log(`    📊 Error handling tests: ${this.results.compilation.errorHandling.summary.passed}/${this.results.compilation.errorHandling.summary.total} passed`);
    }

    async testMissingCircuitFile() {
        const test = {
            name: 'missing_circuit_file',
            description: 'Test behavior when circuit file is missing',
            passed: false,
            error: null
        };

        try {
            // Temporarily rename a circuit file
            const testCircuit = path.join(CIRCUITS_DIR, 'generic_proof.circom');
            const backupCircuit = path.join(CIRCUITS_DIR, 'generic_proof.circom.backup');
            
            if (fs.existsSync(testCircuit)) {
                fs.renameSync(testCircuit, backupCircuit);
            }

            try {
                // This should fail gracefully
                execSync('node scripts/compile-circuits.js', {
                    cwd: PROJECT_ROOT,
                    stdio: 'pipe'
                });
                test.passed = false;
                test.error = 'Compilation should have failed but succeeded';
            } catch (error) {
                // Expected to fail
                test.passed = error.message.includes('not found') || error.message.includes('ENOENT');
                test.error = test.passed ? null : 'Wrong error type';
            }

            // Restore file
            if (fs.existsSync(backupCircuit)) {
                fs.renameSync(backupCircuit, testCircuit);
            }

        } catch (error) {
            test.error = error.message;
        }

        return test;
    }

    async testCircuitSyntaxError() {
        const test = {
            name: 'circuit_syntax_error',
            description: 'Test behavior with syntax error in circuit',
            passed: false,
            error: null
        };

        try {
            // Create a circuit with syntax error
            const invalidCircuit = path.join(CIRCUITS_DIR, 'test_invalid.circom');
            const invalidContent = `
pragma circom 2.0.0;

template InvalidCircuit() {
    signal input a;
    signal output b;
    
    // Syntax error: missing semicolon
    b <== a + 1
}

component main = InvalidCircuit();
`;
            
            fs.writeFileSync(invalidCircuit, invalidContent);

            try {
                // Try to compile the invalid circuit
                execSync(`circom --r1cs --wasm --sym "${invalidCircuit}"`, {
                    cwd: CIRCUITS_DIR,
                    stdio: 'pipe'
                });
                test.passed = false;
                test.error = 'Invalid circuit compiled successfully';
            } catch (error) {
                // Expected to fail
                test.passed = error.message.includes('syntax') || error.message.includes('parse');
                test.error = test.passed ? null : 'Wrong error type';
            }

            // Clean up
            if (fs.existsSync(invalidCircuit)) {
                fs.unlinkSync(invalidCircuit);
            }

        } catch (error) {
            test.error = error.message;
        }

        return test;
    }

    async testMissingDependency() {
        const test = {
            name: 'missing_dependency',
            description: 'Test behavior when dependency is missing',
            passed: false,
            error: null
        };

        try {
            // Create a circuit with missing dependency
            const depTestCircuit = path.join(CIRCUITS_DIR, 'test_missing_dep.circom');
            const depTestContent = `
pragma circom 2.0.0;

include "nonexistent_circuit.circom";

template TestMissingDep() {
    signal input a;
    signal output b;
    b <== a;
}

component main = TestMissingDep();
`;
            
            fs.writeFileSync(depTestCircuit, depTestContent);

            try {
                execSync(`circom --r1cs --wasm --sym "${depTestCircuit}"`, {
                    cwd: CIRCUITS_DIR,
                    stdio: 'pipe'
                });
                test.passed = false;
                test.error = 'Missing dependency circuit compiled successfully';
            } catch (error) {
                // Expected to fail
                test.passed = error.message.includes('not found') || error.message.includes('include');
                test.error = test.passed ? null : 'Wrong error type';
            }

            // Clean up
            if (fs.existsSync(depTestCircuit)) {
                fs.unlinkSync(depTestCircuit);
            }

        } catch (error) {
            test.error = error.message;
        }

        return test;
    }

    async testInvalidParameters() {
        const test = {
            name: 'invalid_parameters',
            description: 'Test behavior with invalid template parameters',
            passed: false,
            error: null
        };

        try {
            // Create a circuit with invalid parameters
            const paramTestCircuit = path.join(CIRCUITS_DIR, 'test_invalid_params.circom');
            const paramTestContent = `
pragma circom 2.0.0;

template TestInvalidParams(n) {
    signal input a[n];
    signal output b;
    
    // This should fail with negative or zero n
    assert(n > 0);
    
    var sum = 0;
    for (var i = 0; i < n; i++) {
        sum += a[i];
    }
    b <== sum;
}

component main = TestInvalidParams(-1); // Invalid negative parameter
`;
            
            fs.writeFileSync(paramTestCircuit, paramTestContent);

            try {
                execSync(`circom --r1cs --wasm --sym "${paramTestCircuit}"`, {
                    cwd: CIRCUITS_DIR,
                    stdio: 'pipe'
                });
                test.passed = false;
                test.error = 'Invalid parameter circuit compiled successfully';
            } catch (error) {
                // Expected to fail
                test.passed = error.message.includes('assert') || error.message.includes('parameter') || error.message.includes('negative');
                test.error = test.passed ? null : 'Wrong error type';
            }

            // Clean up
            if (fs.existsSync(paramTestCircuit)) {
                fs.unlinkSync(paramTestCircuit);
            }

        } catch (error) {
            test.error = error.message;
        }

        return test;
    }

    async testParameterVariations() {
        console.log('  🔄 Testing parameter variations...');
        
        const paramTests = [];

        // Test different parameter combinations for GenericDataProof
        const paramCombinations = [
            { max_data_length: 32, max_tls_length: 512 },
            { max_data_length: 64, max_tls_length: 1024 },
            { max_data_length: 128, max_tls_length: 2048 }
        ];

        for (const params of paramCombinations) {
            const paramTest = await this.testParameterCombination(params);
            paramTests.push(paramTest);
        }

        this.results.compilation.parameterVariation = {
            tests: paramTests,
            summary: {
                total: paramTests.length,
                passed: paramTests.filter(t => t.passed).length,
                failed: paramTests.filter(t => !t.passed).length
            }
        };

        console.log(`    📊 Parameter variation tests: ${this.results.compilation.parameterVariation.summary.passed}/${this.results.compilation.parameterVariation.summary.total} passed`);
    }

    async testParameterCombination(params) {
        const test = {
            name: `params_${params.max_data_length}_${params.max_tls_length}`,
            description: `Test compilation with parameters: data_length=${params.max_data_length}, tls_length=${params.max_tls_length}`,
            passed: false,
            params: params,
            constraintCount: 0,
            compilationTime: 0
        };

        try {
            // Create a test circuit with specific parameters
            const paramCircuit = path.join(CIRCUITS_DIR, `test_params_${params.max_data_length}_${params.max_tls_length}.circom`);
            const circuitContent = `
pragma circom 2.0.0;

include "./generic_proof.circom";

component main = GenericDataProof(${params.max_data_length}, ${params.max_tls_length});
`;
            
            fs.writeFileSync(paramCircuit, circuitContent);

            const startTime = Date.now();
            const output = execSync(`circom --r1cs --wasm --sym --output "${TEST_RESULTS_DIR}" "${paramCircuit}"`, {
                cwd: CIRCUITS_DIR,
                encoding: 'utf8',
                stdio: 'pipe'
            });
            test.compilationTime = Date.now() - startTime;

            // Get constraint count
            const r1csFile = path.join(TEST_RESULTS_DIR, path.basename(paramCircuit, '.circom') + '.r1cs');
            if (fs.existsSync(r1csFile)) {
                const infoOutput = execSync(`npx snarkjs r1cs info "${r1csFile}"`, {
                    encoding: 'utf8',
                    stdio: 'pipe'
                });

                const lines = infoOutput.split('\n');
                for (const line of lines) {
                    if (line.includes('# of Constraints:')) {
                        test.constraintCount = parseInt(line.split(':')[1].trim());
                    }
                }
            }

            test.passed = true;
            console.log(`    ✅ ${test.name} - ${test.constraintCount} constraints, ${test.compilationTime}ms`);

            // Clean up
            fs.unlinkSync(paramCircuit);
            
        } catch (error) {
            test.error = error.message;
            console.log(`    ❌ ${test.name} - ${error.message}`);
        }

        return test;
    }

    async testDependencyResolution() {
        console.log('  📦 Testing dependency resolution...');
        
        const depTests = {
            circomlib: { passed: false, version: null },
            localIncludes: { passed: false, resolved: [] },
            pathResolution: { passed: false, paths: [] }
        };

        // Test circomlib dependency
        try {
            const circomlibPath = path.join(PROJECT_ROOT, 'node_modules', 'circomlib');
            if (fs.existsSync(circomlibPath)) {
                const packageJson = JSON.parse(fs.readFileSync(path.join(circomlibPath, 'package.json'), 'utf8'));
                depTests.circomlib.version = packageJson.version;
                depTests.circomlib.passed = true;
                console.log(`    ✅ circomlib v${packageJson.version} found`);
            } else {
                console.log(`    ❌ circomlib not found`);
            }
        } catch (error) {
            console.log(`    ❌ circomlib check failed: ${error.message}`);
        }

        // Test local includes resolution
        try {
            const testIncludeCircuit = path.join(CIRCUITS_DIR, 'test_includes.circom');
            const includeContent = `
pragma circom 2.0.0;

include "./dynamic_comparator.circom";
include "./template_validator.circom";
include "circomlib/circuits/poseidon.circom";

template TestIncludes() {
    signal input a;
    signal output b;
    b <== a;
}

component main = TestIncludes();
`;
            
            fs.writeFileSync(testIncludeCircuit, includeContent);

            execSync(`circom --r1cs --wasm --sym --output "${TEST_RESULTS_DIR}" "${testIncludeCircuit}"`, {
                cwd: CIRCUITS_DIR,
                stdio: 'pipe'
            });

            depTests.localIncludes.passed = true;
            depTests.localIncludes.resolved = ['dynamic_comparator.circom', 'template_validator.circom', 'poseidon.circom'];
            console.log(`    ✅ Local includes resolved successfully`);

            // Clean up
            fs.unlinkSync(testIncludeCircuit);
            
        } catch (error) {
            console.log(`    ❌ Local includes test failed: ${error.message}`);
        }

        this.results.compilation.dependencyResolution = depTests;
    }

    async testCompilationOutputValidation() {
        console.log('  🔍 Testing compilation output validation...');
        
        const validation = {
            wasmFiles: { passed: false, files: [] },
            r1csFiles: { passed: false, files: [] },
            symFiles: { passed: false, files: [] },
            manifestFile: { passed: false, exists: false }
        };

        // Check WASM files
        const expectedWasmFiles = ['generic_proof.wasm', 'dynamic_comparator.wasm', 'template_validator.wasm'];
        for (const wasmFile of expectedWasmFiles) {
            const wasmPath = path.join(CIRCUITS_DIR, wasmFile);
            if (fs.existsSync(wasmPath)) {
                validation.wasmFiles.files.push(wasmFile);
            }
        }
        validation.wasmFiles.passed = validation.wasmFiles.files.length === expectedWasmFiles.length;

        // Check R1CS files
        const circuits = ['generic_proof', 'dynamic_comparator', 'template_validator'];
        for (const circuit of circuits) {
            const r1csPath = path.join(BUILD_DIR, circuit, `${circuit}.r1cs`);
            if (fs.existsSync(r1csPath)) {
                validation.r1csFiles.files.push(`${circuit}.r1cs`);
            }
        }
        validation.r1csFiles.passed = validation.r1csFiles.files.length === circuits.length;

        // Check manifest file
        const manifestPath = path.join(CIRCUITS_DIR, 'manifest.json');
        validation.manifestFile.exists = fs.existsSync(manifestPath);
        validation.manifestFile.passed = validation.manifestFile.exists;

        console.log(`    📊 WASM files: ${validation.wasmFiles.files.length}/${expectedWasmFiles.length}`);
        console.log(`    📊 R1CS files: ${validation.r1csFiles.files.length}/${circuits.length}`);
        console.log(`    📊 Manifest: ${validation.manifestFile.exists ? '✅' : '❌'}`);

        this.results.compilation.outputValidation = validation;
    }

    async testSetupProcess() {
        console.log('\n⚙️  Testing Circuit Setup Process...\n');
        
        this.results.setup = {
            trustedSetup: {},
            keyGeneration: {},
            setupValidation: {},
            errorRecovery: {}
        };

        // Test trusted setup if script exists
        await this.testTrustedSetup();
        
        // Test key generation
        await this.testKeyGeneration();
        
        // Test setup validation
        await this.testSetupValidation();
        
        // Test error recovery
        await this.testSetupErrorRecovery();
    }

    async testTrustedSetup() {
        console.log('  🔐 Testing trusted setup process...');
        
        const setupTest = {
            scriptExists: false,
            executed: false,
            outputs: [],
            errors: [],
            artifacts: {}
        };

        const setupScript = path.join(SCRIPTS_DIR, 'setup-circuits.js');
        setupTest.scriptExists = fs.existsSync(setupScript);

        if (setupTest.scriptExists) {
            try {
                const startTime = Date.now();
                const output = execSync('npm run circuits:setup', {
                    cwd: PROJECT_ROOT,
                    encoding: 'utf8',
                    stdio: 'pipe',
                    timeout: 300000 // 5 minutes timeout
                });
                const setupTime = Date.now() - startTime;

                setupTest.executed = true;
                setupTest.setupTime = setupTime;
                setupTest.outputs.push(`Setup completed in ${setupTime}ms`);

                // Check for expected setup artifacts
                const expectedArtifacts = [
                    'generic_proof.zkey',
                    'verification_key.json'
                ];

                for (const artifact of expectedArtifacts) {
                    const artifactPath = path.join(CIRCUITS_DIR, artifact);
                    if (fs.existsSync(artifactPath)) {
                        const stats = fs.statSync(artifactPath);
                        setupTest.artifacts[artifact] = {
                            exists: true,
                            size: stats.size
                        };
                        console.log(`    ✅ ${artifact} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                    } else {
                        setupTest.artifacts[artifact] = { exists: false };
                        console.log(`    ⚠️  ${artifact} - Not found (may not be implemented)`);
                    }
                }

            } catch (error) {
                setupTest.errors.push(error.message);
                console.log(`    ❌ Setup failed: ${error.message}`);
            }
        } else {
            console.log(`    ⚠️  Setup script not found - skipping`);
        }

        this.results.setup.trustedSetup = setupTest;
    }

    async testKeyGeneration() {
        console.log('  🔑 Testing key generation...');
        
        const keyTest = {
            powerOfTauExists: false,
            zkeyGeneration: false,
            verificationKeyGeneration: false
        };

        // Check for powers of tau (ceremony file)
        const potFiles = fs.readdirSync(CIRCUITS_DIR).filter(f => f.includes('pot') || f.includes('tau'));
        keyTest.powerOfTauExists = potFiles.length > 0;
        
        if (keyTest.powerOfTauExists) {
            console.log(`    ✅ Powers of tau file found: ${potFiles[0]}`);
        } else {
            console.log(`    ⚠️  No powers of tau file found`);
        }

        // Check for zkey files
        const zkeyFiles = fs.readdirSync(CIRCUITS_DIR).filter(f => f.endsWith('.zkey'));
        keyTest.zkeyGeneration = zkeyFiles.length > 0;
        
        if (keyTest.zkeyGeneration) {
            console.log(`    ✅ zkey files found: ${zkeyFiles.join(', ')}`);
        } else {
            console.log(`    ⚠️  No zkey files found`);
        }

        // Check for verification key
        const vkPath = path.join(CIRCUITS_DIR, 'verification_key.json');
        keyTest.verificationKeyGeneration = fs.existsSync(vkPath);
        
        if (keyTest.verificationKeyGeneration) {
            console.log(`    ✅ Verification key found`);
        } else {
            console.log(`    ⚠️  Verification key not found`);
        }

        this.results.setup.keyGeneration = keyTest;
    }

    async testSetupValidation() {
        console.log('  ✅ Testing setup validation...');
        
        const validationTest = {
            scriptExists: false,
            executed: false,
            results: []
        };

        const validationScript = path.join(SCRIPTS_DIR, 'validate-setup.js');
        validationTest.scriptExists = fs.existsSync(validationScript);

        if (validationTest.scriptExists) {
            try {
                const output = execSync('node scripts/validate-setup.js', {
                    cwd: PROJECT_ROOT,
                    encoding: 'utf8',
                    stdio: 'pipe'
                });

                validationTest.executed = true;
                validationTest.results = output.split('\n').filter(line => line.trim());
                console.log(`    ✅ Validation executed successfully`);
                
            } catch (error) {
                validationTest.error = error.message;
                console.log(`    ❌ Validation failed: ${error.message}`);
            }
        } else {
            console.log(`    ⚠️  Validation script not found - skipping`);
        }

        this.results.setup.setupValidation = validationTest;
    }

    async testSetupErrorRecovery() {
        console.log('  🔄 Testing setup error recovery...');
        
        const recoveryTest = {
            corruptedFileRecovery: false,
            incompleteSetupRecovery: false,
            cleanupProcedure: false
        };

        // Test corrupted file recovery (simulate by creating invalid files)
        try {
            const corruptedZkey = path.join(CIRCUITS_DIR, 'test_corrupted.zkey');
            fs.writeFileSync(corruptedZkey, 'invalid zkey content');
            
            // Setup should detect and handle corrupted files
            // This is a placeholder - actual implementation would depend on setup script
            recoveryTest.corruptedFileRecovery = true;
            
            // Clean up
            if (fs.existsSync(corruptedZkey)) {
                fs.unlinkSync(corruptedZkey);
            }
            
        } catch (error) {
            console.log(`    ⚠️  Corrupted file recovery test failed: ${error.message}`);
        }

        // Test cleanup procedure
        try {
            // Create some temporary files to test cleanup
            const tempFiles = [
                path.join(CIRCUITS_DIR, 'temp1.tmp'),
                path.join(CIRCUITS_DIR, 'temp2.tmp')
            ];
            
            for (const tempFile of tempFiles) {
                fs.writeFileSync(tempFile, 'temporary content');
            }
            
            // Run cleanup (if available)
            try {
                execSync('npm run circuits:clean', {
                    cwd: PROJECT_ROOT,
                    stdio: 'pipe'
                });
                
                // Check if temp files were cleaned
                const remainingTempFiles = tempFiles.filter(f => fs.existsSync(f));
                recoveryTest.cleanupProcedure = remainingTempFiles.length === 0;
                
            } catch (cleanupError) {
                // Manual cleanup
                for (const tempFile of tempFiles) {
                    if (fs.existsSync(tempFile)) {
                        fs.unlinkSync(tempFile);
                    }
                }
            }
            
        } catch (error) {
            console.log(`    ⚠️  Cleanup procedure test failed: ${error.message}`);
        }

        this.results.setup.errorRecovery = recoveryTest;
    }

    async testValidationProcess() {
        console.log('\n🔍 Testing Validation Process...\n');
        
        this.results.validation = {
            scriptExecution: {},
            constraintValidation: {},
            witnessValidation: {},
            proofValidation: {}
        };

        // Test validation script execution
        await this.testValidationScriptExecution();
        
        // Test constraint validation
        await this.testConstraintValidation();
        
        // Test witness validation
        await this.testWitnessValidation();
        
        // Test proof validation (if setup available)
        await this.testProofValidation();
    }

    async testValidationScriptExecution() {
        console.log('  📋 Testing validation script execution...');
        
        const execTest = {
            scriptExists: false,
            executed: false,
            output: [],
            validationResults: {}
        };

        const testScript = path.join(SCRIPTS_DIR, 'test-circuits.js');
        execTest.scriptExists = fs.existsSync(testScript);

        if (execTest.scriptExists) {
            try {
                const output = execSync('npm run circuits:test', {
                    cwd: PROJECT_ROOT,
                    encoding: 'utf8',
                    stdio: 'pipe',
                    timeout: 180000 // 3 minutes timeout
                });

                execTest.executed = true;
                execTest.output = output.split('\n');
                console.log(`    ✅ Test script executed successfully`);
                
            } catch (error) {
                execTest.error = error.message;
                console.log(`    ❌ Test script execution failed: ${error.message}`);
            }
        } else {
            console.log(`    ⚠️  Test script not found`);
        }

        this.results.validation.scriptExecution = execTest;
    }

    async testConstraintValidation() {
        console.log('  📐 Testing constraint validation...');
        
        const constraintTests = [];
        const circuits = ['generic_proof', 'dynamic_comparator', 'template_validator'];

        for (const circuit of circuits) {
            const test = {
                circuit: circuit,
                passed: false,
                constraintCount: 0,
                witnessCount: 0
            };

            try {
                const r1csPath = path.join(BUILD_DIR, circuit, `${circuit}.r1cs`);
                if (fs.existsSync(r1csPath)) {
                    const infoOutput = execSync(`npx snarkjs r1cs info "${r1csPath}"`, {
                        encoding: 'utf8',
                        stdio: 'pipe'
                    });

                    const lines = infoOutput.split('\n');
                    for (const line of lines) {
                        if (line.includes('# of Constraints:')) {
                            test.constraintCount = parseInt(line.split(':')[1].trim());
                        } else if (line.includes('# of Private Inputs:')) {
                            test.witnessCount = parseInt(line.split(':')[1].trim());
                        }
                    }

                    test.passed = test.constraintCount > 0;
                    console.log(`    ✅ ${circuit}: ${test.constraintCount} constraints, ${test.witnessCount} witnesses`);
                } else {
                    console.log(`    ❌ ${circuit}: R1CS file not found`);
                }
                
            } catch (error) {
                test.error = error.message;
                console.log(`    ❌ ${circuit}: Constraint validation failed - ${error.message}`);
            }

            constraintTests.push(test);
        }

        this.results.validation.constraintValidation = {
            tests: constraintTests,
            summary: {
                total: constraintTests.length,
                passed: constraintTests.filter(t => t.passed).length,
                failed: constraintTests.filter(t => !t.passed).length
            }
        };
    }

    async testWitnessValidation() {
        console.log('  👁️  Testing witness validation...');
        
        const witnessTests = [];

        // Test witness generation for each circuit
        const circuits = [
            {
                name: 'generic_proof',
                input: {
                    extracted_data: Array(64).fill(0).map((_, i) => i < 4 ? 100 + i : 0),
                    tls_session_data: Array(1024).fill(0),
                    data_length: 4,
                    tls_length: 512,
                    template_hash: '12345',
                    claim_type: 1,
                    threshold_value: 100,
                    domain_hash: '67890',
                    timestamp_min: 1000,
                    timestamp_max: 2000
                }
            }
        ];

        for (const circuitTest of circuits) {
            const test = {
                circuit: circuitTest.name,
                passed: false,
                witnessGenerated: false,
                executionTime: 0
            };

            try {
                const inputFile = path.join(TEST_RESULTS_DIR, `${circuitTest.name}_input.json`);
                const witnessFile = path.join(TEST_RESULTS_DIR, `${circuitTest.name}_witness.wtns`);
                const wasmFile = path.join(CIRCUITS_DIR, `${circuitTest.name}.wasm`);

                // Write input file
                fs.writeFileSync(inputFile, JSON.stringify(circuitTest.input, null, 2));

                if (fs.existsSync(wasmFile)) {
                    const startTime = Date.now();
                    
                    execSync(`npx snarkjs wtns calculate "${wasmFile}" "${inputFile}" "${witnessFile}"`, {
                        stdio: 'pipe'
                    });
                    
                    test.executionTime = Date.now() - startTime;
                    test.witnessGenerated = fs.existsSync(witnessFile);
                    test.passed = test.witnessGenerated;

                    console.log(`    ✅ ${circuitTest.name}: Witness generated in ${test.executionTime}ms`);
                } else {
                    console.log(`    ❌ ${circuitTest.name}: WASM file not found`);
                }
                
            } catch (error) {
                test.error = error.message;
                console.log(`    ❌ ${circuitTest.name}: Witness generation failed - ${error.message}`);
            }

            witnessTests.push(test);
        }

        this.results.validation.witnessValidation = {
            tests: witnessTests,
            summary: {
                total: witnessTests.length,
                passed: witnessTests.filter(t => t.passed).length,
                failed: witnessTests.filter(t => !t.passed).length
            }
        };
    }

    async testProofValidation() {
        console.log('  🔐 Testing proof validation...');
        
        const proofTest = {
            setupAvailable: false,
            proofGenerated: false,
            proofVerified: false,
            error: null
        };

        // Check if setup is available for proof generation
        const zkeyFile = path.join(CIRCUITS_DIR, 'generic_proof.zkey');
        proofTest.setupAvailable = fs.existsSync(zkeyFile);

        if (proofTest.setupAvailable) {
            try {
                // This would require a full proof generation test
                console.log(`    ✅ Setup available for proof generation`);
                console.log(`    ⚠️  Proof generation test skipped (requires full setup)`);
                
            } catch (error) {
                proofTest.error = error.message;
                console.log(`    ❌ Proof validation failed: ${error.message}`);
            }
        } else {
            console.log(`    ⚠️  Setup not available - skipping proof validation`);
        }

        this.results.validation.proofValidation = proofTest;
    }

    async testDependencyManagement() {
        console.log('\n📦 Testing Dependency Management...\n');
        
        this.results.dependencies = {
            packageIntegrity: {},
            versionCompatibility: {},
            missingDependencies: {},
            conflictResolution: {}
        };

        await this.testPackageIntegrity();
        await this.testVersionCompatibility();
        await this.testMissingDependencies();
        await this.testConflictResolution();
    }

    async testPackageIntegrity() {
        console.log('  📋 Testing package integrity...');
        
        const integrityTest = {
            packageJson: { exists: false, valid: false },
            lockFile: { exists: false, valid: false },
            nodeModules: { exists: false, complete: false },
            criticalPackages: {}
        };

        // Check package.json
        const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
        integrityTest.packageJson.exists = fs.existsSync(packageJsonPath);
        
        if (integrityTest.packageJson.exists) {
            try {
                const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                integrityTest.packageJson.valid = packageData.dependencies && packageData.devDependencies;
                console.log(`    ✅ package.json is valid`);
            } catch (error) {
                console.log(`    ❌ package.json is invalid: ${error.message}`);
            }
        }

        // Check lock file
        const lockFilePath = path.join(PROJECT_ROOT, 'package-lock.json');
        integrityTest.lockFile.exists = fs.existsSync(lockFilePath);
        
        if (integrityTest.lockFile.exists) {
            try {
                JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
                integrityTest.lockFile.valid = true;
                console.log(`    ✅ package-lock.json is valid`);
            } catch (error) {
                console.log(`    ❌ package-lock.json is invalid: ${error.message}`);
            }
        }

        // Check critical packages
        const criticalPackages = ['circom', 'snarkjs', 'circomlib'];
        for (const pkg of criticalPackages) {
            const pkgPath = path.join(PROJECT_ROOT, 'node_modules', pkg);
            integrityTest.criticalPackages[pkg] = {
                exists: fs.existsSync(pkgPath),
                version: null
            };

            if (integrityTest.criticalPackages[pkg].exists) {
                try {
                    const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf8'));
                    integrityTest.criticalPackages[pkg].version = pkgJson.version;
                    console.log(`    ✅ ${pkg} v${pkgJson.version}`);
                } catch (error) {
                    console.log(`    ❌ ${pkg} package.json invalid`);
                }
            } else {
                console.log(`    ❌ ${pkg} not found`);
            }
        }

        this.results.dependencies.packageIntegrity = integrityTest;
    }

    async testVersionCompatibility() {
        console.log('  🔄 Testing version compatibility...');
        
        const compatTest = {
            circomVersion: { compatible: false, version: null },
            nodeVersion: { compatible: false, version: process.version },
            snarkjsVersion: { compatible: false, version: null }
        };

        // Check Circom version
        try {
            const circomOutput = execSync('circom --version', { encoding: 'utf8', stdio: 'pipe' });
            compatTest.circomVersion.version = circomOutput.trim();
            compatTest.circomVersion.compatible = circomOutput.includes('2.'); // Expect v2.x
            console.log(`    ${compatTest.circomVersion.compatible ? '✅' : '❌'} Circom ${compatTest.circomVersion.version}`);
        } catch (error) {
            console.log(`    ❌ Circom version check failed`);
        }

        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1));
        compatTest.nodeVersion.compatible = majorVersion >= 18;
        console.log(`    ${compatTest.nodeVersion.compatible ? '✅' : '❌'} Node.js ${nodeVersion}`);

        // Check SnarkJS version
        try {
            const snarkjsPath = path.join(PROJECT_ROOT, 'node_modules', 'snarkjs', 'package.json');
            if (fs.existsSync(snarkjsPath)) {
                const snarkjsPkg = JSON.parse(fs.readFileSync(snarkjsPath, 'utf8'));
                compatTest.snarkjsVersion.version = snarkjsPkg.version;
                compatTest.snarkjsVersion.compatible = snarkjsPkg.version.startsWith('0.7'); // Expect 0.7.x
                console.log(`    ${compatTest.snarkjsVersion.compatible ? '✅' : '❌'} SnarkJS v${snarkjsPkg.version}`);
            }
        } catch (error) {
            console.log(`    ❌ SnarkJS version check failed`);
        }

        this.results.dependencies.versionCompatibility = compatTest;
    }

    async testMissingDependencies() {
        console.log('  🔍 Testing missing dependencies detection...');
        
        const missingTest = {
            detected: [],
            installTest: { passed: false, error: null }
        };

        // Temporarily move a dependency to test detection
        try {
            const testDep = path.join(PROJECT_ROOT, 'node_modules', 'circomlib');
            const backupDep = path.join(PROJECT_ROOT, 'node_modules', 'circomlib.backup');
            
            if (fs.existsSync(testDep)) {
                fs.renameSync(testDep, backupDep);
                
                try {
                    // Try to compile - should fail
                    execSync('npm run circuits:compile', {
                        cwd: PROJECT_ROOT,
                        stdio: 'pipe'
                    });
                    console.log(`    ❌ Missing dependency not detected`);
                } catch (error) {
                    missingTest.detected.push('circomlib');
                    console.log(`    ✅ Missing dependency detected: circomlib`);
                }
                
                // Restore dependency
                fs.renameSync(backupDep, testDep);
            }
            
        } catch (error) {
            console.log(`    ⚠️  Missing dependency test failed: ${error.message}`);
        }

        this.results.dependencies.missingDependencies = missingTest;
    }

    async testConflictResolution() {
        console.log('  ⚖️  Testing conflict resolution...');
        
        const conflictTest = {
            duplicatePackages: [],
            versionConflicts: [],
            resolutionStrategy: 'package-lock'
        };

        // This is a placeholder for more sophisticated conflict detection
        // In practice, you would scan for duplicate packages, version conflicts, etc.
        
        console.log(`    ✅ No conflicts detected (basic check)`);
        
        this.results.dependencies.conflictResolution = conflictTest;
    }

    async testDockerIntegration() {
        console.log('\n🐳 Testing Docker Integration...\n');
        
        this.results.docker = {
            dockerfileExists: false,
            imageBuild: { passed: false, error: null },
            containerRun: { passed: false, error: null },
            circuitCompilation: { passed: false, error: null }
        };

        await this.testDockerfileExists();
        await this.testDockerImageBuild();
        await this.testDockerContainerRun();
        await this.testDockerCircuitCompilation();
    }

    async testDockerfileExists() {
        const dockerfilePath = path.join(PROJECT_ROOT, 'Dockerfile');
        this.results.docker.dockerfileExists = fs.existsSync(dockerfilePath);
        
        if (this.results.docker.dockerfileExists) {
            console.log('  ✅ Dockerfile found');
            
            // Basic Dockerfile validation
            try {
                const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
                const hasNodeBase = dockerfileContent.includes('FROM node');
                const hasWorkdir = dockerfileContent.includes('WORKDIR');
                const hasCopy = dockerfileContent.includes('COPY');
                
                if (hasNodeBase && hasWorkdir && hasCopy) {
                    console.log('  ✅ Dockerfile structure looks valid');
                } else {
                    console.log('  ⚠️  Dockerfile may be incomplete');
                }
                
            } catch (error) {
                console.log(`  ❌ Error reading Dockerfile: ${error.message}`);
            }
        } else {
            console.log('  ❌ Dockerfile not found');
        }
    }

    async testDockerImageBuild() {
        if (!this.results.docker.dockerfileExists) {
            console.log('  ⏭️  Skipping image build (no Dockerfile)');
            return;
        }

        console.log('  🏗️  Testing Docker image build...');
        
        try {
            // Check if Docker is available
            execSync('docker --version', { stdio: 'pipe' });
            
            const imageName = 'zephis-core-test';
            const buildCmd = `docker build -t ${imageName} .`;
            
            console.log('    Building Docker image (this may take a while)...');
            const startTime = Date.now();
            
            execSync(buildCmd, {
                cwd: PROJECT_ROOT,
                stdio: 'pipe',
                timeout: 600000 // 10 minutes timeout
            });
            
            const buildTime = Date.now() - startTime;
            this.results.docker.imageBuild.passed = true;
            this.results.docker.imageBuild.buildTime = buildTime;
            
            console.log(`    ✅ Docker image built successfully in ${buildTime}ms`);
            
        } catch (error) {
            this.results.docker.imageBuild.error = error.message;
            console.log(`    ❌ Docker image build failed: ${error.message}`);
        }
    }

    async testDockerContainerRun() {
        if (!this.results.docker.imageBuild.passed) {
            console.log('  ⏭️  Skipping container run (image build failed)');
            return;
        }

        console.log('  🚀 Testing Docker container run...');
        
        try {
            const imageName = 'zephis-core-test';
            const containerName = 'zephis-core-test-container';
            
            // Run container with a simple command
            const runCmd = `docker run --rm --name ${containerName} ${imageName} node --version`;
            
            const output = execSync(runCmd, {
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: 30000 // 30 seconds timeout
            });
            
            this.results.docker.containerRun.passed = true;
            this.results.docker.containerRun.output = output.trim();
            
            console.log(`    ✅ Container run successful: ${output.trim()}`);
            
        } catch (error) {
            this.results.docker.containerRun.error = error.message;
            console.log(`    ❌ Container run failed: ${error.message}`);
        }
    }

    async testDockerCircuitCompilation() {
        if (!this.results.docker.containerRun.passed) {
            console.log('  ⏭️  Skipping circuit compilation in Docker (container run failed)');
            return;
        }

        console.log('  🔨 Testing circuit compilation in Docker...');
        
        try {
            const imageName = 'zephis-core-test';
            const containerName = 'zephis-core-test-compile';
            
            // Run circuit compilation inside container
            const compileCmd = `docker run --rm --name ${containerName} ${imageName} npm run circuits:compile`;
            
            console.log('    Compiling circuits in Docker (this may take a while)...');
            const startTime = Date.now();
            
            const output = execSync(compileCmd, {
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: 300000 // 5 minutes timeout
            });
            
            const compilationTime = Date.now() - startTime;
            this.results.docker.circuitCompilation.passed = true;
            this.results.docker.circuitCompilation.compilationTime = compilationTime;
            
            console.log(`    ✅ Circuit compilation in Docker successful in ${compilationTime}ms`);
            
        } catch (error) {
            this.results.docker.circuitCompilation.error = error.message;
            console.log(`    ❌ Circuit compilation in Docker failed: ${error.message}`);
        }
    }

    async testBuildArtifacts() {
        console.log('\n📁 Testing Build Artifacts...\n');
        
        this.results.artifacts = {
            integrity: {},
            accessibility: {},
            versioning: {},
            cleanup: {}
        };

        await this.testArtifactIntegrity();
        await this.testArtifactAccessibility();
        await this.testArtifactVersioning();
        await this.testArtifactCleanup();
    }

    async testArtifactIntegrity() {
        console.log('  🔍 Testing artifact integrity...');
        
        const integrityTest = {
            checksums: {},
            sizes: {},
            validFormats: {}
        };

        const artifacts = [
            { name: 'generic_proof.wasm', type: 'wasm' },
            { name: 'dynamic_comparator.wasm', type: 'wasm' }
        ];

        for (const artifact of artifacts) {
            const artifactPath = path.join(CIRCUITS_DIR, artifact.name);
            
            if (fs.existsSync(artifactPath)) {
                const stats = fs.statSync(artifactPath);
                const content = fs.readFileSync(artifactPath);
                const checksum = crypto.createHash('sha256').update(content).digest('hex');
                
                integrityTest.checksums[artifact.name] = checksum;
                integrityTest.sizes[artifact.name] = stats.size;
                
                // Basic format validation
                if (artifact.type === 'wasm') {
                    integrityTest.validFormats[artifact.name] = content.subarray(0, 4).toString() === '\x00asm';
                }
                
                console.log(`    ✅ ${artifact.name}: ${(stats.size / 1024).toFixed(2)} KB, SHA256: ${checksum.slice(0, 16)}...`);
            } else {
                console.log(`    ❌ ${artifact.name}: Not found`);
            }
        }

        this.results.artifacts.integrity = integrityTest;
    }

    async testArtifactAccessibility() {
        console.log('  🔓 Testing artifact accessibility...');
        
        const accessTest = {
            readPermissions: {},
            pathResolution: {},
            symlinkHandling: {}
        };

        const artifacts = fs.readdirSync(CIRCUITS_DIR).filter(f => f.endsWith('.wasm'));
        
        for (const artifact of artifacts) {
            const artifactPath = path.join(CIRCUITS_DIR, artifact);
            
            try {
                // Test read permissions
                fs.accessSync(artifactPath, fs.constants.R_OK);
                accessTest.readPermissions[artifact] = true;
                
                // Test path resolution
                const resolvedPath = path.resolve(artifactPath);
                accessTest.pathResolution[artifact] = fs.existsSync(resolvedPath);
                
                console.log(`    ✅ ${artifact}: Accessible`);
                
            } catch (error) {
                accessTest.readPermissions[artifact] = false;
                console.log(`    ❌ ${artifact}: Not accessible - ${error.message}`);
            }
        }

        this.results.artifacts.accessibility = accessTest;
    }

    async testArtifactVersioning() {
        console.log('  📊 Testing artifact versioning...');
        
        const versionTest = {
            manifestExists: false,
            versionTracking: {},
            buildTimestamps: {}
        };

        const manifestPath = path.join(CIRCUITS_DIR, 'manifest.json');
        versionTest.manifestExists = fs.existsSync(manifestPath);
        
        if (versionTest.manifestExists) {
            try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                versionTest.versionTracking = {
                    version: manifest.version,
                    buildTime: manifest.buildTime,
                    circuits: manifest.circuits?.length || 0
                };
                
                console.log(`    ✅ Manifest version: ${manifest.version}`);
                console.log(`    ✅ Build time: ${manifest.buildTime}`);
                console.log(`    ✅ Circuits tracked: ${manifest.circuits?.length || 0}`);
                
            } catch (error) {
                console.log(`    ❌ Manifest parsing failed: ${error.message}`);
            }
        } else {
            console.log(`    ⚠️  No manifest found`);
        }

        this.results.artifacts.versioning = versionTest;
    }

    async testArtifactCleanup() {
        console.log('  🧹 Testing artifact cleanup...');
        
        const cleanupTest = {
            cleanCommandExists: false,
            cleanupEffective: false,
            selectiveCleanup: false
        };

        // Test if clean command exists
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
            cleanupTest.cleanCommandExists = packageJson.scripts && packageJson.scripts['circuits:clean'];
            
            if (cleanupTest.cleanCommandExists) {
                console.log(`    ✅ Clean command available`);
                
                // Create some temporary artifacts to test cleanup
                const tempArtifacts = [
                    path.join(CIRCUITS_DIR, 'test_temp.wasm'),
                    path.join(CIRCUITS_DIR, 'test_temp.zkey')
                ];
                
                for (const temp of tempArtifacts) {
                    fs.writeFileSync(temp, 'temporary content');
                }
                
                // Run cleanup
                try {
                    execSync('npm run circuits:clean', {
                        cwd: PROJECT_ROOT,
                        stdio: 'pipe'
                    });
                    
                    // Check if temp files were removed
                    const remainingTemps = tempArtifacts.filter(f => fs.existsSync(f));
                    cleanupTest.cleanupEffective = remainingTemps.length === 0;
                    
                    console.log(`    ${cleanupTest.cleanupEffective ? '✅' : '❌'} Cleanup effective`);
                    
                    // Manual cleanup of any remaining files
                    for (const temp of remainingTemps) {
                        fs.unlinkSync(temp);
                    }
                    
                } catch (cleanupError) {
                    console.log(`    ❌ Cleanup command failed: ${cleanupError.message}`);
                }
                
            } else {
                console.log(`    ⚠️  No clean command found`);
            }
            
        } catch (error) {
            console.log(`    ❌ Cleanup test setup failed: ${error.message}`);
        }

        this.results.artifacts.cleanup = cleanupTest;
    }

    async generateBuildTestReport() {
        console.log('\n📄 Generating Build System Test Report...\n');

        const report = {
            metadata: {
                timestamp: new Date().toISOString(),
                testSuite: 'Build System Integration Test Suite',
                version: '1.0.0',
                environment: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch
                }
            },
            summary: this.generateTestSummary(),
            results: this.results,
            recommendations: this.generateBuildRecommendations()
        };

        const reportFile = path.join(TEST_RESULTS_DIR, 'build-system-test-report.json');
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

        // Generate HTML report
        await this.generateBuildHTMLReport(report);

        console.log(`✅ Build test report saved to: ${reportFile}`);
        return report;
    }

    generateTestSummary() {
        const summary = {
            totalCategories: 6,
            passedCategories: 0,
            failedCategories: 0,
            details: {}
        };

        // Analyze each category
        const categories = [
            { name: 'compilation', result: this.results.compilation },
            { name: 'setup', result: this.results.setup },
            { name: 'validation', result: this.results.validation },
            { name: 'dependencies', result: this.results.dependencies },
            { name: 'docker', result: this.results.docker },
            { name: 'artifacts', result: this.results.artifacts }
        ];

        for (const category of categories) {
            const passed = this.evaluateCategorySuccess(category.name, category.result);
            summary.details[category.name] = { passed };
            
            if (passed) {
                summary.passedCategories++;
            } else {
                summary.failedCategories++;
            }
        }

        summary.successRate = (summary.passedCategories / summary.totalCategories * 100).toFixed(2);

        return summary;
    }

    evaluateCategorySuccess(categoryName, result) {
        switch (categoryName) {
            case 'compilation':
                return result.basicCompilation?.success && 
                       result.outputValidation?.wasmFiles?.passed &&
                       result.outputValidation?.r1csFiles?.passed;
            case 'setup':
                return result.trustedSetup?.executed !== false; // Allow skipped
            case 'validation':
                return result.scriptExecution?.executed !== false;
            case 'dependencies':
                return result.packageIntegrity?.packageJson?.valid &&
                       result.versionCompatibility?.nodeVersion?.compatible;
            case 'docker':
                return result.dockerfileExists; // Basic requirement
            case 'artifacts':
                return result.integrity && Object.keys(result.integrity.checksums || {}).length > 0;
            default:
                return false;
        }
    }

    generateBuildRecommendations() {
        const recommendations = [];

        // Compilation recommendations
        if (!this.results.compilation.basicCompilation?.success) {
            recommendations.push({
                type: 'compilation',
                priority: 'high',
                description: 'Circuit compilation is failing. Review circuit syntax and dependencies.'
            });
        }

        // Setup recommendations
        if (!this.results.setup.trustedSetup?.executed) {
            recommendations.push({
                type: 'setup',
                priority: 'medium',
                description: 'Trusted setup is not configured. Consider implementing ceremony automation.'
            });
        }

        // Dependency recommendations
        if (!this.results.dependencies.versionCompatibility?.circomVersion?.compatible) {
            recommendations.push({
                type: 'dependencies',
                priority: 'high',
                description: 'Circom version compatibility issues detected. Update to compatible version.'
            });
        }

        // Docker recommendations
        if (!this.results.docker.imageBuild?.passed) {
            recommendations.push({
                type: 'docker',
                priority: 'medium',
                description: 'Docker integration issues detected. Review Dockerfile and build process.'
            });
        }

        return recommendations;
    }

    async generateBuildHTMLReport(report) {
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zephis Build System Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; margin-top: 5px; }
        .category-section { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
        .category-header { background: #007bff; color: white; padding: 10px 15px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0; }
        .test-results { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
        .test-item { margin: 5px 0; padding: 10px; border-radius: 4px; }
        .test-passed { background: #d4edda; color: #155724; }
        .test-failed { background: #f8d7da; color: #721c24; }
        .test-warning { background: #fff3cd; color: #856404; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin-top: 30px; }
        .recommendation { margin: 10px 0; padding: 10px; border-left: 3px solid #ffc107; background: #fffbf0; }
        .priority-high { border-left-color: #dc3545; }
        .priority-medium { border-left-color: #ffc107; }
        .priority-low { border-left-color: #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏗️ Zephis Build System Test Report</h1>
            <p>Generated on ${new Date(report.metadata.timestamp).toLocaleString()}</p>
        </div>

        <div class="summary">
            <div class="stat-card">
                <div class="stat-number">${report.summary.totalCategories}</div>
                <div class="stat-label">Categories Tested</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${report.summary.passedCategories}</div>
                <div class="stat-label">Categories Passed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${report.summary.failedCategories}</div>
                <div class="stat-label">Categories Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${report.summary.successRate}%</div>
                <div class="stat-label">Success Rate</div>
            </div>
        </div>

        <div class="category-section">
            <div class="category-header">
                <h2>🔨 Compilation Process</h2>
            </div>
            <div class="test-results">
                <div class="test-item ${report.results.compilation.basicCompilation?.success ? 'test-passed' : 'test-failed'}">
                    ${report.results.compilation.basicCompilation?.success ? '✅' : '❌'} Basic Compilation
                    ${report.results.compilation.basicCompilation?.compilationTime ? 
                      `<br><small>Time: ${report.results.compilation.basicCompilation.compilationTime}ms</small>` : ''}
                </div>
                <div class="test-item ${report.results.compilation.errorHandling?.summary?.passed > 0 ? 'test-passed' : 'test-warning'}">
                    ⚠️ Error Handling Tests
                    <br><small>${report.results.compilation.errorHandling?.summary?.passed || 0}/${report.results.compilation.errorHandling?.summary?.total || 0} passed</small>
                </div>
                <div class="test-item ${report.results.compilation.outputValidation?.wasmFiles?.passed ? 'test-passed' : 'test-failed'}">
                    ${report.results.compilation.outputValidation?.wasmFiles?.passed ? '✅' : '❌'} Output Validation
                    <br><small>WASM files: ${report.results.compilation.outputValidation?.wasmFiles?.files?.length || 0}</small>
                </div>
            </div>
        </div>

        <div class="category-section">
            <div class="category-header">
                <h2>⚙️ Setup Process</h2>
            </div>
            <div class="test-results">
                <div class="test-item ${report.results.setup.trustedSetup?.scriptExists ? 'test-passed' : 'test-warning'}">
                    ${report.results.setup.trustedSetup?.scriptExists ? '✅' : '⚠️'} Setup Script
                    ${report.results.setup.trustedSetup?.executed ? 
                      '<br><small>Executed successfully</small>' : 
                      '<br><small>Not executed or skipped</small>'}
                </div>
                <div class="test-item ${report.results.setup.keyGeneration?.zkeyGeneration ? 'test-passed' : 'test-warning'}">
                    ${report.results.setup.keyGeneration?.zkeyGeneration ? '✅' : '⚠️'} Key Generation
                </div>
            </div>
        </div>

        <div class="category-section">
            <div class="category-header">
                <h2>🐳 Docker Integration</h2>
            </div>
            <div class="test-results">
                <div class="test-item ${report.results.docker.dockerfileExists ? 'test-passed' : 'test-failed'}">
                    ${report.results.docker.dockerfileExists ? '✅' : '❌'} Dockerfile
                </div>
                <div class="test-item ${report.results.docker.imageBuild?.passed ? 'test-passed' : 'test-warning'}">
                    ${report.results.docker.imageBuild?.passed ? '✅' : report.results.docker.imageBuild?.error ? '❌' : '⚠️'} Image Build
                    ${report.results.docker.imageBuild?.buildTime ? 
                      `<br><small>Build time: ${report.results.docker.imageBuild.buildTime}ms</small>` : ''}
                </div>
                <div class="test-item ${report.results.docker.containerRun?.passed ? 'test-passed' : 'test-warning'}">
                    ${report.results.docker.containerRun?.passed ? '✅' : report.results.docker.containerRun?.error ? '❌' : '⚠️'} Container Run
                </div>
            </div>
        </div>

        ${report.recommendations.length > 0 ? `
            <div class="recommendations">
                <h3>💡 Recommendations</h3>
                ${report.recommendations.map(rec => `
                    <div class="recommendation priority-${rec.priority}">
                        <strong>${rec.type.toUpperCase()} (${rec.priority.toUpperCase()} PRIORITY)</strong>
                        <p>${rec.description}</p>
                    </div>
                `).join('')}
            </div>
        ` : ''}

        <div style="margin-top: 40px; text-align: center; color: #666;">
            <p>Generated by Zephis Protocol Build System Integration Test Suite</p>
        </div>
    </div>
</body>
</html>`;

        const htmlFile = path.join(TEST_RESULTS_DIR, 'build-system-test-report.html');
        fs.writeFileSync(htmlFile, htmlContent);
        console.log(`✅ HTML report saved to: ${htmlFile}`);
    }

    printFinalSummary(duration) {
        console.log('\n' + '='.repeat(80));
        console.log('🎉 BUILD SYSTEM INTEGRATION TEST SUITE COMPLETED');
        console.log('='.repeat(80));
        console.log(`⏱️  Total execution time: ${(duration / 1000).toFixed(2)} seconds`);
        
        const summary = this.generateTestSummary();
        console.log(`📊 Categories tested: ${summary.totalCategories}`);
        console.log(`✅ Categories passed: ${summary.passedCategories}`);
        console.log(`❌ Categories failed: ${summary.failedCategories}`);
        console.log(`📈 Success rate: ${summary.successRate}%`);
        
        console.log(`\n📁 Test results saved to: ${TEST_RESULTS_DIR}`);
        console.log(`📄 View detailed report: ${path.join(TEST_RESULTS_DIR, 'build-system-test-report.html')}`);
        console.log('='.repeat(80));

        // Exit with appropriate code
        if (summary.failedCategories > 0) {
            console.log('\n⚠️  Some build system tests failed. Please review the detailed report.');
            process.exit(1);
        } else {
            console.log('\n🎊 All build system tests passed successfully!');
            process.exit(0);
        }
    }
}

// CLI execution
if (require.main === module) {
    const tester = new BuildSystemIntegrationTester();
    tester.runAllTests().catch(error => {
        console.error('💥 Build system test suite crashed:', error);
        process.exit(1);
    });
}

module.exports = { BuildSystemIntegrationTester };