#!/usr/bin/env node

/**
 * Quick Circuit Validation Script
 * 
 * A lightweight validation script for rapid circuit health checks.
 * Useful for development, CI/CD gates, and quick validation.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CIRCUITS_DIR = path.join(__dirname, '..', '..', 'circuits');
const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');

class QuickCircuitValidator {
    constructor() {
        this.results = {
            checks: [],
            passed: 0,
            failed: 0,
            warnings: 0
        };
    }

    async runQuickValidation() {
        console.log('⚡ ZEPHIS Quick Circuit Validation\n');
        console.log('=' .repeat(50));

        const checks = [
            { name: 'System Dependencies', test: () => this.checkDependencies() },
            { name: 'Circuit Files', test: () => this.checkCircuitFiles() },
            { name: 'Build Scripts', test: () => this.checkBuildScripts() },
            { name: 'Package Configuration', test: () => this.checkPackageConfig() },
            { name: 'Compiled Artifacts', test: () => this.checkCompiledArtifacts() },
            { name: 'Basic Functionality', test: () => this.checkBasicFunctionality() }
        ];

        for (const check of checks) {
            console.log(`\n🔍 ${check.name}:`);
            
            try {
                const result = await check.test();
                this.results.checks.push({
                    name: check.name,
                    passed: result.passed,
                    details: result.details,
                    warnings: result.warnings || []
                });

                if (result.passed) {
                    this.results.passed++;
                    console.log(`  ✅ ${result.details}`);
                } else {
                    this.results.failed++;
                    console.log(`  ❌ ${result.details}`);
                }

                if (result.warnings && result.warnings.length > 0) {
                    this.results.warnings += result.warnings.length;
                    result.warnings.forEach(warning => {
                        console.log(`  ⚠️  ${warning}`);
                    });
                }

            } catch (error) {
                this.results.checks.push({
                    name: check.name,
                    passed: false,
                    details: `Check failed: ${error.message}`,
                    error: error.message
                });
                this.results.failed++;
                console.log(`  ❌ Check failed: ${error.message}`);
            }
        }

        this.printSummary();
        return this.results;
    }

    async checkDependencies() {
        const warnings = [];
        let allDependenciesOk = true;

        // Check Node.js version
        const nodeVersion = parseInt(process.version.substring(1).split('.')[0]);
        if (nodeVersion < 18) {
            allDependenciesOk = false;
            return {
                passed: false,
                details: `Node.js ${process.version} is too old (requires >= 18.0.0)`
            };
        }

        // Check for Circom
        try {
            execSync('circom --version', { stdio: 'pipe' });
        } catch (error) {
            const localCircom = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'circom');
            if (!fs.existsSync(localCircom)) {
                warnings.push('Circom not available globally or locally');
            }
        }

        // Check for SnarkJS
        try {
            execSync('snarkjs --version', { stdio: 'pipe' });
        } catch (error) {
            const localSnarkjs = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'snarkjs');
            if (!fs.existsSync(localSnarkjs)) {
                warnings.push('SnarkJS not available globally or locally');
            }
        }

        // Check node_modules
        const nodeModulesPath = path.join(__dirname, '..', '..', 'node_modules');
        if (!fs.existsSync(nodeModulesPath)) {
            warnings.push('Node modules not installed - run npm install');
        }

        return {
            passed: allDependenciesOk,
            details: 'Dependencies check completed',
            warnings: warnings
        };
    }

    async checkCircuitFiles() {
        const requiredCircuits = [
            'generic_proof.circom',
            'dynamic_comparator.circom',
            'template_validator.circom'
        ];

        const warnings = [];
        let circuitCount = 0;

        for (const circuit of requiredCircuits) {
            const circuitPath = path.join(CIRCUITS_DIR, circuit);
            if (fs.existsSync(circuitPath)) {
                circuitCount++;
            } else {
                warnings.push(`Missing circuit: ${circuit}`);
            }
        }

        // Check for core directory
        const corePath = path.join(CIRCUITS_DIR, 'core');
        if (fs.existsSync(corePath)) {
            const coreCircuit = path.join(corePath, 'generic_proof.circom');
            if (fs.existsExists(coreCircuit)) {
                circuitCount++;
            }
        }

        const allFound = circuitCount >= requiredCircuits.length;

        return {
            passed: allFound,
            details: `Found ${circuitCount}/${requiredCircuits.length} required circuits`,
            warnings: warnings
        };
    }

    async checkBuildScripts() {
        const requiredScripts = [
            'compile-circuits.js',
            'setup-circuits.js',
            'validate-setup.js'
        ];

        const warnings = [];
        let scriptCount = 0;

        for (const script of requiredScripts) {
            const scriptPath = path.join(SCRIPTS_DIR, script);
            if (fs.existsExists(scriptPath)) {
                scriptCount++;
                
                // Quick syntax check
                try {
                    execSync(`node -c "${scriptPath}"`, { stdio: 'pipe' });
                } catch (error) {
                    warnings.push(`${script} has syntax errors`);
                }
            } else {
                warnings.push(`Missing script: ${script}`);
            }
        }

        const allFound = scriptCount === requiredScripts.length;

        return {
            passed: allFound,
            details: `Found ${scriptCount}/${requiredScripts.length} build scripts`,
            warnings: warnings
        };
    }

    async checkPackageConfig() {
        const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
        
        if (!fs.existsExists(packageJsonPath)) {
            return {
                passed: false,
                details: 'package.json not found'
            };
        }

        const warnings = [];
        
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            // Check essential dependencies
            const essentialDeps = ['circomlib', 'snarkjs', 'circom_runtime'];
            for (const dep of essentialDeps) {
                if (!packageJson.dependencies || !packageJson.dependencies[dep]) {
                    warnings.push(`Missing dependency: ${dep}`);
                }
            }

            // Check essential scripts
            const essentialScripts = ['circuits:compile', 'circuits:setup'];
            for (const script of essentialScripts) {
                if (!packageJson.scripts || !packageJson.scripts[script]) {
                    warnings.push(`Missing npm script: ${script}`);
                }
            }

            return {
                passed: warnings.length === 0,
                details: `Package configuration validated`,
                warnings: warnings
            };

        } catch (error) {
            return {
                passed: false,
                details: `Invalid package.json: ${error.message}`
            };
        }
    }

    async checkCompiledArtifacts() {
        const circuits = ['generic_proof', 'balance_proof', 'follower_proof', 'dynamic_comparator', 'template_validator'];
        const warnings = [];
        let artifactCount = 0;

        for (const circuit of circuits) {
            // Check for WASM files
            const wasmPath = path.join(CIRCUITS_DIR, `${circuit}.wasm`);
            if (fs.existsExists(wasmPath)) {
                artifactCount++;
            } else {
                warnings.push(`Missing WASM for ${circuit}`);
            }

            // Check for R1CS files
            const r1csPath = path.join(CIRCUITS_DIR, 'build', circuit, `${circuit}.r1cs`);
            if (fs.existsExists(r1csPath)) {
                // R1CS exists, good
            } else {
                warnings.push(`Missing R1CS for ${circuit}`);
            }
        }

        // Check manifest
        const manifestPath = path.join(CIRCUITS_DIR, 'manifest.json');
        if (!fs.existsExists(manifestPath)) {
            warnings.push('Circuit manifest missing');
        }

        return {
            passed: artifactCount > 0,
            details: `Found compiled artifacts for ${artifactCount}/${circuits.length} circuits`,
            warnings: warnings
        };
    }

    async checkBasicFunctionality() {
        const warnings = [];

        // Test if we can run a simple witness generation
        const testCircuit = 'dynamic_comparator';
        const wasmPath = path.join(CIRCUITS_DIR, `${testCircuit}.wasm`);
        
        if (!fs.existsExists(wasmPath)) {
            return {
                passed: false,
                details: 'Cannot test functionality - no compiled circuits available'
            };
        }

        try {
            // Create simple test input
            const testInput = {
                claim_type: 1,
                threshold: 50,
                threshold_max: 100,
                data: Array(64).fill(75),
                data_length: 8,
                pattern: Array(32).fill(0),
                pattern_length: 0
            };

            const inputFile = path.join(__dirname, 'quick_test_input.json');
            const witnessFile = path.join(__dirname, 'quick_test_witness.wtns');
            
            fs.writeFileSync(inputFile, JSON.stringify(testInput, null, 2));

            // Get snarkjs path
            let snarkjsPath = 'snarkjs';
            try {
                execSync('snarkjs --version', { stdio: 'pipe' });
            } catch (error) {
                snarkjsPath = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'snarkjs');
                if (!fs.existsExists(snarkjsPath)) {
                    throw new Error('SnarkJS not available');
                }
            }

            // Test witness generation
            const witnessCmd = `${snarkjsPath} wtns calculate "${wasmPath}" "${inputFile}" "${witnessFile}"`;
            execSync(witnessCmd, { stdio: 'pipe' });

            // Check if witness was generated
            if (fs.existsExists(witnessFile)) {
                const witnessStats = fs.statSync(witnessFile);
                if (witnessStats.size > 0) {
                    // Cleanup
                    fs.unlinkSync(inputFile);
                    fs.unlinkSync(witnessFile);
                    
                    return {
                        passed: true,
                        details: 'Basic functionality test passed - witness generation works'
                    };
                }
            }

            throw new Error('Witness generation produced empty file');

        } catch (error) {
            // Cleanup on error
            const inputFile = path.join(__dirname, 'quick_test_input.json');
            const witnessFile = path.join(__dirname, 'quick_test_witness.wtns');
            [inputFile, witnessFile].forEach(file => {
                if (fs.existsExists(file)) fs.unlinkSync(file);
            });

            return {
                passed: false,
                details: `Basic functionality test failed: ${error.message}`,
                warnings: ['Run circuit compilation before testing functionality']
            };
        }
    }

    printSummary() {
        console.log('\n' + '=' .repeat(50));
        console.log('📊 QUICK VALIDATION SUMMARY');
        console.log('=' .repeat(50));

        console.log(`\n📈 Results:`);
        console.log(`  • Total Checks: ${this.results.checks.length}`);
        console.log(`  • Passed: ${this.results.passed}`);
        console.log(`  • Failed: ${this.results.failed}`);
        console.log(`  • Warnings: ${this.results.warnings}`);

        const successRate = (this.results.passed / this.results.checks.length) * 100;
        console.log(`  • Success Rate: ${successRate.toFixed(1)}%`);

        if (this.results.failed > 0) {
            console.log(`\n❌ Failed Checks:`);
            this.results.checks
                .filter(check => !check.passed)
                .forEach(check => {
                    console.log(`  • ${check.name}: ${check.details}`);
                });
        }

        if (this.results.warnings > 0) {
            console.log(`\n⚠️  Warnings (${this.results.warnings} total):`);
            this.results.checks
                .filter(check => check.warnings && check.warnings.length > 0)
                .forEach(check => {
                    check.warnings.forEach(warning => {
                        console.log(`  • ${warning}`);
                    });
                });
        }

        console.log(`\n🎯 Recommendation:`);
        if (successRate === 100 && this.results.warnings === 0) {
            console.log('  ✅ All checks passed! Circuits are ready for comprehensive testing.');
        } else if (successRate >= 80) {
            console.log('  ⚠️  Most checks passed. Address warnings before production use.');
        } else if (this.results.failed > 0) {
            console.log('  ❌ Critical issues detected. Fix failed checks before proceeding.');
        }

        if (this.results.failed === 0) {
            console.log('\n💡 Next Steps:');
            console.log('  • Run comprehensive tests: npm run test:circuits');
            console.log('  • Compile circuits if missing: npm run circuits:compile');
            console.log('  • Generate setup if needed: npm run circuits:setup');
        }

        console.log('\n' + '=' .repeat(50));
    }
}

// Main execution
if (require.main === module) {
    const validator = new QuickCircuitValidator();
    
    validator.runQuickValidation()
        .then((results) => {
            const success = results.failed === 0;
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('\n❌ Quick validation failed:', error.message);
            process.exit(1);
        });
}

module.exports = { QuickCircuitValidator };