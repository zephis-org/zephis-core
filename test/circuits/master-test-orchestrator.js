#!/usr/bin/env node

/**
 * Master Test Orchestrator for Zephis Circuit Testing
 * 
 * This is the main entry point for all circuit testing. It coordinates:
 * 1. Comprehensive circuit unit tests
 * 2. Build system integration tests  
 * 3. Security vulnerability tests
 * 4. Performance benchmarks
 * 5. Docker environment tests
 * 6. Regression testing
 * 7. Final consolidated reporting
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import test suites
const { ComprehensiveCircuitTester } = require('./comprehensive-circuit-test-suite');
const { BuildSystemIntegrationTester } = require('./build-system-integration-test-suite');
const { SecurityTestSuite } = require('./security-test-suite');
const { PerformanceBenchmarkSuite } = require('./performance-benchmark-suite');

const MASTER_RESULTS_DIR = path.join(__dirname, 'master-test-results');
const PROJECT_ROOT = path.join(__dirname, '..', '..');

class MasterTestOrchestrator {
    constructor(options = {}) {
        this.options = {
            runCircuitTests: options.runCircuitTests !== false,
            runBuildTests: options.runBuildTests !== false,
            runSecurityTests: options.runSecurityTests !== false,
            runPerformanceTests: options.runPerformanceTests !== false,
            runDockerTests: options.runDockerTests !== false,
            generateReport: options.generateReport !== false,
            parallel: options.parallel || false,
            verbose: options.verbose || false,
            ...options
        };
        
        this.results = {
            overview: {},
            testSuites: {},
            consolidatedMetrics: {},
            finalRecommendations: [],
            executionSummary: {}
        };
        
        this.setupMasterEnvironment();
    }

    setupMasterEnvironment() {
        if (!fs.existsSync(MASTER_RESULTS_DIR)) {
            fs.mkdirSync(MASTER_RESULTS_DIR, { recursive: true });
        }
        
        console.log('🎭 Master Test Orchestrator Initialized\n');
        console.log(`Master Results Directory: ${MASTER_RESULTS_DIR}`);
        console.log(`Project Root: ${PROJECT_ROOT}`);
        console.log(`Test Configuration:`);
        console.log(`  Circuit Tests: ${this.options.runCircuitTests ? '✅' : '❌'}`);
        console.log(`  Build Tests: ${this.options.runBuildTests ? '✅' : '❌'}`);
        console.log(`  Security Tests: ${this.options.runSecurityTests ? '✅' : '❌'}`);
        console.log(`  Performance Tests: ${this.options.runPerformanceTests ? '✅' : '❌'}`);
        console.log(`  Docker Tests: ${this.options.runDockerTests ? '✅' : '❌'}`);
        console.log(`  Parallel Execution: ${this.options.parallel ? '✅' : '❌'}\n`);
    }

    async runAllTests() {
        console.log('🚀 Starting Master Test Orchestration...\n');
        console.log('═'.repeat(100));
        console.log('                    ZEPHIS PROTOCOL COMPREHENSIVE TEST SUITE');
        console.log('═'.repeat(100));
        
        const overallStartTime = Date.now();
        
        try {
            // Generate test overview
            await this.generateTestOverview();
            
            // Run test suites
            if (this.options.parallel) {
                await this.runTestSuitesInParallel();
            } else {
                await this.runTestSuitesSequentially();
            }
            
            // Run Docker integration tests
            if (this.options.runDockerTests) {
                await this.runDockerIntegrationTests();
            }
            
            // Consolidate results
            await this.consolidateResults();
            
            // Generate final report
            if (this.options.generateReport) {
                await this.generateMasterReport();
            }
            
        } catch (error) {
            console.error('❌ Master test orchestration failed:', error.message);
            throw error;
        }
        
        const overallDuration = Date.now() - overallStartTime;
        this.printMasterSummary(overallDuration);
        
        return this.results;
    }

    async generateTestOverview() {
        console.log('📋 Generating Test Overview...\n');
        
        this.results.overview = {
            timestamp: new Date().toISOString(),
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                cwd: process.cwd()
            },
            testConfiguration: this.options,
            plannedTestSuites: [],
            estimatedDuration: 0
        };

        // Determine which test suites will run
        if (this.options.runCircuitTests) {
            this.results.overview.plannedTestSuites.push({
                name: 'Circuit Tests',
                description: 'Comprehensive unit tests for all circuit components',
                estimatedDuration: 300 // 5 minutes
            });
            this.results.overview.estimatedDuration += 300;
        }

        if (this.options.runBuildTests) {
            this.results.overview.plannedTestSuites.push({
                name: 'Build System Tests',
                description: 'Integration tests for build pipeline and dependencies',
                estimatedDuration: 180 // 3 minutes
            });
            this.results.overview.estimatedDuration += 180;
        }

        if (this.options.runSecurityTests) {
            this.results.overview.plannedTestSuites.push({
                name: 'Security Tests',
                description: 'Security vulnerability and attack vector testing',
                estimatedDuration: 240 // 4 minutes
            });
            this.results.overview.estimatedDuration += 240;
        }

        if (this.options.runPerformanceTests) {
            this.results.overview.plannedTestSuites.push({
                name: 'Performance Benchmarks',
                description: 'Performance benchmarking and optimization analysis',
                estimatedDuration: 420 // 7 minutes
            });
            this.results.overview.estimatedDuration += 420;
        }

        if (this.options.runDockerTests) {
            this.results.overview.plannedTestSuites.push({
                name: 'Docker Integration Tests',
                description: 'Containerized environment testing',
                estimatedDuration: 300 // 5 minutes
            });
            this.results.overview.estimatedDuration += 300;
        }

        console.log(`📊 Test Suites Planned: ${this.results.overview.plannedTestSuites.length}`);
        console.log(`⏱️  Estimated Duration: ${Math.ceil(this.results.overview.estimatedDuration / 60)} minutes\n`);
    }

    async runTestSuitesSequentially() {
        console.log('🔄 Running Test Suites Sequentially...\n');
        
        // Circuit Tests
        if (this.options.runCircuitTests) {
            await this.runCircuitTestSuite();
        }
        
        // Build System Tests
        if (this.options.runBuildTests) {
            await this.runBuildSystemTestSuite();
        }
        
        // Security Tests
        if (this.options.runSecurityTests) {
            await this.runSecurityTestSuite();
        }
        
        // Performance Tests
        if (this.options.runPerformanceTests) {
            await this.runPerformanceTestSuite();
        }
    }

    async runTestSuitesInParallel() {
        console.log('⚡ Running Test Suites in Parallel...\n');
        
        const testPromises = [];
        
        // Note: Some tests may have dependencies, so we group them appropriately
        // Group 1: Independent tests that can run in parallel
        const independentTests = [];
        
        if (this.options.runCircuitTests) {
            independentTests.push(this.runCircuitTestSuite());
        }
        
        if (this.options.runSecurityTests) {
            independentTests.push(this.runSecurityTestSuite());
        }

        if (this.options.runPerformanceTests) {
            independentTests.push(this.runPerformanceTestSuite());
        }
        
        // Run independent tests in parallel
        if (independentTests.length > 0) {
            console.log(`🚀 Running ${independentTests.length} independent test suites in parallel...`);
            await Promise.allSettled(independentTests);
        }
        
        // Group 2: Dependent tests that need build system
        if (this.options.runBuildTests) {
            await this.runBuildSystemTestSuite();
        }
    }

    async runCircuitTestSuite() {
        console.log('🧪 Running Circuit Test Suite...\n');
        const startTime = Date.now();
        
        try {
            const circuitTester = new ComprehensiveCircuitTester();
            const results = await circuitTester.runAllTests();
            
            this.results.testSuites.circuitTests = {
                status: 'completed',
                duration: Date.now() - startTime,
                results: results,
                summary: {
                    totalTests: results.testStats?.totalTests || 0,
                    passedTests: results.testStats?.passedTests || 0,
                    failedTests: results.testStats?.failedTests || 0,
                    successRate: results.testStats?.totalTests > 0 ? 
                        (results.testStats.passedTests / results.testStats.totalTests * 100) : 0
                }
            };
            
            console.log(`✅ Circuit tests completed in ${(this.results.testSuites.circuitTests.duration / 1000).toFixed(2)}s`);
            
        } catch (error) {
            this.results.testSuites.circuitTests = {
                status: 'failed',
                duration: Date.now() - startTime,
                error: error.message
            };
            console.log(`❌ Circuit tests failed: ${error.message}`);
        }
    }

    async runBuildSystemTestSuite() {
        console.log('🏗️  Running Build System Test Suite...\n');
        const startTime = Date.now();
        
        try {
            const buildTester = new BuildSystemIntegrationTester();
            const results = await buildTester.runAllTests();
            
            this.results.testSuites.buildSystemTests = {
                status: 'completed',
                duration: Date.now() - startTime,
                results: results,
                summary: {
                    categoriesTested: results.summary?.totalCategories || 0,
                    categoriesPassed: results.summary?.passedCategories || 0,
                    categoriesFailed: results.summary?.failedCategories || 0,
                    successRate: results.summary?.successRate || 0
                }
            };
            
            console.log(`✅ Build system tests completed in ${(this.results.testSuites.buildSystemTests.duration / 1000).toFixed(2)}s`);
            
        } catch (error) {
            this.results.testSuites.buildSystemTests = {
                status: 'failed',
                duration: Date.now() - startTime,
                error: error.message
            };
            console.log(`❌ Build system tests failed: ${error.message}`);
        }
    }

    async runSecurityTestSuite() {
        console.log('🛡️  Running Security Test Suite...\n');
        const startTime = Date.now();
        
        try {
            const securityTester = new SecurityTestSuite();
            const results = await securityTester.runAllSecurityTests();
            
            this.results.testSuites.securityTests = {
                status: 'completed',
                duration: Date.now() - startTime,
                results: results,
                summary: {
                    totalAttacks: results.summary?.totalAttacks || 0,
                    attacksBlocked: results.summary?.attacksBlocked || 0,
                    vulnerabilities: results.summary?.vulnerabilitiesFound || 0,
                    riskLevel: results.summary?.riskLevel || 'UNKNOWN'
                }
            };
            
            console.log(`✅ Security tests completed in ${(this.results.testSuites.securityTests.duration / 1000).toFixed(2)}s`);
            
        } catch (error) {
            this.results.testSuites.securityTests = {
                status: 'failed',
                duration: Date.now() - startTime,
                error: error.message
            };
            console.log(`❌ Security tests failed: ${error.message}`);
        }
    }

    async runPerformanceTestSuite() {
        console.log('⚡ Running Performance Test Suite...\n');
        const startTime = Date.now();
        
        try {
            const performanceTester = new PerformanceBenchmarkSuite();
            const results = await performanceTester.runAllBenchmarks();
            
            this.results.testSuites.performanceTests = {
                status: 'completed',
                duration: Date.now() - startTime,
                results: results,
                summary: {
                    circuitsTested: results.summary?.totalCircuitsTested || 0,
                    overallScore: results.summary?.overallPerformanceScore || 0,
                    fastestCircuit: results.summary?.fastestCircuit || 'N/A',
                    bottlenecks: results.summary?.bottlenecks?.length || 0
                }
            };
            
            console.log(`✅ Performance tests completed in ${(this.results.testSuites.performanceTests.duration / 1000).toFixed(2)}s`);
            
        } catch (error) {
            this.results.testSuites.performanceTests = {
                status: 'failed',
                duration: Date.now() - startTime,
                error: error.message
            };
            console.log(`❌ Performance tests failed: ${error.message}`);
        }
    }

    async runDockerIntegrationTests() {
        console.log('🐳 Running Docker Integration Tests...\n');
        const startTime = Date.now();
        
        try {
            const dockerResults = await this.executeDockerTests();
            
            this.results.testSuites.dockerTests = {
                status: 'completed',
                duration: Date.now() - startTime,
                results: dockerResults,
                summary: {
                    imageBuilds: dockerResults.imageBuilds?.length || 0,
                    containerTests: dockerResults.containerTests?.length || 0,
                    circuitCompilation: dockerResults.circuitCompilation?.success || false
                }
            };
            
            console.log(`✅ Docker tests completed in ${(this.results.testSuites.dockerTests.duration / 1000).toFixed(2)}s`);
            
        } catch (error) {
            this.results.testSuites.dockerTests = {
                status: 'failed',
                duration: Date.now() - startTime,
                error: error.message
            };
            console.log(`❌ Docker tests failed: ${error.message}`);
        }
    }

    async executeDockerTests() {
        const dockerTests = {
            dockerfileValidation: {},
            imageBuilds: [],
            containerTests: [],
            circuitCompilation: {},
            networkTests: {}
        };

        try {
            // Check if Docker is available
            execSync('docker --version', { stdio: 'pipe' });
            console.log('  ✅ Docker is available');
            
            // Test Dockerfile validation
            dockerTests.dockerfileValidation = await this.validateDockerfile();
            
            // Test image building
            dockerTests.imageBuilds = await this.testDockerImageBuilding();
            
            // Test container execution
            dockerTests.containerTests = await this.testContainerExecution();
            
            // Test circuit compilation in container
            dockerTests.circuitCompilation = await this.testCircuitCompilationInDocker();
            
        } catch (error) {
            console.log('  ❌ Docker not available or tests failed:', error.message);
            throw error;
        }

        return dockerTests;
    }

    async validateDockerfile() {
        const validation = { valid: false, issues: [] };
        
        const dockerfilePath = path.join(PROJECT_ROOT, 'Dockerfile');
        
        if (fs.existsSync(dockerfilePath)) {
            const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
            
            // Basic validation
            if (dockerfile.includes('FROM node')) {
                validation.valid = true;
            } else {
                validation.issues.push('Missing or invalid base image');
            }
            
            if (!dockerfile.includes('WORKDIR')) {
                validation.issues.push('No WORKDIR specified');
            }
            
            if (!dockerfile.includes('COPY') && !dockerfile.includes('ADD')) {
                validation.issues.push('No files copied to container');
            }
            
            console.log(`  📋 Dockerfile validation: ${validation.valid ? 'VALID' : 'ISSUES FOUND'}`);
            
        } else {
            validation.issues.push('Dockerfile not found');
            console.log(`  ❌ Dockerfile not found`);
        }
        
        return validation;
    }

    async testDockerImageBuilding() {
        const builds = [];
        
        try {
            const imageName = 'zephis-core-master-test';
            const buildResult = {
                imageName,
                success: false,
                buildTime: 0,
                size: 0
            };
            
            console.log(`  🏗️  Building Docker image: ${imageName}`);
            const startTime = Date.now();
            
            execSync(`docker build -t ${imageName} .`, {
                cwd: PROJECT_ROOT,
                stdio: 'pipe',
                timeout: 600000 // 10 minutes
            });
            
            buildResult.buildTime = Date.now() - startTime;
            buildResult.success = true;
            
            // Get image size
            try {
                const sizeOutput = execSync(`docker images ${imageName} --format "{{.Size}}"`, {
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
                buildResult.size = sizeOutput.trim();
            } catch (sizeError) {
                console.log(`  ⚠️  Could not get image size: ${sizeError.message}`);
            }
            
            console.log(`  ✅ Image built successfully in ${(buildResult.buildTime / 1000).toFixed(2)}s`);
            builds.push(buildResult);
            
        } catch (error) {
            console.log(`  ❌ Image build failed: ${error.message}`);
            builds.push({
                imageName: 'zephis-core-master-test',
                success: false,
                error: error.message
            });
        }
        
        return builds;
    }

    async testContainerExecution() {
        const containerTests = [];
        
        try {
            const imageName = 'zephis-core-master-test';
            
            // Test 1: Basic container run
            const basicTest = {
                name: 'basic_execution',
                success: false,
                output: null
            };
            
            try {
                const output = execSync(`docker run --rm ${imageName} node --version`, {
                    encoding: 'utf8',
                    stdio: 'pipe',
                    timeout: 30000
                });
                
                basicTest.success = true;
                basicTest.output = output.trim();
                console.log(`  ✅ Basic container execution: ${basicTest.output}`);
                
            } catch (error) {
                basicTest.error = error.message;
                console.log(`  ❌ Basic container execution failed`);
            }
            
            containerTests.push(basicTest);
            
            // Test 2: NPM availability
            const npmTest = {
                name: 'npm_availability',
                success: false,
                output: null
            };
            
            try {
                const output = execSync(`docker run --rm ${imageName} npm --version`, {
                    encoding: 'utf8',
                    stdio: 'pipe',
                    timeout: 30000
                });
                
                npmTest.success = true;
                npmTest.output = output.trim();
                console.log(`  ✅ NPM available in container: v${npmTest.output}`);
                
            } catch (error) {
                npmTest.error = error.message;
                console.log(`  ❌ NPM not available in container`);
            }
            
            containerTests.push(npmTest);
            
        } catch (error) {
            console.log(`  ❌ Container tests failed: ${error.message}`);
        }
        
        return containerTests;
    }

    async testCircuitCompilationInDocker() {
        const compilationTest = {
            success: false,
            duration: 0,
            output: null
        };
        
        try {
            const imageName = 'zephis-core-master-test';
            
            console.log(`  🔨 Testing circuit compilation in Docker...`);
            const startTime = Date.now();
            
            const output = execSync(`docker run --rm ${imageName} npm run circuits:compile`, {
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: 300000 // 5 minutes
            });
            
            compilationTest.duration = Date.now() - startTime;
            compilationTest.success = true;
            compilationTest.output = output;
            
            console.log(`  ✅ Circuit compilation successful in ${(compilationTest.duration / 1000).toFixed(2)}s`);
            
        } catch (error) {
            compilationTest.error = error.message;
            console.log(`  ❌ Circuit compilation in Docker failed: ${error.message}`);
        }
        
        return compilationTest;
    }

    async consolidateResults() {
        console.log('\n📊 Consolidating Test Results...\n');
        
        this.results.consolidatedMetrics = {
            overallHealth: 'UNKNOWN',
            totalTests: 0,
            totalPassed: 0,
            totalFailed: 0,
            overallSuccessRate: 0,
            criticalIssues: [],
            recommendations: []
        };

        let totalTests = 0;
        let totalPassed = 0;
        let totalFailed = 0;
        const criticalIssues = [];
        const recommendations = [];

        // Consolidate circuit test results
        if (this.results.testSuites.circuitTests?.status === 'completed') {
            const summary = this.results.testSuites.circuitTests.summary;
            totalTests += summary.totalTests || 0;
            totalPassed += summary.passedTests || 0;
            totalFailed += summary.failedTests || 0;
            
            if (summary.successRate < 95) {
                criticalIssues.push(`Circuit tests have low success rate: ${summary.successRate.toFixed(1)}%`);
                recommendations.push('Review failed circuit tests and fix issues');
            }
        } else if (this.results.testSuites.circuitTests?.status === 'failed') {
            criticalIssues.push('Circuit test suite failed to execute');
            recommendations.push('Fix circuit test suite execution issues');
        }

        // Consolidate build system results
        if (this.results.testSuites.buildSystemTests?.status === 'completed') {
            const summary = this.results.testSuites.buildSystemTests.summary;
            if (summary.successRate < 80) {
                criticalIssues.push(`Build system tests have issues: ${summary.successRate}% success rate`);
                recommendations.push('Fix build system configuration and dependencies');
            }
        }

        // Consolidate security results
        if (this.results.testSuites.securityTests?.status === 'completed') {
            const summary = this.results.testSuites.securityTests.summary;
            if (summary.riskLevel === 'HIGH') {
                criticalIssues.push(`High security risk detected with ${summary.vulnerabilities} vulnerabilities`);
                recommendations.push('Address security vulnerabilities immediately');
            } else if (summary.vulnerabilities > 0) {
                recommendations.push(`Address ${summary.vulnerabilities} security vulnerabilities`);
            }
        }

        // Consolidate performance results
        if (this.results.testSuites.performanceTests?.status === 'completed') {
            const summary = this.results.testSuites.performanceTests.summary;
            if (summary.overallScore < 50) {
                criticalIssues.push(`Performance is below acceptable levels: ${summary.overallScore.toFixed(1)}/100`);
                recommendations.push('Optimize circuit performance and resource usage');
            } else if (summary.bottlenecks > 0) {
                recommendations.push(`Address ${summary.bottlenecks} performance bottlenecks`);
            }
        }

        // Consolidate Docker results
        if (this.results.testSuites.dockerTests?.status === 'failed') {
            criticalIssues.push('Docker integration tests failed');
            recommendations.push('Fix Docker configuration and containerization issues');
        }

        // Calculate overall metrics
        this.results.consolidatedMetrics.totalTests = totalTests;
        this.results.consolidatedMetrics.totalPassed = totalPassed;
        this.results.consolidatedMetrics.totalFailed = totalFailed;
        this.results.consolidatedMetrics.overallSuccessRate = totalTests > 0 ? (totalPassed / totalTests * 100) : 0;
        this.results.consolidatedMetrics.criticalIssues = criticalIssues;
        this.results.consolidatedMetrics.recommendations = recommendations;

        // Determine overall health
        if (criticalIssues.length === 0 && this.results.consolidatedMetrics.overallSuccessRate >= 95) {
            this.results.consolidatedMetrics.overallHealth = 'EXCELLENT';
        } else if (criticalIssues.length <= 1 && this.results.consolidatedMetrics.overallSuccessRate >= 85) {
            this.results.consolidatedMetrics.overallHealth = 'GOOD';
        } else if (criticalIssues.length <= 3 && this.results.consolidatedMetrics.overallSuccessRate >= 70) {
            this.results.consolidatedMetrics.overallHealth = 'FAIR';
        } else {
            this.results.consolidatedMetrics.overallHealth = 'POOR';
        }

        console.log(`📈 Overall Health: ${this.results.consolidatedMetrics.overallHealth}`);
        console.log(`📊 Overall Success Rate: ${this.results.consolidatedMetrics.overallSuccessRate.toFixed(1)}%`);
        console.log(`🚨 Critical Issues: ${criticalIssues.length}`);
        console.log(`💡 Recommendations: ${recommendations.length}\n`);
    }

    async generateMasterReport() {
        console.log('📄 Generating Master Test Report...\n');

        const report = {
            metadata: {
                timestamp: new Date().toISOString(),
                testSuite: 'Master Test Orchestrator',
                version: '1.0.0',
                environment: this.results.overview.environment,
                configuration: this.options
            },
            overview: this.results.overview,
            consolidatedMetrics: this.results.consolidatedMetrics,
            testSuiteResults: this.results.testSuites,
            executionSummary: this.results.executionSummary,
            recommendations: this.generateFinalRecommendations()
        };

        // Save JSON report
        const reportFile = path.join(MASTER_RESULTS_DIR, 'master-test-report.json');
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

        // Generate HTML report
        await this.generateMasterHTMLReport(report);

        // Generate executive summary
        await this.generateExecutiveSummary(report);

        console.log(`✅ Master test report saved to: ${reportFile}`);
        return report;
    }

    generateFinalRecommendations() {
        const finalRecommendations = [];

        // Consolidate recommendations from all test suites
        const allRecommendations = [
            ...this.results.consolidatedMetrics.recommendations,
        ];

        // Add specific recommendations based on overall results
        const health = this.results.consolidatedMetrics.overallHealth;
        
        switch (health) {
            case 'POOR':
                finalRecommendations.push({
                    priority: 'CRITICAL',
                    category: 'overall_health',
                    description: 'System health is poor. Immediate action required to address critical issues.',
                    actions: [
                        'Fix all failed test suites',
                        'Address security vulnerabilities',
                        'Optimize performance bottlenecks',
                        'Review build system configuration'
                    ]
                });
                break;
            case 'FAIR':
                finalRecommendations.push({
                    priority: 'HIGH',
                    category: 'improvement_needed',
                    description: 'System has room for improvement. Address identified issues.',
                    actions: [
                        'Review and fix failing tests',
                        'Implement security best practices',
                        'Optimize critical performance paths'
                    ]
                });
                break;
            case 'GOOD':
                finalRecommendations.push({
                    priority: 'MEDIUM',
                    category: 'maintenance',
                    description: 'System is in good health. Focus on continuous improvement.',
                    actions: [
                        'Monitor performance trends',
                        'Regular security assessments',
                        'Maintain high test coverage'
                    ]
                });
                break;
            case 'EXCELLENT':
                finalRecommendations.push({
                    priority: 'LOW',
                    category: 'optimization',
                    description: 'System is performing excellently. Focus on optimization and innovation.',
                    actions: [
                        'Implement advanced optimizations',
                        'Explore new testing methodologies',
                        'Share best practices with team'
                    ]
                });
                break;
        }

        return finalRecommendations;
    }

    async generateMasterHTMLReport(report) {
        const healthColors = {
            'EXCELLENT': '#28a745',
            'GOOD': '#17a2b8',
            'FAIR': '#ffc107',
            'POOR': '#dc3545',
            'UNKNOWN': '#6c757d'
        };

        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zephis Master Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 3px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .health-indicator { 
            display: inline-block; 
            padding: 10px 20px; 
            border-radius: 25px; 
            color: white; 
            font-weight: bold; 
            background-color: ${healthColors[report.consolidatedMetrics.overallHealth]};
        }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; margin-top: 5px; }
        .section { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
        .section-header { background: #007bff; color: white; padding: 10px 15px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0; }
        .test-suite-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
        .test-suite-card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; }
        .status-completed { border-left: 4px solid #28a745; }
        .status-failed { border-left: 4px solid #dc3545; }
        .status-skipped { border-left: 4px solid #6c757d; }
        .critical-issues { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 15px; margin: 15px 0; }
        .recommendations { background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px; margin: 15px 0; }
        .priority-critical { background: #f8d7da; border-left: 3px solid #dc3545; }
        .priority-high { background: #fff3cd; border-left: 3px solid #ffc107; }
        .priority-medium { background: #d1ecf1; border-left: 3px solid #17a2b8; }
        .priority-low { background: #d4edda; border-left: 3px solid #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎭 Zephis Master Test Report</h1>
            <p>Generated on ${new Date(report.metadata.timestamp).toLocaleString()}</p>
            <div class="health-indicator">
                Overall System Health: ${report.consolidatedMetrics.overallHealth}
            </div>
        </div>

        <div class="summary">
            <div class="stat-card">
                <div class="stat-number">${report.consolidatedMetrics.totalTests}</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${report.consolidatedMetrics.totalPassed}</div>
                <div class="stat-label">Tests Passed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${report.consolidatedMetrics.overallSuccessRate.toFixed(1)}%</div>
                <div class="stat-label">Success Rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${Object.keys(report.testSuiteResults).length}</div>
                <div class="stat-label">Test Suites</div>
            </div>
        </div>

        ${report.consolidatedMetrics.criticalIssues.length > 0 ? `
            <div class="critical-issues">
                <h3>🚨 Critical Issues</h3>
                <ul>
                    ${report.consolidatedMetrics.criticalIssues.map(issue => `<li>${issue}</li>`).join('')}
                </ul>
            </div>
        ` : ''}

        <div class="section">
            <div class="section-header">
                <h2>🧪 Test Suite Results</h2>
            </div>
            <div class="test-suite-grid">
                ${Object.entries(report.testSuiteResults).map(([suiteName, result]) => `
                    <div class="test-suite-card status-${result.status}">
                        <h4>${suiteName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h4>
                        <p><strong>Status:</strong> ${result.status.toUpperCase()}</p>
                        <p><strong>Duration:</strong> ${(result.duration / 1000).toFixed(2)}s</p>
                        ${result.summary ? Object.entries(result.summary).map(([key, value]) => 
                            `<p><strong>${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong> ${value}</p>`
                        ).join('') : ''}
                        ${result.error ? `<p style="color: #dc3545;"><strong>Error:</strong> ${result.error}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="section">
            <div class="section-header">
                <h2>💡 Recommendations</h2>
            </div>
            ${report.recommendations.map(rec => `
                <div class="recommendations priority-${rec.priority.toLowerCase()}">
                    <h4>${rec.category.toUpperCase()} - ${rec.priority} PRIORITY</h4>
                    <p>${rec.description}</p>
                    ${rec.actions ? `
                        <ul>
                            ${rec.actions.map(action => `<li>${action}</li>`).join('')}
                        </ul>
                    ` : ''}
                </div>
            `).join('')}
        </div>

        <div style="margin-top: 40px; text-align: center; color: #666;">
            <p>Generated by Zephis Protocol Master Test Orchestrator</p>
            <p>Environment: ${report.metadata.environment.platform} ${report.metadata.environment.arch}</p>
        </div>
    </div>
</body>
</html>`;

        const htmlFile = path.join(MASTER_RESULTS_DIR, 'master-test-report.html');
        fs.writeFileSync(htmlFile, htmlContent);
        console.log(`✅ Master HTML report saved to: ${htmlFile}`);
    }

    async generateExecutiveSummary(report) {
        const summary = `
ZEPHIS PROTOCOL - EXECUTIVE TEST SUMMARY
═══════════════════════════════════════

Generated: ${new Date(report.metadata.timestamp).toLocaleString()}
Overall Health: ${report.consolidatedMetrics.overallHealth}
Success Rate: ${report.consolidatedMetrics.overallSuccessRate.toFixed(1)}%

TEST EXECUTION SUMMARY
─────────────────────
Total Tests Executed: ${report.consolidatedMetrics.totalTests}
Tests Passed: ${report.consolidatedMetrics.totalPassed}
Tests Failed: ${report.consolidatedMetrics.totalFailed}

TEST SUITES EXECUTED
───────────────────
${Object.entries(report.testSuiteResults).map(([name, result]) => 
    `• ${name}: ${result.status.toUpperCase()} (${(result.duration / 1000).toFixed(2)}s)`
).join('\n')}

${report.consolidatedMetrics.criticalIssues.length > 0 ? `
CRITICAL ISSUES
──────────────
${report.consolidatedMetrics.criticalIssues.map(issue => `⚠️  ${issue}`).join('\n')}
` : '✅ No critical issues detected'}

KEY RECOMMENDATIONS
──────────────────
${report.recommendations.slice(0, 3).map(rec => `• ${rec.description}`).join('\n')}

NEXT STEPS
─────────
${report.consolidatedMetrics.overallHealth === 'EXCELLENT' ? 
    '🎉 System is performing excellently. Continue monitoring and optimization.' :
    report.consolidatedMetrics.overallHealth === 'GOOD' ?
    '👍 System is healthy. Address minor issues and continue regular testing.' :
    report.consolidatedMetrics.overallHealth === 'FAIR' ?
    '⚠️  System needs improvement. Prioritize fixing identified issues.' :
    '🚨 System requires immediate attention. Address critical issues urgently.'
}

For detailed analysis, see: master-test-report.html
        `;

        const summaryFile = path.join(MASTER_RESULTS_DIR, 'executive-summary.txt');
        fs.writeFileSync(summaryFile, summary.trim());
        console.log(`✅ Executive summary saved to: ${summaryFile}`);
    }

    printMasterSummary(duration) {
        console.log('\n' + '═'.repeat(100));
        console.log('🎭 MASTER TEST ORCHESTRATION COMPLETED');
        console.log('═'.repeat(100));
        
        console.log(`⏱️  Total execution time: ${(duration / 1000 / 60).toFixed(2)} minutes`);
        console.log(`🎯 Overall system health: ${this.results.consolidatedMetrics.overallHealth}`);
        console.log(`📊 Overall success rate: ${this.results.consolidatedMetrics.overallSuccessRate.toFixed(1)}%`);
        console.log(`🧪 Test suites executed: ${Object.keys(this.results.testSuites).length}`);
        console.log(`⚠️  Critical issues: ${this.results.consolidatedMetrics.criticalIssues.length}`);
        console.log(`💡 Recommendations: ${this.results.consolidatedMetrics.recommendations.length}`);
        
        console.log(`\n📁 Results directory: ${MASTER_RESULTS_DIR}`);
        console.log(`📄 Detailed report: ${path.join(MASTER_RESULTS_DIR, 'master-test-report.html')}`);
        console.log(`📋 Executive summary: ${path.join(MASTER_RESULTS_DIR, 'executive-summary.txt')}`);
        
        console.log('\n' + '═'.repeat(100));
        
        // Final status message
        const health = this.results.consolidatedMetrics.overallHealth;
        if (health === 'EXCELLENT' || health === 'GOOD') {
            console.log('🎊 Test execution completed successfully!');
            console.log('✅ System is healthy and ready for production.');
        } else if (health === 'FAIR') {
            console.log('⚠️  Test execution completed with some issues.');
            console.log('📋 Review recommendations and address identified problems.');
        } else {
            console.log('🚨 Test execution revealed critical issues.');
            console.log('❌ System requires immediate attention before deployment.');
        }
        
        console.log('═'.repeat(100));
        
        // Exit with appropriate code
        process.exit(health === 'POOR' || this.results.consolidatedMetrics.criticalIssues.length > 5 ? 1 : 0);
    }
}

// CLI argument parsing
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--no-circuit-tests':
                options.runCircuitTests = false;
                break;
            case '--no-build-tests':
                options.runBuildTests = false;
                break;
            case '--no-security-tests':
                options.runSecurityTests = false;
                break;
            case '--no-performance-tests':
                options.runPerformanceTests = false;
                break;
            case '--no-docker-tests':
                options.runDockerTests = false;
                break;
            case '--parallel':
                options.parallel = true;
                break;
            case '--verbose':
                options.verbose = true;
                break;
            case '--help':
                console.log(`
Zephis Master Test Orchestrator

Usage: node master-test-orchestrator.js [options]

Options:
  --no-circuit-tests     Skip circuit unit tests
  --no-build-tests       Skip build system integration tests
  --no-security-tests    Skip security vulnerability tests
  --no-performance-tests Skip performance benchmarking
  --no-docker-tests      Skip Docker integration tests
  --parallel            Run test suites in parallel (when possible)
  --verbose             Enable verbose output
  --help                Show this help message

Examples:
  node master-test-orchestrator.js                    # Run all tests
  node master-test-orchestrator.js --parallel         # Run tests in parallel
  node master-test-orchestrator.js --no-docker-tests  # Skip Docker tests
                `);
                process.exit(0);
        }
    }
    
    return options;
}

// CLI execution
if (require.main === module) {
    const options = parseArgs();
    const orchestrator = new MasterTestOrchestrator(options);
    
    orchestrator.runAllTests().catch(error => {
        console.error('💥 Master test orchestration crashed:', error);
        process.exit(1);
    });
}

module.exports = { MasterTestOrchestrator };