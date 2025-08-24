#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const CIRCUITS_DIR = path.join(__dirname, '..', 'src', 'circuits');
const BUILD_DIR = path.join(CIRCUITS_DIR, 'build');
const TEST_DIR = path.join(__dirname, '..', 'test', 'circuits');
const NODE_MODULES_DIR = path.join(__dirname, '..', 'node_modules');

// Test configuration
const TEST_CONFIG = {
    circuits: ['generic_proof', 'balance_proof', 'follower_proof', 'dynamic_comparator', 'template_validator'],
    snarkjs: null
};

// Check if snarkjs is available
function checkSnarkjsInstalled() {
    try {
        execSync('snarkjs --version', { stdio: 'pipe' });
        console.log('✓ SnarkJS found in PATH');
        return 'snarkjs';
    } catch (error) {
        const localSnarkjs = path.join(NODE_MODULES_DIR, '.bin', 'snarkjs');
        if (fs.existsSync(localSnarkjs)) {
            console.log('✓ Using local SnarkJS installation');
            return localSnarkjs;
        }
        throw new Error('SnarkJS not found. Please install snarkjs globally or locally.');
    }
}

// Create test directory
function createTestDir() {
    if (!fs.existsSync(TEST_DIR)) {
        fs.mkdirSync(TEST_DIR, { recursive: true });
        console.log('✓ Created test directory');
    }
}

// Generate test inputs for different circuit types
function generateTestInputs(circuitName) {
    switch (circuitName) {
        case 'generic_proof':
            return generateGenericProofInputs();
        case 'balance_proof':
            return generateBalanceProofInputs();
        case 'follower_proof':
            return generateFollowerProofInputs();
        case 'dynamic_comparator':
            return generateComparatorInputs();
        case 'template_validator':
            return generateValidatorInputs();
        default:
            throw new Error(`Unknown circuit: ${circuitName}`);
    }
}

function generateGenericProofInputs() {
    // Test case 1: Balance greater than threshold
    const balanceData = Array(64).fill(0);
    // Encode balance of 1000 USDT (little-endian)
    balanceData[0] = 232; // 1000 & 0xFF
    balanceData[1] = 3;   // (1000 >> 8) & 0xFF
    
    const tlsData = Array(1024).fill(0);
    // Mock TLS session data
    for (let i = 0; i < 100; i++) {
        tlsData[i] = crypto.randomInt(0, 256);
    }
    
    const templateHash = crypto.randomInt(1, 2**32);
    const domainHash = crypto.randomInt(1, 2**32);
    const timestamp = Math.floor(Date.now() / 1000);
    
    return {
        valid: {
            extracted_data: balanceData,
            tls_session_data: tlsData,
            data_length: 8,
            tls_length: 100,
            template_hash: templateHash,
            claim_type: 1, // Greater than
            threshold_value: 500,
            domain_hash: domainHash,
            timestamp_min: timestamp - 3600,
            timestamp_max: timestamp + 3600
        },
        invalid: {
            extracted_data: balanceData,
            tls_session_data: tlsData,
            data_length: 8,
            tls_length: 100,
            template_hash: templateHash,
            claim_type: 1, // Greater than
            threshold_value: 1500, // Higher than balance
            domain_hash: domainHash,
            timestamp_min: timestamp - 3600,
            timestamp_max: timestamp + 3600
        }
    };
}

function generateBalanceProofInputs() {
    const balanceData = Array(32).fill(0);
    balanceData[0] = 100; // Balance: 100
    balanceData[1] = 0;
    
    const tlsData = Array(1024).fill(0);
    for (let i = 0; i < 50; i++) {
        tlsData[i] = crypto.randomInt(0, 256);
    }
    
    return {
        valid: {
            extracted_data: balanceData,
            tls_session_data: tlsData,
            data_length: 8,
            tls_length: 50,
            template_hash: crypto.randomInt(1, 2**32),
            threshold_value: 50,
            domain_hash: crypto.randomInt(1, 2**32),
            timestamp_min: Math.floor(Date.now() / 1000) - 3600,
            timestamp_max: Math.floor(Date.now() / 1000) + 3600
        }
    };
}

function generateFollowerProofInputs() {
    const followerData = Array(16).fill(0);
    followerData[0] = 44; // 1000 followers (little-endian)
    followerData[1] = 1;
    
    const tlsData = Array(512).fill(0);
    for (let i = 0; i < 30; i++) {
        tlsData[i] = crypto.randomInt(0, 256);
    }
    
    return {
        valid: {
            extracted_data: followerData,
            tls_session_data: tlsData,
            data_length: 8,
            tls_length: 30,
            template_hash: crypto.randomInt(1, 2**32),
            threshold_value: 100,
            domain_hash: crypto.randomInt(1, 2**32),
            timestamp_min: Math.floor(Date.now() / 1000) - 3600,
            timestamp_max: Math.floor(Date.now() / 1000) + 3600
        }
    };
}

function generateComparatorInputs() {
    const data = Array(64).fill(0);
    data[0] = 50; // Value: 50
    
    const pattern = Array(32).fill(0);
    const threshold_max = 100;
    
    return {
        valid: {
            claim_type: 1, // GT
            threshold: 25,
            threshold_max: threshold_max,
            data: data,
            data_length: 8,
            pattern: pattern,
            pattern_length: 0
        },
        invalid: {
            claim_type: 1, // GT
            threshold: 75, // Greater than data value
            threshold_max: threshold_max,
            data: data,
            data_length: 8,
            pattern: pattern,
            pattern_length: 0
        }
    };
}

function generateValidatorInputs() {
    const templateData = Array(64).fill(0);
    for (let i = 0; i < 10; i++) {
        templateData[i] = crypto.randomInt(1, 256);
    }
    
    const authorizedDomains = Array(16).fill(0);
    const domainHash = crypto.randomInt(1, 2**32);
    authorizedDomains[0] = domainHash; // First domain is authorized
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    return {
        valid: {
            template_hash: 12345, // Will be computed by circuit
            domain_hash: domainHash,
            timestamp: timestamp,
            template_id: crypto.randomInt(1, 1000),
            template_version: 1,
            authorized_domains: authorizedDomains,
            domain_count: 1,
            valid_from: timestamp - 86400,
            valid_until: timestamp + 86400,
            template_data: templateData,
            template_data_length: 10
        }
    };
}

// Test a single circuit
async function testCircuit(circuitName, snarkjsPath) {
    console.log(`\n🧪 Testing circuit: ${circuitName}`);
    
    const wasmFile = path.join(CIRCUITS_DIR, `${circuitName}.wasm`);
    const zkeyFile = path.join(CIRCUITS_DIR, `${circuitName}_final.zkey`);
    const vkeyFile = path.join(CIRCUITS_DIR, 'verification_key.json');
    
    // Check if required files exist
    const requiredFiles = [wasmFile];
    for (const file of requiredFiles) {
        if (!fs.existsSync(file)) {
            console.log(`  ⚠️  Skipping ${circuitName} - missing file: ${path.basename(file)}`);
            return { success: false, reason: 'missing_files' };
        }
    }
    
    try {
        const testInputs = generateTestInputs(circuitName);
        const results = {};
        
        // Test valid inputs
        if (testInputs.valid) {
            console.log(`  🔍 Testing valid inputs...`);
            const validResult = await runCircuitTest(
                circuitName, 
                testInputs.valid, 
                snarkjsPath, 
                wasmFile, 
                zkeyFile,
                vkeyFile,
                'valid'
            );
            results.valid = validResult;
        }
        
        // Test invalid inputs (if provided)
        if (testInputs.invalid) {
            console.log(`  🔍 Testing invalid inputs...`);
            const invalidResult = await runCircuitTest(
                circuitName,
                testInputs.invalid,
                snarkjsPath,
                wasmFile,
                zkeyFile,
                vkeyFile,
                'invalid'
            );
            results.invalid = invalidResult;
        }
        
        return { success: true, results };
        
    } catch (error) {
        console.error(`  ❌ Test failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Run individual circuit test
async function runCircuitTest(circuitName, inputs, snarkjsPath, wasmFile, zkeyFile, vkeyFile, testType) {
    const testId = `${circuitName}_${testType}_${Date.now()}`;
    const inputFile = path.join(TEST_DIR, `${testId}_input.json`);
    const witnessFile = path.join(TEST_DIR, `${testId}_witness.wtns`);
    const proofFile = path.join(TEST_DIR, `${testId}_proof.json`);
    const publicFile = path.join(TEST_DIR, `${testId}_public.json`);
    
    try {
        // Write inputs to file
        fs.writeFileSync(inputFile, JSON.stringify(inputs, null, 2));
        
        // Generate witness
        const witnessCmd = `${snarkjsPath} wtns calculate "${wasmFile}" "${inputFile}" "${witnessFile}"`;
        execSync(witnessCmd, { stdio: 'pipe' });
        console.log(`    ✓ Witness generated`);
        
        // Generate proof (if zkey exists)
        if (fs.existsSync(zkeyFile)) {
            const proofCmd = `${snarkjsPath} groth16 prove "${zkeyFile}" "${witnessFile}" "${proofFile}" "${publicFile}"`;
            execSync(proofCmd, { stdio: 'pipe' });
            console.log(`    ✓ Proof generated`);
            
            // Verify proof (if verification key exists)
            if (fs.existsSync(vkeyFile)) {
                const verifyCmd = `${snarkjsPath} groth16 verify "${vkeyFile}" "${publicFile}" "${proofFile}"`;
                const verifyResult = execSync(verifyCmd, { stdio: 'pipe' }).toString();
                const isValid = verifyResult.includes('OK') || verifyResult.includes('VALID');
                console.log(`    ✓ Proof verification: ${isValid ? 'VALID' : 'INVALID'}`);
                
                return {
                    witnessGenerated: true,
                    proofGenerated: true,
                    proofValid: isValid,
                    files: {
                        input: inputFile,
                        witness: witnessFile,
                        proof: proofFile,
                        public: publicFile
                    }
                };
            }
        }
        
        return {
            witnessGenerated: true,
            proofGenerated: fs.existsSync(zkeyFile),
            proofValid: null,
            files: {
                input: inputFile,
                witness: witnessFile
            }
        };
        
    } catch (error) {
        console.error(`    ❌ Error: ${error.message}`);
        throw error;
    } finally {
        // Clean up temporary files (optional)
        [inputFile, witnessFile, proofFile, publicFile].forEach(file => {
            if (fs.existsSync(file)) {
                // fs.unlinkSync(file); // Comment out to keep files for debugging
            }
        });
    }
}

// Run performance benchmarks
async function runBenchmarks(snarkjsPath) {
    console.log('\n📊 Running performance benchmarks...');
    
    const benchmarks = {};
    
    for (const circuitName of TEST_CONFIG.circuits) {
        const wasmFile = path.join(CIRCUITS_DIR, `${circuitName}.wasm`);
        if (!fs.existsSync(wasmFile)) continue;
        
        console.log(`  📈 Benchmarking ${circuitName}...`);
        
        try {
            const inputs = generateTestInputs(circuitName);
            if (!inputs.valid) continue;
            
            const inputFile = path.join(TEST_DIR, `bench_${circuitName}_input.json`);
            const witnessFile = path.join(TEST_DIR, `bench_${circuitName}_witness.wtns`);
            
            fs.writeFileSync(inputFile, JSON.stringify(inputs.valid, null, 2));
            
            const startTime = Date.now();
            const witnessCmd = `${snarkjsPath} wtns calculate "${wasmFile}" "${inputFile}" "${witnessFile}"`;
            execSync(witnessCmd, { stdio: 'pipe' });
            const witnessTime = Date.now() - startTime;
            
            const witnessStats = fs.statSync(witnessFile);
            
            benchmarks[circuitName] = {
                witnessGenerationTime: witnessTime,
                witnessSize: witnessStats.size,
                wasmSize: fs.statSync(wasmFile).size
            };
            
            console.log(`    - Witness generation: ${witnessTime}ms`);
            console.log(`    - Witness size: ${(witnessStats.size / 1024).toFixed(1)}KB`);
            
            // Clean up
            [inputFile, witnessFile].forEach(file => {
                if (fs.existsSync(file)) fs.unlinkSync(file);
            });
            
        } catch (error) {
            console.error(`    ❌ Benchmark failed: ${error.message}`);
        }
    }
    
    return benchmarks;
}

// Generate test report
function generateTestReport(results, benchmarks) {
    console.log('\n📄 Generating test report...');
    
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            totalCircuits: TEST_CONFIG.circuits.length,
            tested: Object.keys(results).length,
            passed: Object.values(results).filter(r => r.success).length,
            failed: Object.values(results).filter(r => !r.success).length
        },
        results: results,
        benchmarks: benchmarks,
        environment: {
            node: process.version,
            platform: process.platform,
            arch: process.arch
        }
    };
    
    const reportFile = path.join(TEST_DIR, 'test-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`✓ Test report saved to ${reportFile}`);
    return report;
}

// Main test execution
async function main() {
    try {
        console.log('🚀 Starting circuit testing...\n');
        
        const snarkjsPath = checkSnarkjsInstalled();
        createTestDir();
        
        console.log(`🎯 Testing ${TEST_CONFIG.circuits.length} circuits:`);
        TEST_CONFIG.circuits.forEach(c => console.log(`  • ${c}`));
        
        const results = {};
        
        // Test each circuit
        for (const circuitName of TEST_CONFIG.circuits) {
            const result = await testCircuit(circuitName, snarkjsPath);
            results[circuitName] = result;
        }
        
        // Run benchmarks
        const benchmarks = await runBenchmarks(snarkjsPath);
        
        // Generate report
        const report = generateTestReport(results, benchmarks);
        
        // Summary
        console.log('\n🎉 Circuit testing completed!');
        console.log(`\nSummary:`);
        console.log(`  • Total circuits: ${report.summary.totalCircuits}`);
        console.log(`  • Tested: ${report.summary.tested}`);
        console.log(`  • Passed: ${report.summary.passed}`);
        console.log(`  • Failed: ${report.summary.failed}`);
        
        if (report.summary.failed > 0) {
            console.log(`\n❌ Failed circuits:`);
            Object.entries(results).forEach(([name, result]) => {
                if (!result.success) {
                    console.log(`  • ${name}: ${result.reason || result.error}`);
                }
            });
        }
        
        // Exit with error code if tests failed
        process.exit(report.summary.failed > 0 ? 1 : 0);
        
    } catch (error) {
        console.error('\n❌ Circuit testing failed:');
        console.error(error.message);
        process.exit(1);
    }
}

// Handle CLI execution
if (require.main === module) {
    main();
}

module.exports = {
    testCircuit,
    generateTestInputs,
    runBenchmarks,
    generateTestReport,
    TEST_CONFIG,
    TEST_DIR
};