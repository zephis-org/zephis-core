#!/usr/bin/env node

/**
 * Performance Benchmark Suite for Zephis Circuit Components
 * 
 * Comprehensive performance testing covering:
 * 1. Witness generation performance benchmarks
 * 2. Constraint count analysis and optimization metrics
 * 3. Memory usage profiling during circuit execution
 * 4. Proof generation performance (if setup available)
 * 5. Scalability testing with different input sizes
 * 6. Parallel processing benchmarks
 * 7. Resource utilization analysis
 * 8. Performance regression detection
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');
const os = require('os');

const CIRCUITS_DIR = path.join(__dirname, '..', '..', 'circuits');
const BUILD_DIR = path.join(CIRCUITS_DIR, 'build');
const BENCHMARK_RESULTS_DIR = path.join(__dirname, 'performance-benchmarks');

// Performance benchmark configuration
const BENCHMARK_CONFIG = {
    'generic_proof': {
        inputSizes: [
            { max_data_length: 16, max_tls_length: 256 },
            { max_data_length: 32, max_tls_length: 512 },
            { max_data_length: 64, max_tls_length: 1024 },
            { max_data_length: 128, max_tls_length: 2048 }
        ],
        iterations: 10,
        warmupIterations: 3,
        expectedConstraints: { min: 5000, max: 50000 },
        performanceTargets: {
            witnessGeneration: 5000, // 5 seconds max
            memoryUsage: 1000 * 1024 * 1024, // 1GB max
            constraintDensity: 100 // constraints per second
        }
    },
    'dynamic_comparator': {
        inputSizes: [
            { data_length: 16 },
            { data_length: 32 },
            { data_length: 64 },
            { data_length: 128 }
        ],
        iterations: 15,
        warmupIterations: 5,
        expectedConstraints: { min: 1000, max: 8000 },
        performanceTargets: {
            witnessGeneration: 2000,
            memoryUsage: 500 * 1024 * 1024, // 500MB max
            constraintDensity: 200
        }
    },
    'template_validator': {
        inputSizes: [
            { domain_count: 1, template_data_length: 32 },
            { domain_count: 4, template_data_length: 32 },
            { domain_count: 8, template_data_length: 64 },
            { domain_count: 16, template_data_length: 64 }
        ],
        iterations: 12,
        warmupIterations: 3,
        expectedConstraints: { min: 500, max: 6000 },
        performanceTargets: {
            witnessGeneration: 3000,
            memoryUsage: 512 * 1024 * 1024,
            constraintDensity: 150
        }
    }
};

class PerformanceBenchmarkSuite {
    constructor() {
        this.results = {
            environment: {},
            circuitBenchmarks: {},
            scalabilityAnalysis: {},
            resourceUtilization: {},
            regressionAnalysis: {},
            summary: {}
        };
        this.setupBenchmarkEnvironment();
    }

    setupBenchmarkEnvironment() {
        if (!fs.existsSync(BENCHMARK_RESULTS_DIR)) {
            fs.mkdirSync(BENCHMARK_RESULTS_DIR, { recursive: true });
        }
        
        console.log('⚡ Performance Benchmark Suite Initialized\n');
        console.log(`Benchmark Results: ${BENCHMARK_RESULTS_DIR}`);
        console.log(`Circuits Directory: ${CIRCUITS_DIR}\n`);
        
        // Collect environment information
        this.results.environment = {
            timestamp: new Date().toISOString(),
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            cpuInfo: os.cpus()[0],
            cpuCount: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            loadAverage: os.loadavg()
        };
        
        console.log('🖥️  Environment Information:');
        console.log(`    Platform: ${this.results.environment.platform}`);
        console.log(`    Architecture: ${this.results.environment.arch}`);
        console.log(`    Node.js: ${this.results.environment.nodeVersion}`);
        console.log(`    CPU: ${this.results.environment.cpuInfo.model} (${this.results.environment.cpuCount} cores)`);
        console.log(`    Memory: ${(this.results.environment.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB total\n`);
    }

    async runAllBenchmarks() {
        console.log('🏁 Starting Performance Benchmarks...\n');
        
        const startTime = Date.now();
        
        try {
            // Run circuit benchmarks
            await this.runCircuitBenchmarks();
            
            // Run scalability analysis
            await this.runScalabilityAnalysis();
            
            // Run resource utilization tests
            await this.runResourceUtilizationTests();
            
            // Run regression analysis
            await this.runRegressionAnalysis();
            
            // Generate performance report
            await this.generatePerformanceReport();
            
        } catch (error) {
            console.error('❌ Performance benchmark suite failed:', error.message);
            throw error;
        }
        
        const duration = Date.now() - startTime;
        this.printPerformanceSummary(duration);
    }

    async runCircuitBenchmarks() {
        console.log('⚡ Running Circuit Performance Benchmarks...\n');
        
        for (const [circuitName, config] of Object.entries(BENCHMARK_CONFIG)) {
            console.log(`  📊 Benchmarking ${circuitName}...`);
            
            const circuitBenchmark = await this.benchmarkCircuit(circuitName, config);
            this.results.circuitBenchmarks[circuitName] = circuitBenchmark;
            
            console.log(`    ⏱️  Average witness time: ${circuitBenchmark.witnessGeneration.averageTime.toFixed(2)}ms`);
            console.log(`    📏 Constraint count: ${circuitBenchmark.constraintAnalysis.count}`);
            console.log(`    🧠 Peak memory: ${(circuitBenchmark.memoryProfiling.peakUsage / 1024 / 1024).toFixed(2)}MB\n`);
        }
    }

    async benchmarkCircuit(circuitName, config) {
        const benchmark = {
            circuitName,
            config,
            witnessGeneration: {},
            constraintAnalysis: {},
            memoryProfiling: {},
            throughputAnalysis: {},
            performanceMetrics: {}
        };

        // Benchmark witness generation
        benchmark.witnessGeneration = await this.benchmarkWitnessGeneration(circuitName, config);
        
        // Analyze constraints
        benchmark.constraintAnalysis = await this.analyzeConstraints(circuitName);
        
        // Profile memory usage
        benchmark.memoryProfiling = await this.profileMemoryUsage(circuitName, config);
        
        // Analyze throughput
        benchmark.throughputAnalysis = await this.analyzeThroughput(circuitName, config);
        
        // Calculate performance metrics
        benchmark.performanceMetrics = this.calculatePerformanceMetrics(benchmark, config);

        return benchmark;
    }

    async benchmarkWitnessGeneration(circuitName, config) {
        console.log(`    🎯 Benchmarking witness generation...`);
        
        const witnessGeneration = {
            measurements: [],
            statistics: {},
            performanceProfile: {}
        };

        // Use the standard input size for baseline measurements
        const standardInput = this.generateStandardInput(circuitName, config.inputSizes[1] || config.inputSizes[0]);
        
        // Warmup iterations
        console.log(`      🔥 Running ${config.warmupIterations} warmup iterations...`);
        for (let i = 0; i < config.warmupIterations; i++) {
            try {
                await this.executeCircuitWithTiming(circuitName, standardInput);
            } catch (error) {
                console.log(`      ⚠️  Warmup iteration ${i + 1} failed: ${error.message}`);
            }
        }

        // Benchmark iterations
        console.log(`      ⏱️  Running ${config.iterations} benchmark iterations...`);
        const times = [];
        const memoryUsages = [];
        
        for (let i = 0; i < config.iterations; i++) {
            try {
                const beforeMemory = process.memoryUsage();
                const startTime = process.hrtime.bigint();
                
                await this.executeCircuitWithTiming(circuitName, standardInput);
                
                const endTime = process.hrtime.bigint();
                const afterMemory = process.memoryUsage();
                
                const executionTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
                const memoryDelta = afterMemory.heapUsed - beforeMemory.heapUsed;
                
                times.push(executionTime);
                memoryUsages.push(memoryDelta);
                
                witnessGeneration.measurements.push({
                    iteration: i + 1,
                    executionTime,
                    memoryDelta,
                    beforeMemory,
                    afterMemory
                });
                
            } catch (error) {
                console.log(`      ❌ Iteration ${i + 1} failed: ${error.message}`);
                witnessGeneration.measurements.push({
                    iteration: i + 1,
                    error: error.message
                });
            }
        }

        // Calculate statistics
        if (times.length > 0) {
            witnessGeneration.statistics = {
                count: times.length,
                averageTime: times.reduce((a, b) => a + b, 0) / times.length,
                minTime: Math.min(...times),
                maxTime: Math.max(...times),
                medianTime: this.calculateMedian(times),
                standardDeviation: this.calculateStandardDeviation(times),
                throughput: 1000 / (times.reduce((a, b) => a + b, 0) / times.length) // Operations per second
            };

            // Performance percentiles
            const sortedTimes = times.sort((a, b) => a - b);
            witnessGeneration.statistics.percentiles = {
                p50: sortedTimes[Math.floor(sortedTimes.length * 0.5)],
                p90: sortedTimes[Math.floor(sortedTimes.length * 0.9)],
                p95: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
                p99: sortedTimes[Math.floor(sortedTimes.length * 0.99)]
            };

            // Memory statistics
            if (memoryUsages.length > 0) {
                witnessGeneration.statistics.memory = {
                    averageDelta: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
                    maxDelta: Math.max(...memoryUsages),
                    minDelta: Math.min(...memoryUsages)
                };
            }
        }

        return witnessGeneration;
    }

    async executeCircuitWithTiming(circuitName, input) {
        const inputFile = path.join(BENCHMARK_RESULTS_DIR, `${circuitName}_benchmark_input.json`);
        const witnessFile = path.join(BENCHMARK_RESULTS_DIR, `${circuitName}_benchmark_witness.wtns`);
        const wasmFile = path.join(CIRCUITS_DIR, `${circuitName}.wasm`);

        // Write input file
        fs.writeFileSync(inputFile, JSON.stringify(input, null, 2));

        if (!fs.existsSync(wasmFile)) {
            throw new Error(`WASM file not found: ${wasmFile}`);
        }

        // Execute witness generation
        execSync(`npx snarkjs wtns calculate "${wasmFile}" "${inputFile}" "${witnessFile}"`, {
            stdio: 'pipe',
            timeout: 30000 // 30 second timeout
        });

        // Clean up witness file to save space
        if (fs.existsSync(witnessFile)) {
            fs.unlinkSync(witnessFile);
        }
    }

    generateStandardInput(circuitName, inputSize) {
        switch (circuitName) {
            case 'generic_proof':
                return {
                    extracted_data: Array(inputSize.max_data_length || 64).fill(0).map((_, i) => i < 8 ? 100 + i : 0),
                    tls_session_data: Array(inputSize.max_tls_length || 1024).fill(0),
                    data_length: 8,
                    tls_length: inputSize.max_tls_length ? Math.floor(inputSize.max_tls_length / 2) : 512,
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
                    data: Array(inputSize.data_length || 64).fill(0).map((_, i) => i < 4 ? 150 + i : 0),
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
                    domain_count: inputSize.domain_count || 1,
                    valid_from: Math.floor(Date.now() / 1000) - 86400,
                    valid_until: Math.floor(Date.now() / 1000) + 86400,
                    template_data: Array(64).fill(0).map(() => Math.floor(Math.random() * 256)),
                    template_data_length: inputSize.template_data_length || 32
                };
            default:
                return {};
        }
    }

    async analyzeConstraints(circuitName) {
        console.log(`    📏 Analyzing constraints...`);
        
        const constraintAnalysis = {
            count: 0,
            witnessCount: 0,
            publicInputCount: 0,
            r1csSize: 0,
            density: 0,
            efficiency: 0
        };

        try {
            const r1csFile = path.join(BUILD_DIR, circuitName, `${circuitName}.r1cs`);
            
            if (fs.existsSync(r1csFile)) {
                // Get file size
                const stats = fs.statSync(r1csFile);
                constraintAnalysis.r1csSize = stats.size;

                // Get R1CS information
                const infoOutput = execSync(`npx snarkjs r1cs info "${r1csFile}"`, {
                    encoding: 'utf8',
                    stdio: 'pipe'
                });

                const lines = infoOutput.split('\n');
                for (const line of lines) {
                    if (line.includes('# of Constraints:')) {
                        constraintAnalysis.count = parseInt(line.split(':')[1].trim());
                    } else if (line.includes('# of Private Inputs:')) {
                        constraintAnalysis.witnessCount = parseInt(line.split(':')[1].trim());
                    } else if (line.includes('# of Public Inputs:')) {
                        constraintAnalysis.publicInputCount = parseInt(line.split(':')[1].trim());
                    }
                }

                // Calculate derived metrics
                if (constraintAnalysis.count > 0) {
                    constraintAnalysis.density = constraintAnalysis.count / (stats.size / 1024); // Constraints per KB
                }

                // Calculate efficiency (heuristic based on constraint count vs R1CS size)
                if (stats.size > 0) {
                    constraintAnalysis.efficiency = (constraintAnalysis.count / (stats.size / 1024)) * 100;
                }

            } else {
                console.log(`    ⚠️  R1CS file not found for ${circuitName}`);
            }

        } catch (error) {
            console.log(`    ❌ Constraint analysis failed: ${error.message}`);
            constraintAnalysis.error = error.message;
        }

        return constraintAnalysis;
    }

    async profileMemoryUsage(circuitName, config) {
        console.log(`    🧠 Profiling memory usage...`);
        
        const memoryProfiling = {
            baselineUsage: process.memoryUsage(),
            peakUsage: 0,
            averageUsage: 0,
            memoryGrowth: [],
            gcAnalysis: {}
        };

        const input = this.generateStandardInput(circuitName, config.inputSizes[1] || config.inputSizes[0]);
        const measurements = [];

        try {
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const initialMemory = process.memoryUsage();
            memoryProfiling.baselineUsage = initialMemory;

            // Run multiple iterations to track memory growth
            for (let i = 0; i < 5; i++) {
                const beforeMemory = process.memoryUsage();
                
                await this.executeCircuitWithTiming(circuitName, input);
                
                const afterMemory = process.memoryUsage();
                const memoryDelta = {
                    heapUsed: afterMemory.heapUsed - beforeMemory.heapUsed,
                    heapTotal: afterMemory.heapTotal - beforeMemory.heapTotal,
                    rss: afterMemory.rss - beforeMemory.rss,
                    external: afterMemory.external - beforeMemory.external
                };

                measurements.push(afterMemory);
                memoryProfiling.memoryGrowth.push(memoryDelta);
                memoryProfiling.peakUsage = Math.max(memoryProfiling.peakUsage, afterMemory.heapUsed);
            }

            // Calculate average usage
            if (measurements.length > 0) {
                memoryProfiling.averageUsage = measurements.reduce((sum, mem) => sum + mem.heapUsed, 0) / measurements.length;
            }

            // Analyze memory growth pattern
            if (memoryProfiling.memoryGrowth.length > 1) {
                const growthTrend = memoryProfiling.memoryGrowth.map(g => g.heapUsed);
                memoryProfiling.gcAnalysis = {
                    totalGrowth: growthTrend[growthTrend.length - 1] - growthTrend[0],
                    averageGrowthPerIteration: growthTrend.reduce((sum, g, i) => i > 0 ? sum + (g - growthTrend[i-1]) : sum, 0) / (growthTrend.length - 1),
                    memoryLeakSuspected: growthTrend.every((g, i) => i === 0 || g >= growthTrend[i-1]) // Always increasing
                };
            }

        } catch (error) {
            console.log(`    ❌ Memory profiling failed: ${error.message}`);
            memoryProfiling.error = error.message;
        }

        return memoryProfiling;
    }

    async analyzeThroughput(circuitName, config) {
        console.log(`    📈 Analyzing throughput...`);
        
        const throughputAnalysis = {
            singleThreaded: {},
            concurrent: {},
            resourceEfficiency: {}
        };

        const input = this.generateStandardInput(circuitName, config.inputSizes[1] || config.inputSizes[0]);

        try {
            // Single-threaded throughput
            const startTime = Date.now();
            const iterations = 5;
            
            for (let i = 0; i < iterations; i++) {
                await this.executeCircuitWithTiming(circuitName, input);
            }
            
            const duration = Date.now() - startTime;
            throughputAnalysis.singleThreaded = {
                iterations,
                totalTime: duration,
                averageTime: duration / iterations,
                throughput: (iterations * 1000) / duration // Operations per second
            };

            // Concurrent throughput (if system supports it)
            if (os.cpus().length > 1) {
                throughputAnalysis.concurrent = await this.measureConcurrentThroughput(circuitName, input);
            }

            // Resource efficiency
            throughputAnalysis.resourceEfficiency = {
                operationsPerCore: throughputAnalysis.singleThreaded.throughput / os.cpus().length,
                memoryEfficiency: throughputAnalysis.singleThreaded.throughput / (process.memoryUsage().heapUsed / 1024 / 1024), // Ops per MB
                cpuUtilization: 'Not measured' // Would require additional monitoring
            };

        } catch (error) {
            console.log(`    ❌ Throughput analysis failed: ${error.message}`);
            throughputAnalysis.error = error.message;
        }

        return throughputAnalysis;
    }

    async measureConcurrentThroughput(circuitName, input) {
        const concurrency = Math.min(4, os.cpus().length); // Limit concurrency
        const iterationsPerThread = 2;
        
        console.log(`      🔄 Testing concurrent throughput with ${concurrency} threads...`);
        
        const startTime = Date.now();
        
        // Create promises for concurrent execution
        const promises = [];
        for (let i = 0; i < concurrency; i++) {
            const promise = (async () => {
                for (let j = 0; j < iterationsPerThread; j++) {
                    await this.executeCircuitWithTiming(circuitName, input);
                }
            })();
            promises.push(promise);
        }
        
        await Promise.all(promises);
        
        const duration = Date.now() - startTime;
        const totalOperations = concurrency * iterationsPerThread;
        
        return {
            concurrency,
            iterationsPerThread,
            totalOperations,
            totalTime: duration,
            throughput: (totalOperations * 1000) / duration,
            efficiency: ((totalOperations * 1000) / duration) / concurrency // Per-thread throughput
        };
    }

    calculatePerformanceMetrics(benchmark, config) {
        const metrics = {
            score: 0,
            ratings: {},
            bottlenecks: [],
            recommendations: []
        };

        // Calculate individual performance ratings (0-100)
        if (benchmark.witnessGeneration.statistics) {
            const avgTime = benchmark.witnessGeneration.statistics.averageTime;
            const targetTime = config.performanceTargets.witnessGeneration;
            metrics.ratings.witnessGeneration = Math.max(0, 100 - (avgTime / targetTime) * 100);
        }

        if (benchmark.memoryProfiling.peakUsage) {
            const peakMemory = benchmark.memoryProfiling.peakUsage;
            const targetMemory = config.performanceTargets.memoryUsage;
            metrics.ratings.memoryUsage = Math.max(0, 100 - (peakMemory / targetMemory) * 100);
        }

        if (benchmark.constraintAnalysis.count) {
            const constraintCount = benchmark.constraintAnalysis.count;
            const maxConstraints = config.expectedConstraints.max;
            metrics.ratings.constraintEfficiency = Math.max(0, 100 - (constraintCount / maxConstraints) * 100);
        }

        // Calculate overall score
        const ratings = Object.values(metrics.ratings).filter(r => r !== undefined);
        if (ratings.length > 0) {
            metrics.score = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        }

        // Identify bottlenecks
        if (metrics.ratings.witnessGeneration < 70) {
            metrics.bottlenecks.push('witness_generation');
        }
        if (metrics.ratings.memoryUsage < 70) {
            metrics.bottlenecks.push('memory_usage');
        }
        if (metrics.ratings.constraintEfficiency < 70) {
            metrics.bottlenecks.push('constraint_count');
        }

        // Generate recommendations
        if (metrics.bottlenecks.includes('witness_generation')) {
            metrics.recommendations.push('Optimize witness generation algorithm');
        }
        if (metrics.bottlenecks.includes('memory_usage')) {
            metrics.recommendations.push('Reduce memory footprint and optimize data structures');
        }
        if (metrics.bottlenecks.includes('constraint_count')) {
            metrics.recommendations.push('Optimize circuit constraints and reduce complexity');
        }

        return metrics;
    }

    async runScalabilityAnalysis() {
        console.log('\n📈 Running Scalability Analysis...\n');
        
        this.results.scalabilityAnalysis = {};
        
        for (const [circuitName, config] of Object.entries(BENCHMARK_CONFIG)) {
            console.log(`  📊 Analyzing scalability for ${circuitName}...`);
            
            const scalabilityResult = await this.analyzeCircuitScalability(circuitName, config);
            this.results.scalabilityAnalysis[circuitName] = scalabilityResult;
            
            console.log(`    📈 Scalability factor: ${scalabilityResult.scalabilityFactor.toFixed(2)}`);
            console.log(`    🎯 Optimal input size: ${JSON.stringify(scalabilityResult.optimalInputSize)}`);
        }
    }

    async analyzeCircuitScalability(circuitName, config) {
        const scalability = {
            inputSizeTests: [],
            performanceCurve: [],
            scalabilityFactor: 0,
            optimalInputSize: null,
            limitingFactors: []
        };

        // Test performance across different input sizes
        for (const inputSize of config.inputSizes) {
            console.log(`    🔍 Testing input size: ${JSON.stringify(inputSize)}`);
            
            const input = this.generateStandardInput(circuitName, inputSize);
            const testResult = {
                inputSize,
                averageTime: 0,
                memoryUsage: 0,
                throughput: 0
            };

            try {
                // Run a few iterations for this input size
                const times = [];
                const memoryUsages = [];

                for (let i = 0; i < 3; i++) {
                    const beforeMemory = process.memoryUsage();
                    const startTime = process.hrtime.bigint();
                    
                    await this.executeCircuitWithTiming(circuitName, input);
                    
                    const endTime = process.hrtime.bigint();
                    const afterMemory = process.memoryUsage();
                    
                    const executionTime = Number(endTime - startTime) / 1000000;
                    times.push(executionTime);
                    memoryUsages.push(afterMemory.heapUsed);
                }

                testResult.averageTime = times.reduce((a, b) => a + b, 0) / times.length;
                testResult.memoryUsage = Math.max(...memoryUsages);
                testResult.throughput = 1000 / testResult.averageTime;

            } catch (error) {
                console.log(`      ❌ Test failed for input size: ${error.message}`);
                testResult.error = error.message;
            }

            scalability.inputSizeTests.push(testResult);
        }

        // Analyze scalability curve
        const validTests = scalability.inputSizeTests.filter(t => !t.error);
        if (validTests.length >= 2) {
            // Calculate scalability factor (how performance degrades with size)
            const firstTest = validTests[0];
            const lastTest = validTests[validTests.length - 1];
            
            const sizeIncrease = this.calculateInputSizeIncrease(firstTest.inputSize, lastTest.inputSize);
            const timeIncrease = lastTest.averageTime / firstTest.averageTime;
            
            scalability.scalabilityFactor = timeIncrease / sizeIncrease;
            
            // Find optimal input size (best throughput)
            let bestThroughput = 0;
            for (const test of validTests) {
                if (test.throughput > bestThroughput) {
                    bestThroughput = test.throughput;
                    scalability.optimalInputSize = test.inputSize;
                }
            }

            // Identify limiting factors
            if (scalability.scalabilityFactor > 2) {
                scalability.limitingFactors.push('quadratic_scaling');
            }
            
            const memoryGrowth = lastTest.memoryUsage / firstTest.memoryUsage;
            if (memoryGrowth > sizeIncrease * 1.5) {
                scalability.limitingFactors.push('memory_inefficiency');
            }
        }

        return scalability;
    }

    calculateInputSizeIncrease(firstSize, lastSize) {
        // Simple heuristic: sum all numeric values and compare
        const firstSum = Object.values(firstSize).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
        const lastSum = Object.values(lastSize).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
        
        return lastSum / firstSum;
    }

    async runResourceUtilizationTests() {
        console.log('\n💻 Running Resource Utilization Tests...\n');
        
        this.results.resourceUtilization = {
            cpuUtilization: {},
            memoryUtilization: {},
            diskUtilization: {},
            networkUtilization: {}
        };

        // CPU utilization analysis
        await this.analyzeCpuUtilization();
        
        // Memory utilization analysis
        await this.analyzeMemoryUtilization();
        
        // Disk I/O analysis
        await this.analyzeDiskUtilization();
    }

    async analyzeCpuUtilization() {
        console.log('  🖥️  Analyzing CPU utilization...');
        
        const cpuAnalysis = {
            beforeLoad: os.loadavg(),
            duringLoad: [],
            afterLoad: [],
            efficiency: 0
        };

        try {
            // Run a CPU-intensive circuit operation
            const circuitName = 'generic_proof';
            const config = BENCHMARK_CONFIG[circuitName];
            const input = this.generateStandardInput(circuitName, config.inputSizes[2] || config.inputSizes[0]);

            // Monitor load average during execution
            const startTime = Date.now();
            const loadMonitor = setInterval(() => {
                cpuAnalysis.duringLoad.push(os.loadavg());
            }, 1000);

            // Execute multiple iterations
            for (let i = 0; i < 3; i++) {
                await this.executeCircuitWithTiming(circuitName, input);
            }

            clearInterval(loadMonitor);
            
            // Wait a bit and measure final load
            setTimeout(() => {
                cpuAnalysis.afterLoad = os.loadavg();
            }, 2000);

            // Calculate efficiency
            if (cpuAnalysis.duringLoad.length > 0) {
                const avgLoad = cpuAnalysis.duringLoad.reduce((sum, load) => sum + load[0], 0) / cpuAnalysis.duringLoad.length;
                const maxLoad = os.cpus().length;
                cpuAnalysis.efficiency = (avgLoad / maxLoad) * 100;
            }

        } catch (error) {
            cpuAnalysis.error = error.message;
        }

        this.results.resourceUtilization.cpuUtilization = cpuAnalysis;
        console.log(`    📊 CPU efficiency: ${cpuAnalysis.efficiency.toFixed(1)}%`);
    }

    async analyzeMemoryUtilization() {
        console.log('  🧠 Analyzing memory utilization...');
        
        const memoryAnalysis = {
            systemMemory: {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem()
            },
            processMemory: process.memoryUsage(),
            peakUsage: 0,
            utilizationPattern: []
        };

        try {
            // Monitor memory during intensive operations
            const circuitName = 'generic_proof';
            const config = BENCHMARK_CONFIG[circuitName];
            const input = this.generateStandardInput(circuitName, config.inputSizes[2] || config.inputSizes[0]);

            const memoryMonitor = setInterval(() => {
                const usage = process.memoryUsage();
                memoryAnalysis.utilizationPattern.push(usage);
                memoryAnalysis.peakUsage = Math.max(memoryAnalysis.peakUsage, usage.heapUsed);
            }, 500);

            // Execute operations
            for (let i = 0; i < 5; i++) {
                await this.executeCircuitWithTiming(circuitName, input);
            }

            clearInterval(memoryMonitor);

        } catch (error) {
            memoryAnalysis.error = error.message;
        }

        this.results.resourceUtilization.memoryUtilization = memoryAnalysis;
        console.log(`    📊 Peak memory usage: ${(memoryAnalysis.peakUsage / 1024 / 1024).toFixed(2)}MB`);
    }

    async analyzeDiskUtilization() {
        console.log('  💾 Analyzing disk utilization...');
        
        const diskAnalysis = {
            temporaryFiles: 0,
            totalBytesWritten: 0,
            totalBytesRead: 0,
            ioOperations: 0
        };

        try {
            const beforeFiles = fs.readdirSync(BENCHMARK_RESULTS_DIR);
            
            // Execute operations that involve file I/O
            const circuitName = 'generic_proof';
            const config = BENCHMARK_CONFIG[circuitName];
            const input = this.generateStandardInput(circuitName, config.inputSizes[1] || config.inputSizes[0]);

            for (let i = 0; i < 3; i++) {
                await this.executeCircuitWithTiming(circuitName, input);
                diskAnalysis.ioOperations++;
            }

            const afterFiles = fs.readdirSync(BENCHMARK_RESULTS_DIR);
            diskAnalysis.temporaryFiles = afterFiles.length - beforeFiles.length;

            // Estimate bytes written (rough approximation)
            diskAnalysis.totalBytesWritten = diskAnalysis.ioOperations * 1024 * 1024; // Rough estimate

        } catch (error) {
            diskAnalysis.error = error.message;
        }

        this.results.resourceUtilization.diskUtilization = diskAnalysis;
        console.log(`    📊 I/O operations: ${diskAnalysis.ioOperations}`);
    }

    async runRegressionAnalysis() {
        console.log('\n📉 Running Performance Regression Analysis...\n');
        
        this.results.regressionAnalysis = {
            baselineComparison: {},
            performanceTrends: {},
            regressionDetection: {}
        };

        // Load previous benchmark results if available
        const previousResultsFile = path.join(BENCHMARK_RESULTS_DIR, 'previous-benchmark-results.json');
        let previousResults = null;
        
        if (fs.existsSync(previousResultsFile)) {
            try {
                previousResults = JSON.parse(fs.readFileSync(previousResultsFile, 'utf8'));
                console.log('  📊 Previous benchmark results found for comparison');
            } catch (error) {
                console.log('  ⚠️  Could not load previous benchmark results');
            }
        } else {
            console.log('  ℹ️  No previous benchmark results found (first run)');
        }

        if (previousResults) {
            // Compare current results with previous results
            for (const [circuitName, currentBenchmark] of Object.entries(this.results.circuitBenchmarks)) {
                const previousBenchmark = previousResults.circuitBenchmarks?.[circuitName];
                
                if (previousBenchmark) {
                    const comparison = this.comparePerformance(currentBenchmark, previousBenchmark);
                    this.results.regressionAnalysis.baselineComparison[circuitName] = comparison;
                    
                    if (comparison.isRegression) {
                        console.log(`    ❌ Performance regression detected in ${circuitName}: ${comparison.regressionType}`);
                    } else if (comparison.isImprovement) {
                        console.log(`    ✅ Performance improvement in ${circuitName}: ${comparison.improvementType}`);
                    } else {
                        console.log(`    ➖ No significant change in ${circuitName}`);
                    }
                }
            }
        }

        // Save current results as previous for next run
        const currentResultsForStorage = {
            timestamp: new Date().toISOString(),
            environment: this.results.environment,
            circuitBenchmarks: this.results.circuitBenchmarks
        };
        
        fs.writeFileSync(previousResultsFile, JSON.stringify(currentResultsForStorage, null, 2));
    }

    comparePerformance(current, previous) {
        const comparison = {
            isRegression: false,
            isImprovement: false,
            regressionType: null,
            improvementType: null,
            changes: {}
        };

        // Compare witness generation time
        if (current.witnessGeneration.statistics && previous.witnessGeneration.statistics) {
            const currentTime = current.witnessGeneration.statistics.averageTime;
            const previousTime = previous.witnessGeneration.statistics.averageTime;
            const timeChange = ((currentTime - previousTime) / previousTime) * 100;
            
            comparison.changes.witnessGeneration = {
                current: currentTime,
                previous: previousTime,
                changePercent: timeChange
            };

            if (timeChange > 20) { // 20% slower
                comparison.isRegression = true;
                comparison.regressionType = 'witness_generation_slowdown';
            } else if (timeChange < -20) { // 20% faster
                comparison.isImprovement = true;
                comparison.improvementType = 'witness_generation_speedup';
            }
        }

        // Compare memory usage
        if (current.memoryProfiling.peakUsage && previous.memoryProfiling.peakUsage) {
            const currentMemory = current.memoryProfiling.peakUsage;
            const previousMemory = previous.memoryProfiling.peakUsage;
            const memoryChange = ((currentMemory - previousMemory) / previousMemory) * 100;
            
            comparison.changes.memoryUsage = {
                current: currentMemory,
                previous: previousMemory,
                changePercent: memoryChange
            };

            if (memoryChange > 30) { // 30% more memory
                comparison.isRegression = true;
                comparison.regressionType = 'memory_usage_increase';
            } else if (memoryChange < -30) { // 30% less memory
                comparison.isImprovement = true;
                comparison.improvementType = 'memory_usage_decrease';
            }
        }

        return comparison;
    }

    // Utility functions
    calculateMedian(arr) {
        const sorted = arr.sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        
        if (sorted.length % 2 === 0) {
            return (sorted[middle - 1] + sorted[middle]) / 2;
        } else {
            return sorted[middle];
        }
    }

    calculateStandardDeviation(arr) {
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const squaredDiffs = arr.map(value => Math.pow(value - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
        return Math.sqrt(avgSquaredDiff);
    }

    async generatePerformanceReport() {
        console.log('\n📄 Generating Performance Report...\n');

        const report = {
            metadata: {
                timestamp: new Date().toISOString(),
                testSuite: 'Performance Benchmark Suite',
                version: '1.0.0',
                environment: this.results.environment
            },
            summary: this.generatePerformanceSummary(),
            results: this.results,
            recommendations: this.generatePerformanceRecommendations()
        };

        const reportFile = path.join(BENCHMARK_RESULTS_DIR, 'performance-benchmark-report.json');
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

        // Generate HTML report
        await this.generatePerformanceHTMLReport(report);

        console.log(`✅ Performance report saved to: ${reportFile}`);
        return report;
    }

    generatePerformanceSummary() {
        const summary = {
            totalCircuitsTested: Object.keys(this.results.circuitBenchmarks).length,
            overallPerformanceScore: 0,
            fastestCircuit: null,
            slowestCircuit: null,
            mostEfficientCircuit: null,
            bottlenecks: [],
            improvements: []
        };

        let totalScore = 0;
        let bestScore = 0;
        let worstScore = 100;

        for (const [circuitName, benchmark] of Object.entries(this.results.circuitBenchmarks)) {
            const score = benchmark.performanceMetrics?.score || 0;
            totalScore += score;

            if (score > bestScore) {
                bestScore = score;
                summary.mostEfficientCircuit = circuitName;
            }

            if (score < worstScore) {
                worstScore = score;
            }

            // Find fastest and slowest by witness generation time
            const avgTime = benchmark.witnessGeneration.statistics?.averageTime;
            if (avgTime) {
                if (!summary.fastestCircuit || avgTime < this.results.circuitBenchmarks[summary.fastestCircuit].witnessGeneration.statistics.averageTime) {
                    summary.fastestCircuit = circuitName;
                }
                if (!summary.slowestCircuit || avgTime > this.results.circuitBenchmarks[summary.slowestCircuit].witnessGeneration.statistics.averageTime) {
                    summary.slowestCircuit = circuitName;
                }
            }

            // Collect bottlenecks
            if (benchmark.performanceMetrics?.bottlenecks) {
                summary.bottlenecks.push(...benchmark.performanceMetrics.bottlenecks.map(b => `${circuitName}: ${b}`));
            }
        }

        summary.overallPerformanceScore = summary.totalCircuitsTested > 0 ? totalScore / summary.totalCircuitsTested : 0;

        return summary;
    }

    generatePerformanceRecommendations() {
        const recommendations = [];

        // Analyze circuit-specific recommendations
        for (const [circuitName, benchmark] of Object.entries(this.results.circuitBenchmarks)) {
            if (benchmark.performanceMetrics?.recommendations) {
                for (const rec of benchmark.performanceMetrics.recommendations) {
                    recommendations.push({
                        type: 'circuit_optimization',
                        priority: benchmark.performanceMetrics.score < 50 ? 'high' : 'medium',
                        circuit: circuitName,
                        description: rec
                    });
                }
            }
        }

        // Analyze scalability recommendations
        for (const [circuitName, scalability] of Object.entries(this.results.scalabilityAnalysis)) {
            if (scalability.limitingFactors?.includes('quadratic_scaling')) {
                recommendations.push({
                    type: 'scalability',
                    priority: 'high',
                    circuit: circuitName,
                    description: 'Circuit shows quadratic scaling behavior. Consider algorithmic optimizations.'
                });
            }
            if (scalability.limitingFactors?.includes('memory_inefficiency')) {
                recommendations.push({
                    type: 'memory_optimization',
                    priority: 'medium',
                    circuit: circuitName,
                    description: 'Memory usage grows faster than input size. Optimize data structures.'
                });
            }
        }

        // System-level recommendations
        const cpuEfficiency = this.results.resourceUtilization.cpuUtilization?.efficiency || 0;
        if (cpuEfficiency < 50) {
            recommendations.push({
                type: 'system_optimization',
                priority: 'low',
                description: `CPU utilization is low (${cpuEfficiency.toFixed(1)}%). Consider parallel processing.`
            });
        }

        return recommendations;
    }

    async generatePerformanceHTMLReport(report) {
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zephis Performance Benchmark Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .score-excellent { color: #28a745; font-weight: bold; }
        .score-good { color: #17a2b8; font-weight: bold; }
        .score-fair { color: #ffc107; font-weight: bold; }
        .score-poor { color: #dc3545; font-weight: bold; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; margin-top: 5px; }
        .section { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
        .section-header { background: #007bff; color: white; padding: 10px 15px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0; }
        .circuit-results { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 15px; }
        .performance-metric { margin: 10px 0; padding: 10px; border-radius: 4px; background: #f8f9fa; }
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
            <h1>⚡ Zephis Performance Benchmark Report</h1>
            <p>Generated on ${new Date(report.metadata.timestamp).toLocaleString()}</p>
            <p class="score-${this.getScoreClass(report.summary.overallPerformanceScore)}">
                Overall Performance Score: ${report.summary.overallPerformanceScore.toFixed(1)}/100
            </p>
        </div>

        <div class="summary">
            <div class="stat-card">
                <div class="stat-number">${report.summary.totalCircuitsTested}</div>
                <div class="stat-label">Circuits Tested</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${report.summary.fastestCircuit || 'N/A'}</div>
                <div class="stat-label">Fastest Circuit</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${report.summary.mostEfficientCircuit || 'N/A'}</div>
                <div class="stat-label">Most Efficient</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${report.metadata.environment.cpuCount}</div>
                <div class="stat-label">CPU Cores</div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">
                <h2>⚡ Circuit Benchmarks</h2>
            </div>
            <div class="circuit-results">
                ${Object.entries(report.results.circuitBenchmarks).map(([circuit, benchmark]) => `
                    <div>
                        <h4>${circuit}</h4>
                        <div class="performance-metric">
                            <strong>Witness Generation:</strong> ${benchmark.witnessGeneration.statistics?.averageTime?.toFixed(2) || 'N/A'}ms avg
                        </div>
                        <div class="performance-metric">
                            <strong>Constraints:</strong> ${benchmark.constraintAnalysis?.count || 'N/A'}
                        </div>
                        <div class="performance-metric">
                            <strong>Memory:</strong> ${benchmark.memoryProfiling?.peakUsage ? (benchmark.memoryProfiling.peakUsage / 1024 / 1024).toFixed(2) + 'MB' : 'N/A'}
                        </div>
                        <div class="performance-metric">
                            <strong>Score:</strong> 
                            <span class="score-${this.getScoreClass(benchmark.performanceMetrics?.score || 0)}">
                                ${benchmark.performanceMetrics?.score?.toFixed(1) || 'N/A'}/100
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="section">
            <div class="section-header">
                <h2>📈 Scalability Analysis</h2>
            </div>
            <div class="circuit-results">
                ${Object.entries(report.results.scalabilityAnalysis || {}).map(([circuit, scalability]) => `
                    <div>
                        <h4>${circuit}</h4>
                        <div class="performance-metric">
                            <strong>Scalability Factor:</strong> ${scalability.scalabilityFactor?.toFixed(2) || 'N/A'}
                        </div>
                        <div class="performance-metric">
                            <strong>Limiting Factors:</strong> ${scalability.limitingFactors?.join(', ') || 'None detected'}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        ${report.recommendations.length > 0 ? `
            <div class="recommendations">
                <h3>🎯 Performance Recommendations</h3>
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
            <p>Generated by Zephis Protocol Performance Benchmark Suite</p>
        </div>
    </div>
</body>
</html>`;

        const htmlFile = path.join(BENCHMARK_RESULTS_DIR, 'performance-benchmark-report.html');
        fs.writeFileSync(htmlFile, htmlContent);
        console.log(`✅ Performance HTML report saved to: ${htmlFile}`);
    }

    getScoreClass(score) {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'fair';
        return 'poor';
    }

    printPerformanceSummary(duration) {
        console.log('\n' + '='.repeat(80));
        console.log('⚡ PERFORMANCE BENCHMARK SUITE COMPLETED');
        console.log('='.repeat(80));
        console.log(`⏱️  Total execution time: ${(duration / 1000).toFixed(2)} seconds`);
        
        const summary = this.generatePerformanceSummary();
        console.log(`📊 Circuits tested: ${summary.totalCircuitsTested}`);
        console.log(`🎯 Overall performance score: ${summary.overallPerformanceScore.toFixed(1)}/100`);
        console.log(`🚀 Fastest circuit: ${summary.fastestCircuit || 'N/A'}`);
        console.log(`🐌 Slowest circuit: ${summary.slowestCircuit || 'N/A'}`);
        console.log(`⭐ Most efficient circuit: ${summary.mostEfficientCircuit || 'N/A'}`);
        
        if (summary.bottlenecks.length > 0) {
            console.log(`⚠️  Bottlenecks detected: ${summary.bottlenecks.length}`);
        }
        
        console.log(`\n📁 Benchmark results saved to: ${BENCHMARK_RESULTS_DIR}`);
        console.log(`📄 View detailed report: ${path.join(BENCHMARK_RESULTS_DIR, 'performance-benchmark-report.html')}`);
        console.log('='.repeat(80));

        // Exit with appropriate code based on performance
        if (summary.overallPerformanceScore < 40) {
            console.log('\n⚠️  Performance is below acceptable levels. Review recommendations.');
            process.exit(1);
        } else if (summary.overallPerformanceScore < 70) {
            console.log('\n⚠️  Performance could be improved. Consider optimizations.');
            process.exit(0);
        } else {
            console.log('\n🎊 Performance is within acceptable ranges!');
            process.exit(0);
        }
    }
}

// CLI execution
if (require.main === module) {
    const tester = new PerformanceBenchmarkSuite();
    tester.runAllBenchmarks().catch(error => {
        console.error('💥 Performance benchmark suite crashed:', error);
        process.exit(1);
    });
}

module.exports = { PerformanceBenchmarkSuite, BENCHMARK_CONFIG };