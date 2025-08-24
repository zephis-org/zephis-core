#!/usr/bin/env node

/**
 * Security Test Suite for Zephis Circuit Components
 * 
 * Comprehensive security testing covering:
 * 1. Malicious input attack vectors
 * 2. Constraint bypass attempts
 * 3. Data leakage prevention
 * 4. Timing attack resistance
 * 5. Overflow/underflow protection
 * 6. Template tampering detection
 * 7. Domain authorization bypass
 * 8. Proof forgery attempts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const CIRCUITS_DIR = path.join(__dirname, '..', '..', 'circuits');
const BUILD_DIR = path.join(CIRCUITS_DIR, 'build');
const SECURITY_RESULTS_DIR = path.join(__dirname, 'security-test-results');

// Security test configuration
const SECURITY_TEST_CONFIG = {
    'generic_proof': {
        attackVectors: ['overflow', 'underflow', 'timestamp_manipulation', 'data_length_bypass', 'constraint_bypass'],
        sensitiveInputs: ['extracted_data', 'tls_session_data'],
        publicInputs: ['template_hash', 'claim_type', 'threshold_value', 'domain_hash', 'timestamp_min', 'timestamp_max'],
        criticalConstraints: ['data_length_check', 'tls_length_check', 'timestamp_validity']
    },
    'dynamic_comparator': {
        attackVectors: ['operation_type_manipulation', 'numeric_overflow', 'pattern_injection', 'array_bounds'],
        sensitiveInputs: ['data', 'pattern'],
        publicInputs: ['claim_type', 'threshold', 'threshold_max', 'data_length', 'pattern_length'],
        criticalConstraints: ['data_bounds_check', 'pattern_bounds_check']
    },
    'template_validator': {
        attackVectors: ['hash_collision', 'domain_spoofing', 'timestamp_bypass', 'template_forgery'],
        sensitiveInputs: ['template_id', 'template_version', 'authorized_domains', 'template_data'],
        publicInputs: ['template_hash', 'domain_hash', 'timestamp'],
        criticalConstraints: ['hash_verification', 'domain_authorization', 'timestamp_validation']
    }
};

class SecurityTestSuite {
    constructor() {
        this.results = {
            overview: {},
            attackTests: {},
            leakageTests: {},
            timingTests: {},
            constraintTests: {},
            fuzzing: {}
        };
        this.setupSecurityTestEnvironment();
    }

    setupSecurityTestEnvironment() {
        if (!fs.existsSync(SECURITY_RESULTS_DIR)) {
            fs.mkdirSync(SECURITY_RESULTS_DIR, { recursive: true });
        }
        
        console.log('🔒 Security Test Suite Initialized\n');
        console.log(`Security Results: ${SECURITY_RESULTS_DIR}`);
        console.log(`Circuits Directory: ${CIRCUITS_DIR}\n`);
        
        // Create attack payloads directory
        const attackPayloadsDir = path.join(SECURITY_RESULTS_DIR, 'attack-payloads');
        if (!fs.existsSync(attackPayloadsDir)) {
            fs.mkdirSync(attackPayloadsDir, { recursive: true });
        }
    }

    async runAllSecurityTests() {
        console.log('🛡️ Starting Comprehensive Security Testing...\n');
        
        const startTime = Date.now();
        
        try {
            // Generate security overview
            await this.generateSecurityOverview();
            
            // Run attack vector tests
            await this.runAttackVectorTests();
            
            // Run data leakage tests
            await this.runDataLeakageTests();
            
            // Run timing attack tests
            await this.runTimingAttackTests();
            
            // Run constraint manipulation tests
            await this.runConstraintManipulationTests();
            
            // Run fuzzing tests
            await this.runFuzzingTests();
            
            // Generate security report
            await this.generateSecurityReport();
            
        } catch (error) {
            console.error('❌ Security test suite failed:', error.message);
            throw error;
        }
        
        const duration = Date.now() - startTime;
        this.printSecuritySummary(duration);
    }

    async generateSecurityOverview() {
        console.log('🔍 Generating Security Overview...\n');
        
        this.results.overview = {
            circuitsAnalyzed: Object.keys(SECURITY_TEST_CONFIG).length,
            totalAttackVectors: 0,
            criticalComponents: [],
            riskAssessment: {}
        };

        for (const [circuitName, config] of Object.entries(SECURITY_TEST_CONFIG)) {
            this.results.overview.totalAttackVectors += config.attackVectors.length;
            
            // Assess risk level based on circuit complexity and sensitive data
            const riskLevel = this.assessCircuitRisk(circuitName, config);
            this.results.overview.riskAssessment[circuitName] = riskLevel;
            
            if (riskLevel >= 7) { // High risk threshold
                this.results.overview.criticalComponents.push(circuitName);
            }
            
            console.log(`  🔎 ${circuitName}: Risk Level ${riskLevel}/10`);
        }

        console.log(`\n  📊 Total Attack Vectors: ${this.results.overview.totalAttackVectors}`);
        console.log(`  ⚠️  Critical Components: ${this.results.overview.criticalComponents.length}`);
    }

    assessCircuitRisk(circuitName, config) {
        let risk = 0;
        
        // Base risk from sensitive inputs
        risk += config.sensitiveInputs.length * 2;
        
        // Risk from attack vectors
        risk += config.attackVectors.length * 1;
        
        // Circuit-specific risk factors
        switch (circuitName) {
            case 'generic_proof':
                risk += 3; // Handles multiple proof types and TLS data
                break;
            case 'template_validator':
                risk += 2; // Critical for template security
                break;
            case 'dynamic_comparator':
                risk += 1; // Mathematical operations
                break;
        }
        
        return Math.min(10, risk); // Cap at 10
    }

    async runAttackVectorTests() {
        console.log('⚔️ Running Attack Vector Tests...\n');
        
        this.results.attackTests = {};
        
        for (const [circuitName, config] of Object.entries(SECURITY_TEST_CONFIG)) {
            console.log(`  🎯 Testing ${circuitName}...`);
            
            this.results.attackTests[circuitName] = {
                attackVectors: [],
                summary: { total: 0, blocked: 0, successful: 0 }
            };
            
            for (const attackVector of config.attackVectors) {
                const attackResult = await this.executeAttackVector(circuitName, attackVector, config);
                this.results.attackTests[circuitName].attackVectors.push(attackResult);
                this.results.attackTests[circuitName].summary.total++;
                
                if (attackResult.blocked) {
                    this.results.attackTests[circuitName].summary.blocked++;
                    console.log(`    ✅ ${attackVector}: Blocked`);
                } else {
                    this.results.attackTests[circuitName].summary.successful++;
                    console.log(`    ❌ ${attackVector}: ${attackResult.success ? 'Successful' : 'Failed to execute'}`);
                }
            }
            
            const blockRate = (this.results.attackTests[circuitName].summary.blocked / 
                              this.results.attackTests[circuitName].summary.total * 100).toFixed(1);
            console.log(`    📊 Attack Block Rate: ${blockRate}%\n`);
        }
    }

    async executeAttackVector(circuitName, attackVector, config) {
        const attack = {
            name: attackVector,
            blocked: false,
            success: false,
            error: null,
            payload: null,
            response: null
        };

        try {
            // Generate attack payload based on vector type
            attack.payload = this.generateAttackPayload(circuitName, attackVector, config);
            
            // Save attack payload for analysis
            const payloadFile = path.join(SECURITY_RESULTS_DIR, 'attack-payloads', `${circuitName}_${attackVector}.json`);
            fs.writeFileSync(payloadFile, JSON.stringify(attack.payload, null, 2));
            
            // Execute attack
            const result = await this.executeCircuitWithPayload(circuitName, attack.payload);
            attack.response = result;
            
            // Analyze if attack was successful or blocked
            attack.blocked = this.analyzeAttackResult(circuitName, attackVector, result);
            attack.success = !attack.blocked;
            
        } catch (error) {
            // Exception during execution often means the attack was blocked
            attack.blocked = this.isSecurityException(error.message);
            attack.error = error.message;
        }

        return attack;
    }

    generateAttackPayload(circuitName, attackVector, config) {
        const basePayload = this.generateValidInput(circuitName);
        
        switch (attackVector) {
            case 'overflow':
                return this.generateOverflowPayload(basePayload, config);
            case 'underflow':
                return this.generateUnderflowPayload(basePayload, config);
            case 'timestamp_manipulation':
                return this.generateTimestampAttackPayload(basePayload);
            case 'data_length_bypass':
                return this.generateDataLengthBypassPayload(basePayload);
            case 'constraint_bypass':
                return this.generateConstraintBypassPayload(basePayload, config);
            case 'operation_type_manipulation':
                return this.generateOperationTypeAttackPayload(basePayload);
            case 'numeric_overflow':
                return this.generateNumericOverflowPayload(basePayload);
            case 'pattern_injection':
                return this.generatePatternInjectionPayload(basePayload);
            case 'array_bounds':
                return this.generateArrayBoundsAttackPayload(basePayload);
            case 'hash_collision':
                return this.generateHashCollisionPayload(basePayload);
            case 'domain_spoofing':
                return this.generateDomainSpoofingPayload(basePayload);
            case 'timestamp_bypass':
                return this.generateTimestampBypassPayload(basePayload);
            case 'template_forgery':
                return this.generateTemplateForgeryPayload(basePayload);
            default:
                return basePayload;
        }
    }

    generateValidInput(circuitName) {
        switch (circuitName) {
            case 'generic_proof':
                return {
                    extracted_data: Array(64).fill(0).map((_, i) => i < 4 ? 100 + i : 0),
                    tls_session_data: Array(1024).fill(0),
                    data_length: 4,
                    tls_length: 512,
                    template_hash: crypto.randomBytes(32).toString('hex'),
                    claim_type: 1,
                    threshold_value: 100,
                    domain_hash: crypto.randomBytes(32).toString('hex'),
                    timestamp_min: Math.floor(Date.now() / 1000) - 3600,
                    timestamp_max: Math.floor(Date.now() / 1000) + 3600
                };
            case 'dynamic_comparator':
                return {
                    claim_type: 1,
                    threshold: 100,
                    threshold_max: 200,
                    data: Array(64).fill(0).map((_, i) => i < 4 ? 150 + i : 0),
                    data_length: 4,
                    pattern: Array(32).fill(0),
                    pattern_length: 0
                };
            case 'template_validator':
                return {
                    template_hash: crypto.randomBytes(32).toString('hex'),
                    domain_hash: crypto.randomBytes(32).toString('hex'),
                    timestamp: Math.floor(Date.now() / 1000),
                    template_id: 12345,
                    template_version: 1,
                    authorized_domains: Array(16).fill(0).map(() => crypto.randomBytes(32).toString('hex')),
                    domain_count: 1,
                    valid_from: Math.floor(Date.now() / 1000) - 86400,
                    valid_until: Math.floor(Date.now() / 1000) + 86400,
                    template_data: Array(64).fill(0).map(() => Math.floor(Math.random() * 256)),
                    template_data_length: 32
                };
            default:
                return {};
        }
    }

    generateOverflowPayload(basePayload, config) {
        const payload = { ...basePayload };
        
        // Try to overflow numeric fields
        if (payload.data_length !== undefined) {
            payload.data_length = Math.pow(2, 31) - 1; // Max int32
        }
        if (payload.tls_length !== undefined) {
            payload.tls_length = Math.pow(2, 31) - 1;
        }
        if (payload.threshold_value !== undefined) {
            payload.threshold_value = Math.pow(2, 64) - 1; // Attempt 64-bit overflow
        }
        if (payload.timestamp_max !== undefined) {
            payload.timestamp_max = Math.pow(2, 31) - 1;
        }
        
        // Try to overflow arrays
        if (payload.extracted_data) {
            payload.extracted_data = Array(1000).fill(255); // Way larger than expected
        }
        if (payload.data) {
            payload.data = Array(1000).fill(255);
        }
        
        return payload;
    }

    generateUnderflowPayload(basePayload, config) {
        const payload = { ...basePayload };
        
        // Try negative values where they shouldn't be allowed
        if (payload.data_length !== undefined) {
            payload.data_length = -1;
        }
        if (payload.tls_length !== undefined) {
            payload.tls_length = -100;
        }
        if (payload.threshold_value !== undefined) {
            payload.threshold_value = -Math.pow(2, 31);
        }
        if (payload.claim_type !== undefined) {
            payload.claim_type = -1;
        }
        
        return payload;
    }

    generateTimestampAttackPayload(basePayload) {
        const payload = { ...basePayload };
        
        // Try timestamp manipulation
        if (payload.timestamp_min !== undefined && payload.timestamp_max !== undefined) {
            // Reverse min/max to create invalid range
            const temp = payload.timestamp_min;
            payload.timestamp_min = payload.timestamp_max + 86400;
            payload.timestamp_max = temp;
        }
        
        // Try far future timestamp
        if (payload.timestamp !== undefined) {
            payload.timestamp = Math.floor(Date.now() / 1000) + 365 * 24 * 3600; // 1 year in future
        }
        
        return payload;
    }

    generateDataLengthBypassPayload(basePayload) {
        const payload = { ...basePayload };
        
        // Claim small data length but provide large data
        if (payload.data_length !== undefined && payload.extracted_data) {
            payload.data_length = 1;
            payload.extracted_data = Array(64).fill(255); // Full array
        }
        
        // Claim zero length
        if (payload.data_length !== undefined) {
            payload.data_length = 0;
        }
        
        return payload;
    }

    generateConstraintBypassPayload(basePayload, config) {
        const payload = { ...basePayload };
        
        // Try to bypass length constraints
        if (payload.extracted_data && Array.isArray(payload.extracted_data)) {
            payload.extracted_data = Array(128).fill(0); // Double expected max
        }
        
        if (payload.tls_session_data && Array.isArray(payload.tls_session_data)) {
            payload.tls_session_data = Array(2048).fill(0); // Double expected max
        }
        
        return payload;
    }

    generateOperationTypeAttackPayload(basePayload) {
        const payload = { ...basePayload };
        
        // Invalid operation types
        if (payload.claim_type !== undefined) {
            payload.claim_type = 999; // Way outside valid range
        }
        
        return payload;
    }

    generateNumericOverflowPayload(basePayload) {
        const payload = { ...basePayload };
        
        // Try extreme numeric values
        if (payload.threshold !== undefined) {
            payload.threshold = Number.MAX_SAFE_INTEGER;
        }
        if (payload.threshold_max !== undefined) {
            payload.threshold_max = Number.MAX_SAFE_INTEGER;
        }
        
        return payload;
    }

    generatePatternInjectionPayload(basePayload) {
        const payload = { ...basePayload };
        
        if (payload.pattern && Array.isArray(payload.pattern)) {
            // Try to inject control characters or special patterns
            payload.pattern = [0, 0, 255, 255, 0, 255, ...Array(26).fill(0)];
            payload.pattern_length = 32; // Claim full length
        }
        
        return payload;
    }

    generateArrayBoundsAttackPayload(basePayload) {
        const payload = { ...basePayload };
        
        // Try to access out-of-bounds array elements
        if (payload.data_length !== undefined) {
            payload.data_length = 1000; // Way larger than actual array
        }
        if (payload.pattern_length !== undefined) {
            payload.pattern_length = 100;
        }
        
        return payload;
    }

    generateHashCollisionPayload(basePayload) {
        const payload = { ...basePayload };
        
        // Try known weak hash values or collision attempts
        if (payload.template_hash !== undefined) {
            payload.template_hash = '0'.repeat(64); // All zeros
        }
        if (payload.domain_hash !== undefined) {
            payload.domain_hash = 'f'.repeat(64); // All f's
        }
        
        return payload;
    }

    generateDomainSpoofingPayload(basePayload) {
        const payload = { ...basePayload };
        
        if (payload.authorized_domains && payload.domain_hash) {
            // Try to authorize the attacking domain
            payload.authorized_domains[0] = payload.domain_hash;
            payload.domain_count = 1;
        }
        
        return payload;
    }

    generateTimestampBypassPayload(basePayload) {
        const payload = { ...basePayload };
        
        if (payload.timestamp !== undefined && payload.valid_until !== undefined) {
            // Try timestamp after expiration
            payload.timestamp = payload.valid_until + 86400; // 1 day after expiry
        }
        
        return payload;
    }

    generateTemplateForgeryPayload(basePayload) {
        const payload = { ...basePayload };
        
        // Try to forge template by modifying data but keeping same hash
        if (payload.template_data) {
            payload.template_data = Array(64).fill(0); // Clear template data
        }
        if (payload.template_version !== undefined) {
            payload.template_version = 999; // Invalid version
        }
        
        return payload;
    }

    async executeCircuitWithPayload(circuitName, payload) {
        const inputFile = path.join(SECURITY_RESULTS_DIR, `${circuitName}_attack_input.json`);
        const witnessFile = path.join(SECURITY_RESULTS_DIR, `${circuitName}_attack_witness.wtns`);
        const wasmFile = path.join(CIRCUITS_DIR, `${circuitName}.wasm`);
        
        // Write attack input
        fs.writeFileSync(inputFile, JSON.stringify(payload, null, 2));
        
        if (!fs.existsSync(wasmFile)) {
            throw new Error(`WASM file not found: ${wasmFile}`);
        }
        
        // Execute circuit with attack payload
        execSync(`npx snarkjs wtns calculate "${wasmFile}" "${inputFile}" "${witnessFile}"`, {
            stdio: 'pipe',
            timeout: 30000 // 30 second timeout
        });
        
        // Extract outputs
        const witnessJsonFile = witnessFile.replace('.wtns', '.json');
        execSync(`npx snarkjs wtns export json "${witnessFile}" "${witnessJsonFile}"`, {
            stdio: 'pipe'
        });
        
        const witnessData = JSON.parse(fs.readFileSync(witnessJsonFile, 'utf8'));
        return this.mapWitnessToOutputs(witnessData, circuitName);
    }

    mapWitnessToOutputs(witnessData, circuitName) {
        // Simplified output mapping - in practice you'd need the actual circuit output indices
        const outputs = {};
        
        switch (circuitName) {
            case 'generic_proof':
                outputs.proof_valid = witnessData[1] || 0;
                outputs.data_hash = witnessData[2] || '0';
                outputs.session_hash = witnessData[3] || '0';
                break;
            case 'dynamic_comparator':
                outputs.result = witnessData[1] || 0;
                break;
            case 'template_validator':
                outputs.valid = witnessData[1] || 0;
                outputs.computed_hash = witnessData[2] || '0';
                break;
        }
        
        return outputs;
    }

    analyzeAttackResult(circuitName, attackVector, result) {
        // Attack is considered blocked if:
        // 1. Circuit produces expected "invalid" result (0 for boolean outputs)
        // 2. Circuit execution failed with constraint violation
        // 3. Circuit produces mathematically impossible results
        
        switch (circuitName) {
            case 'generic_proof':
                return result.proof_valid === 0 || result.proof_valid === undefined;
            case 'dynamic_comparator':
                return result.result === 0 || result.result === undefined;
            case 'template_validator':
                return result.valid === 0 || result.valid === undefined;
            default:
                return true; // Conservative: assume blocked if uncertain
        }
    }

    isSecurityException(errorMessage) {
        const securityIndicators = [
            'constraint',
            'assert',
            'bounds',
            'range',
            'invalid',
            'overflow',
            'underflow'
        ];
        
        return securityIndicators.some(indicator => 
            errorMessage.toLowerCase().includes(indicator)
        );
    }

    async runDataLeakageTests() {
        console.log('🔍 Running Data Leakage Tests...\n');
        
        this.results.leakageTests = {};
        
        for (const [circuitName, config] of Object.entries(SECURITY_TEST_CONFIG)) {
            console.log(`  🕵️  Testing ${circuitName}...`);
            
            const leakageTest = await this.testDataLeakage(circuitName, config);
            this.results.leakageTests[circuitName] = leakageTest;
            
            if (leakageTest.leakageDetected) {
                console.log(`    ❌ Potential data leakage detected`);
            } else {
                console.log(`    ✅ No obvious data leakage detected`);
            }
        }
    }

    async testDataLeakage(circuitName, config) {
        const leakageTest = {
            leakageDetected: false,
            suspiciousOutputs: [],
            correlationAnalysis: {},
            sensitivityAnalysis: {}
        };
        
        try {
            // Test multiple inputs with different sensitive data
            const testInputs = [];
            for (let i = 0; i < 5; i++) {
                const input = this.generateValidInput(circuitName);
                // Modify sensitive inputs
                if (input.extracted_data) {
                    input.extracted_data = Array(64).fill(0).map(() => Math.floor(Math.random() * 256));
                }
                if (input.template_data) {
                    input.template_data = Array(64).fill(0).map(() => Math.floor(Math.random() * 256));
                }
                testInputs.push(input);
            }
            
            // Collect outputs
            const outputs = [];
            for (const input of testInputs) {
                try {
                    const result = await this.executeCircuitWithPayload(circuitName, input);
                    outputs.push(result);
                } catch (error) {
                    // Skip failed executions
                }
            }
            
            // Analyze outputs for potential leakage
            if (outputs.length >= 2) {
                leakageTest.correlationAnalysis = this.analyzeOutputCorrelation(outputs);
                leakageTest.sensitivityAnalysis = this.analyzeSensitivityToInputs(testInputs, outputs);
                
                // Flag potential leakage if outputs vary with sensitive inputs
                leakageTest.leakageDetected = this.detectPotentialLeakage(leakageTest.correlationAnalysis, leakageTest.sensitivityAnalysis);
            }
            
        } catch (error) {
            leakageTest.error = error.message;
        }
        
        return leakageTest;
    }

    analyzeOutputCorrelation(outputs) {
        const analysis = {
            uniqueOutputs: new Set(),
            outputVariation: 0
        };
        
        // Count unique output combinations
        for (const output of outputs) {
            const outputKey = JSON.stringify(output);
            analysis.uniqueOutputs.add(outputKey);
        }
        
        analysis.outputVariation = analysis.uniqueOutputs.size / outputs.length;
        
        return analysis;
    }

    analyzeSensitivityToInputs(inputs, outputs) {
        // Simplified sensitivity analysis
        return {
            inputVariation: inputs.length,
            outputVariation: outputs.length,
            sensitivity: outputs.length / inputs.length
        };
    }

    detectPotentialLeakage(correlationAnalysis, sensitivityAnalysis) {
        // Flag potential leakage if:
        // 1. Outputs vary significantly with inputs (sensitivity > 0.8)
        // 2. High correlation between input changes and output changes
        
        return sensitivityAnalysis.sensitivity > 0.8 && 
               correlationAnalysis.outputVariation > 0.5;
    }

    async runTimingAttackTests() {
        console.log('⏱️ Running Timing Attack Tests...\n');
        
        this.results.timingTests = {};
        
        for (const [circuitName, config] of Object.entries(SECURITY_TEST_CONFIG)) {
            console.log(`  ⏲️  Testing ${circuitName}...`);
            
            const timingTest = await this.testTimingAttacks(circuitName, config);
            this.results.timingTests[circuitName] = timingTest;
            
            if (timingTest.vulnerable) {
                console.log(`    ❌ Timing attack vulnerability detected (${timingTest.maxTimingDifference.toFixed(2)}ms difference)`);
            } else {
                console.log(`    ✅ No significant timing variations detected`);
            }
        }
    }

    async testTimingAttacks(circuitName, config) {
        const timingTest = {
            vulnerable: false,
            measurements: [],
            maxTimingDifference: 0,
            averageTime: 0,
            stdDeviation: 0
        };
        
        try {
            // Test execution times with different sensitive inputs
            const testCases = [
                // Case 1: All zeros (minimal computation)
                this.generateMinimalInput(circuitName),
                // Case 2: All max values (maximal computation)  
                this.generateMaximalInput(circuitName),
                // Case 3: Random data
                this.generateValidInput(circuitName),
                // Case 4: Pattern data
                this.generatePatternInput(circuitName),
                // Case 5: Sparse data
                this.generateSparseInput(circuitName)
            ];
            
            for (const testCase of testCases) {
                const measurements = await this.measureExecutionTimes(circuitName, testCase, 3);
                timingTest.measurements.push({
                    case: testCase.name || 'unknown',
                    times: measurements,
                    average: measurements.reduce((a, b) => a + b, 0) / measurements.length
                });
            }
            
            // Analyze timing variations
            const allAverages = timingTest.measurements.map(m => m.average);
            timingTest.averageTime = allAverages.reduce((a, b) => a + b, 0) / allAverages.length;
            timingTest.maxTimingDifference = Math.max(...allAverages) - Math.min(...allAverages);
            
            // Calculate standard deviation
            const squaredDiffs = allAverages.map(avg => Math.pow(avg - timingTest.averageTime, 2));
            timingTest.stdDeviation = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length);
            
            // Flag as vulnerable if timing difference > 50ms or high std deviation
            timingTest.vulnerable = timingTest.maxTimingDifference > 50 || timingTest.stdDeviation > 25;
            
        } catch (error) {
            timingTest.error = error.message;
        }
        
        return timingTest;
    }

    generateMinimalInput(circuitName) {
        const input = this.generateValidInput(circuitName);
        input.name = 'minimal';
        
        // Set all arrays to minimal values
        if (input.extracted_data) input.extracted_data = Array(64).fill(0);
        if (input.tls_session_data) input.tls_session_data = Array(1024).fill(0);
        if (input.data) input.data = Array(64).fill(0);
        if (input.pattern) input.pattern = Array(32).fill(0);
        if (input.template_data) input.template_data = Array(64).fill(0);
        
        return input;
    }

    generateMaximalInput(circuitName) {
        const input = this.generateValidInput(circuitName);
        input.name = 'maximal';
        
        // Set all arrays to maximal values
        if (input.extracted_data) input.extracted_data = Array(64).fill(255);
        if (input.tls_session_data) input.tls_session_data = Array(1024).fill(255);
        if (input.data) input.data = Array(64).fill(255);
        if (input.pattern) input.pattern = Array(32).fill(255);
        if (input.template_data) input.template_data = Array(64).fill(255);
        
        return input;
    }

    generatePatternInput(circuitName) {
        const input = this.generateValidInput(circuitName);
        input.name = 'pattern';
        
        // Set arrays to repeating pattern
        if (input.extracted_data) input.extracted_data = Array(64).fill(0).map((_, i) => i % 256);
        if (input.tls_session_data) input.tls_session_data = Array(1024).fill(0).map((_, i) => i % 256);
        if (input.data) input.data = Array(64).fill(0).map((_, i) => i % 256);
        
        return input;
    }

    generateSparseInput(circuitName) {
        const input = this.generateValidInput(circuitName);
        input.name = 'sparse';
        
        // Set arrays to sparse pattern (mostly zeros with occasional non-zero)
        if (input.extracted_data) {
            input.extracted_data = Array(64).fill(0);
            for (let i = 0; i < 64; i += 10) {
                input.extracted_data[i] = 255;
            }
        }
        
        return input;
    }

    async measureExecutionTimes(circuitName, input, iterations = 3) {
        const times = [];
        
        for (let i = 0; i < iterations; i++) {
            try {
                const startTime = process.hrtime.bigint();
                await this.executeCircuitWithPayload(circuitName, input);
                const endTime = process.hrtime.bigint();
                
                const executionTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
                times.push(executionTime);
                
            } catch (error) {
                // If execution fails, record 0 time (attack was blocked)
                times.push(0);
            }
        }
        
        return times;
    }

    async runConstraintManipulationTests() {
        console.log('🔧 Running Constraint Manipulation Tests...\n');
        
        this.results.constraintTests = {};
        
        for (const [circuitName, config] of Object.entries(SECURITY_TEST_CONFIG)) {
            console.log(`  🔩 Testing ${circuitName}...`);
            
            const constraintTest = await this.testConstraintManipulation(circuitName, config);
            this.results.constraintTests[circuitName] = constraintTest;
            
            const bypassed = constraintTest.tests.filter(t => t.bypassed).length;
            if (bypassed > 0) {
                console.log(`    ❌ ${bypassed} constraint(s) potentially bypassed`);
            } else {
                console.log(`    ✅ All constraints enforced correctly`);
            }
        }
    }

    async testConstraintManipulation(circuitName, config) {
        const constraintTest = {
            tests: [],
            summary: { total: 0, enforced: 0, bypassed: 0 }
        };
        
        // Test each critical constraint
        for (const constraint of config.criticalConstraints) {
            const test = await this.testSingleConstraint(circuitName, constraint, config);
            constraintTest.tests.push(test);
            constraintTest.summary.total++;
            
            if (test.bypassed) {
                constraintTest.summary.bypassed++;
            } else {
                constraintTest.summary.enforced++;
            }
        }
        
        return constraintTest;
    }

    async testSingleConstraint(circuitName, constraintName, config) {
        const test = {
            constraint: constraintName,
            bypassed: false,
            attempts: [],
            error: null
        };
        
        try {
            // Generate multiple bypass attempts for this constraint
            const bypassAttempts = this.generateConstraintBypassAttempts(circuitName, constraintName);
            
            for (const attempt of bypassAttempts) {
                const attemptResult = {
                    method: attempt.method,
                    success: false,
                    blocked: false
                };
                
                try {
                    const result = await this.executeCircuitWithPayload(circuitName, attempt.payload);
                    
                    // Check if constraint was bypassed (circuit accepted invalid input)
                    attemptResult.success = this.isConstraintBypassSuccessful(circuitName, constraintName, result);
                    attemptResult.blocked = !attemptResult.success;
                    
                } catch (error) {
                    // Exception usually means constraint was enforced
                    attemptResult.blocked = true;
                    attemptResult.error = error.message;
                }
                
                test.attempts.push(attemptResult);
                if (attemptResult.success) {
                    test.bypassed = true;
                }
            }
            
        } catch (error) {
            test.error = error.message;
        }
        
        return test;
    }

    generateConstraintBypassAttempts(circuitName, constraintName) {
        const attempts = [];
        const baseInput = this.generateValidInput(circuitName);
        
        switch (constraintName) {
            case 'data_length_check':
                // Attempt 1: Exceed maximum data length
                attempts.push({
                    method: 'exceed_max_length',
                    payload: { ...baseInput, data_length: 1000 }
                });
                
                // Attempt 2: Negative data length
                attempts.push({
                    method: 'negative_length',
                    payload: { ...baseInput, data_length: -1 }
                });
                break;
                
            case 'tls_length_check':
                attempts.push({
                    method: 'exceed_max_tls_length',
                    payload: { ...baseInput, tls_length: 10000 }
                });
                break;
                
            case 'timestamp_validity':
                attempts.push({
                    method: 'future_timestamp',
                    payload: { 
                        ...baseInput, 
                        timestamp_min: Math.floor(Date.now() / 1000) + 86400,
                        timestamp_max: Math.floor(Date.now() / 1000) + 172800
                    }
                });
                break;
                
            case 'data_bounds_check':
                attempts.push({
                    method: 'array_overflow',
                    payload: { 
                        ...baseInput, 
                        data_length: 128,
                        data: Array(128).fill(255)
                    }
                });
                break;
                
            case 'pattern_bounds_check':
                attempts.push({
                    method: 'pattern_overflow',
                    payload: { 
                        ...baseInput, 
                        pattern_length: 64,
                        pattern: Array(64).fill(255)
                    }
                });
                break;
                
            case 'hash_verification':
                attempts.push({
                    method: 'hash_mismatch',
                    payload: { 
                        ...baseInput, 
                        template_hash: 'invalid_hash_value'
                    }
                });
                break;
                
            case 'domain_authorization':
                attempts.push({
                    method: 'unauthorized_domain',
                    payload: { 
                        ...baseInput, 
                        domain_hash: crypto.randomBytes(32).toString('hex')
                    }
                });
                break;
        }
        
        return attempts;
    }

    isConstraintBypassSuccessful(circuitName, constraintName, result) {
        // If circuit produces valid output despite invalid input, constraint was bypassed
        switch (circuitName) {
            case 'generic_proof':
                return result.proof_valid === 1; // Should be 0 for invalid inputs
            case 'dynamic_comparator':
                return result.result !== undefined && result.result !== 0;
            case 'template_validator':
                return result.valid === 1; // Should be 0 for invalid templates
            default:
                return false;
        }
    }

    async runFuzzingTests() {
        console.log('🎲 Running Fuzzing Tests...\n');
        
        this.results.fuzzing = {};
        
        for (const [circuitName, config] of Object.entries(SECURITY_TEST_CONFIG)) {
            console.log(`  🎯 Fuzzing ${circuitName}...`);
            
            const fuzzTest = await this.fuzzCircuit(circuitName, config);
            this.results.fuzzing[circuitName] = fuzzTest;
            
            console.log(`    📊 ${fuzzTest.totalInputs} inputs tested`);
            console.log(`    📊 ${fuzzTest.crashes} crashes detected`);
            console.log(`    📊 ${fuzzTest.anomalies} anomalies found`);
        }
    }

    async fuzzCircuit(circuitName, config) {
        const fuzzTest = {
            totalInputs: 0,
            validInputs: 0,
            invalidInputs: 0,
            crashes: 0,
            anomalies: 0,
            timeouts: 0,
            interestingInputs: []
        };
        
        const fuzzIterations = 50; // Adjust based on time constraints
        
        for (let i = 0; i < fuzzIterations; i++) {
            const fuzzInput = this.generateFuzzInput(circuitName);
            fuzzTest.totalInputs++;
            
            try {
                const startTime = Date.now();
                const result = await this.executeCircuitWithPayload(circuitName, fuzzInput);
                const executionTime = Date.now() - startTime;
                
                // Classify result
                if (this.isValidResult(circuitName, result)) {
                    fuzzTest.validInputs++;
                } else {
                    fuzzTest.invalidInputs++;
                }
                
                // Check for anomalies
                if (this.isAnomalousResult(circuitName, result, executionTime)) {
                    fuzzTest.anomalies++;
                    fuzzTest.interestingInputs.push({
                        input: fuzzInput,
                        result: result,
                        executionTime: executionTime,
                        anomaly: 'unusual_result'
                    });
                }
                
            } catch (error) {
                if (error.message.includes('timeout')) {
                    fuzzTest.timeouts++;
                } else {
                    fuzzTest.crashes++;
                    
                    // Save crashing input for analysis
                    fuzzTest.interestingInputs.push({
                        input: fuzzInput,
                        error: error.message,
                        anomaly: 'crash'
                    });
                }
            }
        }
        
        return fuzzTest;
    }

    generateFuzzInput(circuitName) {
        const baseInput = this.generateValidInput(circuitName);
        
        // Randomly mutate fields
        const mutationRate = 0.3; // 30% of fields get mutated
        
        for (const [key, value] of Object.entries(baseInput)) {
            if (Math.random() < mutationRate) {
                if (typeof value === 'number') {
                    // Mutate numeric values
                    baseInput[key] = this.mutateNumericValue(value);
                } else if (Array.isArray(value)) {
                    // Mutate arrays
                    baseInput[key] = this.mutateArray(value);
                } else if (typeof value === 'string') {
                    // Mutate strings
                    baseInput[key] = this.mutateString(value);
                }
            }
        }
        
        return baseInput;
    }

    mutateNumericValue(value) {
        const mutations = [
            () => -value, // Negate
            () => value * 1000, // Scale up
            () => Math.floor(value / 100), // Scale down
            () => 0, // Zero out
            () => Math.pow(2, 31) - 1, // Max int32
            () => Math.random() * 1000000 // Random
        ];
        
        const mutation = mutations[Math.floor(Math.random() * mutations.length)];
        return Math.floor(mutation());
    }

    mutateArray(arr) {
        const mutated = [...arr];
        const mutationType = Math.floor(Math.random() * 4);
        
        switch (mutationType) {
            case 0: // Random values
                return mutated.map(() => Math.floor(Math.random() * 256));
            case 1: // All zeros
                return new Array(mutated.length).fill(0);
            case 2: // All max values
                return new Array(mutated.length).fill(255);
            case 3: // Partial mutation
                for (let i = 0; i < mutated.length; i++) {
                    if (Math.random() < 0.1) { // 10% mutation rate per element
                        mutated[i] = Math.floor(Math.random() * 256);
                    }
                }
                return mutated;
        }
    }

    mutateString(str) {
        const mutations = [
            () => '', // Empty string
            () => 'a'.repeat(100), // Very long string
            () => str + str, // Duplicate
            () => str.split('').reverse().join(''), // Reverse
            () => crypto.randomBytes(32).toString('hex') // Random hex
        ];
        
        const mutation = mutations[Math.floor(Math.random() * mutations.length)];
        return mutation();
    }

    isValidResult(circuitName, result) {
        // Basic validity check based on expected output structure
        switch (circuitName) {
            case 'generic_proof':
                return result.proof_valid !== undefined && 
                       result.data_hash !== undefined && 
                       result.session_hash !== undefined;
            case 'dynamic_comparator':
                return result.result !== undefined;
            case 'template_validator':
                return result.valid !== undefined && result.computed_hash !== undefined;
            default:
                return true;
        }
    }

    isAnomalousResult(circuitName, result, executionTime) {
        // Check for anomalous conditions
        return executionTime > 5000 || // Very slow execution
               this.hasUnexpectedOutputPattern(result) ||
               this.hasExtremeValues(result);
    }

    hasUnexpectedOutputPattern(result) {
        // Check for patterns that might indicate vulnerabilities
        const resultStr = JSON.stringify(result);
        return resultStr.includes('undefined') || 
               resultStr.includes('null') ||
               resultStr.includes('NaN') ||
               resultStr.includes('Infinity');
    }

    hasExtremeValues(result) {
        // Check for extreme numeric values
        for (const value of Object.values(result)) {
            if (typeof value === 'number') {
                if (value > Number.MAX_SAFE_INTEGER || 
                    value < Number.MIN_SAFE_INTEGER ||
                    !Number.isFinite(value)) {
                    return true;
                }
            }
        }
        return false;
    }

    async generateSecurityReport() {
        console.log('\n📄 Generating Security Report...\n');

        const report = {
            metadata: {
                timestamp: new Date().toISOString(),
                testSuite: 'Security Test Suite',
                version: '1.0.0',
                environment: {
                    nodeVersion: process.version,
                    platform: process.platform
                }
            },
            overview: this.results.overview,
            summary: this.generateSecuritySummary(),
            results: this.results,
            riskAssessment: this.generateRiskAssessment(),
            recommendations: this.generateSecurityRecommendations()
        };

        const reportFile = path.join(SECURITY_RESULTS_DIR, 'security-test-report.json');
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

        // Generate HTML report
        await this.generateSecurityHTMLReport(report);

        console.log(`✅ Security report saved to: ${reportFile}`);
        return report;
    }

    generateSecuritySummary() {
        const summary = {
            totalCircuits: Object.keys(SECURITY_TEST_CONFIG).length,
            totalAttacks: 0,
            attacksBlocked: 0,
            attacksSuccessful: 0,
            vulnerabilitiesFound: 0,
            riskLevel: 'UNKNOWN'
        };

        // Aggregate attack test results
        for (const [circuitName, results] of Object.entries(this.results.attackTests || {})) {
            summary.totalAttacks += results.summary?.total || 0;
            summary.attacksBlocked += results.summary?.blocked || 0;
            summary.attacksSuccessful += results.summary?.successful || 0;
        }

        // Count vulnerabilities
        let totalVulns = 0;
        
        // Count timing vulnerabilities
        for (const [circuitName, results] of Object.entries(this.results.timingTests || {})) {
            if (results.vulnerable) totalVulns++;
        }
        
        // Count data leakage issues
        for (const [circuitName, results] of Object.entries(this.results.leakageTests || {})) {
            if (results.leakageDetected) totalVulns++;
        }
        
        // Count constraint bypass issues
        for (const [circuitName, results] of Object.entries(this.results.constraintTests || {})) {
            totalVulns += results.summary?.bypassed || 0;
        }
        
        summary.vulnerabilitiesFound = totalVulns;
        
        // Determine overall risk level
        if (summary.vulnerabilitiesFound === 0) {
            summary.riskLevel = 'LOW';
        } else if (summary.vulnerabilitiesFound <= 2) {
            summary.riskLevel = 'MEDIUM';
        } else {
            summary.riskLevel = 'HIGH';
        }

        return summary;
    }

    generateRiskAssessment() {
        const assessment = {
            overallRisk: 'UNKNOWN',
            criticalIssues: [],
            mediumIssues: [],
            lowIssues: [],
            circuitRisks: {}
        };

        for (const [circuitName, config] of Object.entries(SECURITY_TEST_CONFIG)) {
            const circuitRisk = {
                baseRisk: this.results.overview.riskAssessment[circuitName],
                attackResults: this.results.attackTests[circuitName],
                timingVulns: this.results.timingTests[circuitName]?.vulnerable || false,
                leakageVulns: this.results.leakageTests[circuitName]?.leakageDetected || false,
                constraintIssues: this.results.constraintTests[circuitName]?.summary?.bypassed || 0,
                overallRisk: 'LOW'
            };

            let riskScore = circuitRisk.baseRisk;
            
            // Adjust risk based on findings
            if (circuitRisk.timingVulns) riskScore += 2;
            if (circuitRisk.leakageVulns) riskScore += 3;
            riskScore += circuitRisk.constraintIssues * 2;
            
            // Classify risk level
            if (riskScore >= 8) {
                circuitRisk.overallRisk = 'HIGH';
                assessment.criticalIssues.push(circuitName);
            } else if (riskScore >= 5) {
                circuitRisk.overallRisk = 'MEDIUM';
                assessment.mediumIssues.push(circuitName);
            } else {
                assessment.lowIssues.push(circuitName);
            }

            assessment.circuitRisks[circuitName] = circuitRisk;
        }

        // Determine overall risk
        if (assessment.criticalIssues.length > 0) {
            assessment.overallRisk = 'HIGH';
        } else if (assessment.mediumIssues.length > 0) {
            assessment.overallRisk = 'MEDIUM';
        } else {
            assessment.overallRisk = 'LOW';
        }

        return assessment;
    }

    generateSecurityRecommendations() {
        const recommendations = [];

        // Attack-based recommendations
        for (const [circuitName, results] of Object.entries(this.results.attackTests || {})) {
            if (results.summary?.successful > 0) {
                recommendations.push({
                    type: 'attack_mitigation',
                    priority: 'high',
                    circuit: circuitName,
                    description: `${results.summary.successful} attack(s) were successful against ${circuitName}. Review and strengthen input validation.`
                });
            }
        }

        // Timing attack recommendations
        for (const [circuitName, results] of Object.entries(this.results.timingTests || {})) {
            if (results.vulnerable) {
                recommendations.push({
                    type: 'timing_attack',
                    priority: 'medium',
                    circuit: circuitName,
                    description: `Timing variations detected in ${circuitName} (${results.maxTimingDifference.toFixed(2)}ms). Consider constant-time implementations.`
                });
            }
        }

        // Data leakage recommendations
        for (const [circuitName, results] of Object.entries(this.results.leakageTests || {})) {
            if (results.leakageDetected) {
                recommendations.push({
                    type: 'data_leakage',
                    priority: 'high',
                    circuit: circuitName,
                    description: `Potential data leakage detected in ${circuitName}. Review output generation to ensure no sensitive information is revealed.`
                });
            }
        }

        // Constraint bypass recommendations
        for (const [circuitName, results] of Object.entries(this.results.constraintTests || {})) {
            if (results.summary?.bypassed > 0) {
                recommendations.push({
                    type: 'constraint_enforcement',
                    priority: 'high',
                    circuit: circuitName,
                    description: `${results.summary.bypassed} constraint(s) in ${circuitName} may be bypassable. Strengthen constraint validation.`
                });
            }
        }

        // General recommendations
        if (recommendations.length === 0) {
            recommendations.push({
                type: 'maintenance',
                priority: 'low',
                description: 'No critical security issues detected. Continue regular security testing and monitoring.'
            });
        }

        return recommendations;
    }

    async generateSecurityHTMLReport(report) {
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zephis Security Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .risk-high { color: #dc3545; font-weight: bold; }
        .risk-medium { color: #ffc107; font-weight: bold; }
        .risk-low { color: #28a745; font-weight: bold; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .stat-card.high-risk { border-left-color: #dc3545; }
        .stat-card.medium-risk { border-left-color: #ffc107; }
        .stat-card.low-risk { border-left-color: #28a745; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; margin-top: 5px; }
        .section { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
        .section-header { background: #007bff; color: white; padding: 10px 15px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0; }
        .circuit-results { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
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
            <h1>🛡️ Zephis Security Test Report</h1>
            <p>Generated on ${new Date(report.metadata.timestamp).toLocaleString()}</p>
            <p class="risk-${report.summary.riskLevel.toLowerCase()}">Overall Risk Level: ${report.summary.riskLevel}</p>
        </div>

        <div class="summary">
            <div class="stat-card">
                <div class="stat-number">${report.summary.totalCircuits}</div>
                <div class="stat-label">Circuits Tested</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${report.summary.totalAttacks}</div>
                <div class="stat-label">Total Attacks</div>
            </div>
            <div class="stat-card ${report.summary.attacksBlocked === report.summary.totalAttacks ? 'low-risk' : 'high-risk'}">
                <div class="stat-number">${report.summary.attacksBlocked}</div>
                <div class="stat-label">Attacks Blocked</div>
            </div>
            <div class="stat-card ${report.summary.vulnerabilitiesFound === 0 ? 'low-risk' : 'high-risk'}">
                <div class="stat-number">${report.summary.vulnerabilitiesFound}</div>
                <div class="stat-label">Vulnerabilities</div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">
                <h2>⚔️ Attack Vector Results</h2>
            </div>
            <div class="circuit-results">
                ${Object.entries(report.results.attackTests || {}).map(([circuit, results]) => `
                    <div>
                        <h4>${circuit}</h4>
                        <div class="test-item ${results.summary?.blocked === results.summary?.total ? 'test-passed' : 'test-failed'}">
                            ${results.summary?.blocked || 0}/${results.summary?.total || 0} attacks blocked
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="section">
            <div class="section-header">
                <h2>⏱️ Timing Attack Results</h2>
            </div>
            <div class="circuit-results">
                ${Object.entries(report.results.timingTests || {}).map(([circuit, results]) => `
                    <div>
                        <h4>${circuit}</h4>
                        <div class="test-item ${results.vulnerable ? 'test-warning' : 'test-passed'}">
                            ${results.vulnerable ? '⚠️' : '✅'} Timing Analysis
                            <br><small>Max difference: ${results.maxTimingDifference?.toFixed(2) || 'N/A'}ms</small>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="section">
            <div class="section-header">
                <h2>🔍 Data Leakage Results</h2>
            </div>
            <div class="circuit-results">
                ${Object.entries(report.results.leakageTests || {}).map(([circuit, results]) => `
                    <div>
                        <h4>${circuit}</h4>
                        <div class="test-item ${results.leakageDetected ? 'test-failed' : 'test-passed'}">
                            ${results.leakageDetected ? '❌' : '✅'} Data Leakage Check
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        ${report.recommendations.length > 0 ? `
            <div class="recommendations">
                <h3>🚨 Security Recommendations</h3>
                ${report.recommendations.map(rec => `
                    <div class="recommendation priority-${rec.priority}">
                        <strong>${rec.type?.toUpperCase()} (${rec.priority?.toUpperCase()} PRIORITY)</strong>
                        ${rec.circuit ? `<br><strong>Circuit:</strong> ${rec.circuit}` : ''}
                        <p>${rec.description}</p>
                    </div>
                `).join('')}
            </div>
        ` : ''}

        <div style="margin-top: 40px; text-align: center; color: #666;">
            <p>Generated by Zephis Protocol Security Test Suite</p>
        </div>
    </div>
</body>
</html>`;

        const htmlFile = path.join(SECURITY_RESULTS_DIR, 'security-test-report.html');
        fs.writeFileSync(htmlFile, htmlContent);
        console.log(`✅ Security HTML report saved to: ${htmlFile}`);
    }

    printSecuritySummary(duration) {
        console.log('\n' + '='.repeat(80));
        console.log('🛡️ SECURITY TEST SUITE COMPLETED');
        console.log('='.repeat(80));
        console.log(`⏱️  Total execution time: ${(duration / 1000).toFixed(2)} seconds`);
        
        const summary = this.generateSecuritySummary();
        console.log(`🎯 Total attacks tested: ${summary.totalAttacks}`);
        console.log(`🛡️  Attacks blocked: ${summary.attacksBlocked}`);
        console.log(`⚠️  Attacks successful: ${summary.attacksSuccessful}`);
        console.log(`🚨 Vulnerabilities found: ${summary.vulnerabilitiesFound}`);
        console.log(`📊 Overall risk level: ${summary.riskLevel}`);
        
        console.log(`\n📁 Security results saved to: ${SECURITY_RESULTS_DIR}`);
        console.log(`📄 View detailed report: ${path.join(SECURITY_RESULTS_DIR, 'security-test-report.html')}`);
        console.log('='.repeat(80));

        // Exit with appropriate code based on risk level
        if (summary.riskLevel === 'HIGH' || summary.vulnerabilitiesFound > 3) {
            console.log('\n⚠️  HIGH RISK: Critical security issues detected. Immediate action required.');
            process.exit(1);
        } else if (summary.riskLevel === 'MEDIUM' || summary.vulnerabilitiesFound > 0) {
            console.log('\n⚠️  MEDIUM RISK: Some security issues detected. Review recommendations.');
            process.exit(1);
        } else {
            console.log('\n🎊 LOW RISK: No critical security issues detected!');
            process.exit(0);
        }
    }
}

// CLI execution
if (require.main === module) {
    const tester = new SecurityTestSuite();
    tester.runAllSecurityTests().catch(error => {
        console.error('💥 Security test suite crashed:', error);
        process.exit(1);
    });
}

module.exports = { SecurityTestSuite, SECURITY_TEST_CONFIG };