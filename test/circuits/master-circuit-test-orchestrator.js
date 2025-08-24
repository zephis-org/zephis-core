#!/usr/bin/env node

/**
 * Master Circuit Test Orchestrator
 * 
 * Comprehensive testing orchestrator that runs all circuit testing suites:
 * 1. Comprehensive circuit testing with all test vectors
 * 2. Constraint analysis and performance benchmarking
 * 3. Security testing with malicious inputs and boundary conditions
 * 4. Build system and integration testing
 * 5. Generates unified comprehensive report with actionable recommendations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import test suites
const { ComprehensiveCircuitTester } = require('./comprehensive-circuit-tests');
const { CircuitConstraintAnalyzer } = require('./circuit-constraint-analyzer');
const { CircuitSecurityTester } = require('./circuit-security-tester');
const { BuildSystemIntegrationTester } = require('./build-system-integration-tests');

const MASTER_RESULTS_DIR = path.join(__dirname, 'master-results');
const CIRCUITS_DIR = path.join(__dirname, '..', '..', 'circuits');

class MasterCircuitTestOrchestrator {
    constructor() {
        this.results = {
            metadata: {
                startTime: new Date().toISOString(),
                endTime: null,
                duration: 0,
                environment: {
                    node: process.version,
                    platform: process.platform,
                    arch: process.arch,
                    cwd: process.cwd()
                }
            },
            summary: {
                totalTestSuites: 4,
                completedSuites: 0,
                failedSuites: 0,
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                criticalIssues: 0,
                warnings: 0,
                overallScore: 0
            },
            suiteResults: {
                comprehensive: null,
                constraints: null,
                security: null,
                buildIntegration: null
            },
            aggregatedFindings: {
                criticalIssues: [],
                securityVulnerabilities: [],
                performanceBottlenecks: [],
                buildSystemIssues: [],
                integrationProblems: []
            },
            recommendations: {
                immediate: [],
                shortTerm: [],
                longTerm: []
            },
            circuitReadiness: {
                overall: 'unknown',
                individual: {}
            }
        };

        this.createMasterResultsDir();
    }

    createMasterResultsDir() {
        if (!fs.existsSync(MASTER_RESULTS_DIR)) {
            fs.mkdirSync(MASTER_RESULTS_DIR, { recursive: true });
        }
    }

    async orchestrateAllTests() {
        console.log('🚀 MASTER CIRCUIT TESTING ORCHESTRATOR');
        console.log('=' .repeat(80));
        console.log('Comprehensive testing of all circuit components and integration workflows');
        console.log('=' .repeat(80));

        const startTime = Date.now();

        try {
            // Pre-flight checks
            console.log('\n🔍 Pre-flight System Checks');
            await this.performPreflightChecks();

            // Phase 1: Comprehensive Circuit Testing
            console.log('\n📋 Phase 1: Comprehensive Circuit Testing');
            await this.runComprehensiveTests();

            // Phase 2: Constraint Analysis and Performance Benchmarking
            console.log('\n📊 Phase 2: Constraint Analysis & Performance Benchmarking');
            await this.runConstraintAnalysis();

            // Phase 3: Security Testing
            console.log('\n🛡️  Phase 3: Security Testing');
            await this.runSecurityTests();

            // Phase 4: Build System and Integration Testing
            console.log('\n🔧 Phase 4: Build System & Integration Testing');
            await this.runBuildIntegrationTests();

            // Phase 5: Results Analysis and Report Generation
            console.log('\n📄 Phase 5: Results Analysis & Report Generation');
            await this.analyzeResults();
            await this.generateMasterReport();

            // Phase 6: Final Summary and Recommendations
            console.log('\n🎯 Phase 6: Final Analysis & Recommendations');
            this.printMasterSummary();
            this.generateActionableRecommendations();

            this.results.metadata.endTime = new Date().toISOString();
            this.results.metadata.duration = Date.now() - startTime;

            console.log('\n🎉 Master Circuit Testing Complete!');
            console.log(`Total Duration: ${(this.results.metadata.duration / 1000).toFixed(1)} seconds`);

            return this.results;

        } catch (error) {
            this.results.metadata.endTime = new Date().toISOString();
            this.results.metadata.duration = Date.now() - startTime;
            
            console.error('\n❌ Master testing orchestration failed:', error.message);
            console.error('Stack trace:', error.stack);
            
            await this.generateErrorReport(error);
            throw error;
        }
    }

    async performPreflightChecks() {
        console.log('  🔧 Checking system requirements...');

        const checks = [
            {
                name: 'Node.js version',
                check: () => {
                    const version = parseInt(process.version.substring(1).split('.')[0]);
                    return version >= 18;
                },
                message: 'Node.js >= 18.0.0 required'
            },
            {
                name: 'Circuits directory',
                check: () => fs.existsSync(CIRCUITS_DIR),
                message: 'Circuits directory must exist'
            },
            {
                name: 'Package.json',
                check: () => fs.existsSync(path.join(__dirname, '..', '..', 'package.json')),
                message: 'Package.json must exist for dependency validation'
            },
            {
                name: 'Build scripts',
                check: () => {
                    const scriptsDir = path.join(__dirname, '..', '..', 'scripts');
                    return fs.existsSync(scriptsDir) && 
                           fs.existsSync(path.join(scriptsDir, 'compile-circuits.js'));
                },
                message: 'Build scripts must be available'
            }
        ];

        let allChecksPassed = true;

        for (const check of checks) {
            const passed = check.check();
            console.log(`    ${passed ? '✓' : '❌'} ${check.name}`);
            
            if (!passed) {
                console.log(`      ${check.message}`);
                allChecksPassed = false;
            }
        }

        if (!allChecksPassed) {
            throw new Error('Pre-flight checks failed. Please resolve the issues above before continuing.');
        }

        console.log('  ✅ All pre-flight checks passed');
    }

    async runComprehensiveTests() {
        console.log('  🧪 Running comprehensive circuit test suite...');
        
        try {
            const comprehensiveTester = new ComprehensiveCircuitTester();
            await comprehensiveTester.runComprehensiveTests();
            
            this.results.suiteResults.comprehensive = {
                status: 'completed',
                results: comprehensiveTester.results,
                duration: 'N/A' // Will be extracted if available
            };
            
            this.results.summary.completedSuites++;
            this.updateOverallStats(comprehensiveTester.results.summary);
            
            console.log('    ✅ Comprehensive testing completed');
            
        } catch (error) {
            console.log('    ❌ Comprehensive testing failed');
            this.results.suiteResults.comprehensive = {
                status: 'failed',
                error: error.message
            };
            this.results.summary.failedSuites++;
        }
    }

    async runConstraintAnalysis() {
        console.log('  📊 Running constraint analysis and performance benchmarking...');
        
        try {
            const constraintAnalyzer = new CircuitConstraintAnalyzer();
            await constraintAnalyzer.analyzeAllCircuits();
            
            this.results.suiteResults.constraints = {
                status: 'completed',
                results: constraintAnalyzer.results
            };
            
            this.results.summary.completedSuites++;
            console.log('    ✅ Constraint analysis completed');
            
        } catch (error) {
            console.log('    ❌ Constraint analysis failed');
            this.results.suiteResults.constraints = {
                status: 'failed',
                error: error.message
            };
            this.results.summary.failedSuites++;
        }
    }

    async runSecurityTests() {
        console.log('  🛡️  Running security testing suite...');
        
        try {
            const securityTester = new CircuitSecurityTester();
            await securityTester.runSecurityTests();
            
            this.results.suiteResults.security = {
                status: 'completed',
                results: securityTester.results
            };
            
            this.results.summary.completedSuites++;
            this.updateOverallStats(securityTester.results.summary);
            
            // Extract security vulnerabilities
            const vulnerabilities = Object.values(securityTester.results.circuits)
                .flatMap(circuit => circuit.vulnerabilities || []);
            this.results.aggregatedFindings.securityVulnerabilities = vulnerabilities;
            
            console.log('    ✅ Security testing completed');
            
        } catch (error) {
            console.log('    ❌ Security testing failed');
            this.results.suiteResults.security = {
                status: 'failed',
                error: error.message
            };
            this.results.summary.failedSuites++;
        }
    }

    async runBuildIntegrationTests() {
        console.log('  🔧 Running build system and integration tests...');
        
        try {
            const buildTester = new BuildSystemIntegrationTester();
            await buildTester.runBuildSystemAndIntegrationTests();
            
            this.results.suiteResults.buildIntegration = {
                status: 'completed',
                results: buildTester.results
            };
            
            this.results.summary.completedSuites++;
            this.updateOverallStats(buildTester.results.summary);
            
            console.log('    ✅ Build and integration testing completed');
            
        } catch (error) {
            console.log('    ❌ Build and integration testing failed');
            this.results.suiteResults.buildIntegration = {
                status: 'failed',
                error: error.message
            };
            this.results.summary.failedSuites++;
        }
    }

    updateOverallStats(suiteStats) {
        if (suiteStats) {
            this.results.summary.totalTests += suiteStats.totalTests || 0;
            this.results.summary.passedTests += suiteStats.passed || 0;
            this.results.summary.failedTests += suiteStats.failed || 0;
            this.results.summary.criticalIssues += suiteStats.criticalIssues || 0;
            this.results.summary.warnings += suiteStats.warnings || 0;
        }
    }

    async analyzeResults() {
        console.log('  🔍 Analyzing aggregated test results...');
        
        // Analyze circuit readiness
        this.analyzeCircuitReadiness();
        
        // Extract performance bottlenecks
        this.extractPerformanceBottlenecks();
        
        // Extract build system issues
        this.extractBuildSystemIssues();
        
        // Extract integration problems
        this.extractIntegrationProblems();
        
        // Calculate overall score
        this.calculateOverallScore();
        
        console.log('    ✅ Results analysis completed');
    }

    analyzeCircuitReadiness() {
        const circuits = ['generic_proof', 'balance_proof', 'follower_proof', 'dynamic_comparator', 'template_validator'];
        
        for (const circuit of circuits) {
            let readiness = 'ready';
            let issues = [];
            
            // Check comprehensive test results
            const comprehensiveResults = this.results.suiteResults.comprehensive?.results?.circuits?.[circuit];
            if (comprehensiveResults) {
                const passed = comprehensiveResults.testVectors?.filter(v => v.passed).length || 0;
                const total = comprehensiveResults.testVectors?.length || 0;
                
                if (total === 0) {
                    readiness = 'not_tested';
                    issues.push('No test vectors executed');
                } else if (passed / total < 0.8) {
                    readiness = 'needs_work';
                    issues.push(`Low test pass rate: ${passed}/${total}`);
                }
            }
            
            // Check security results
            const securityResults = this.results.suiteResults.security?.results?.circuits?.[circuit];
            if (securityResults && securityResults.vulnerabilities?.length > 0) {
                const criticalVulns = securityResults.vulnerabilities.filter(v => v.severity === 'HIGH' || v.severity === 'CRITICAL');
                if (criticalVulns.length > 0) {
                    readiness = 'security_issues';
                    issues.push(`${criticalVulns.length} critical security issues`);
                }
            }
            
            // Check performance
            const constraintResults = this.results.suiteResults.constraints?.results?.[circuit];
            if (constraintResults?.constraints?.complexity?.level === 'very_high') {
                if (readiness === 'ready') readiness = 'performance_concerns';
                issues.push('Very high constraint complexity');
            }
            
            this.results.circuitReadiness.individual[circuit] = {
                status: readiness,
                issues: issues
            };
        }
        
        // Calculate overall readiness
        const individualStatuses = Object.values(this.results.circuitReadiness.individual);
        const criticalIssues = individualStatuses.filter(s => 
            s.status === 'security_issues' || s.status === 'not_tested'
        ).length;
        
        if (criticalIssues > 0) {
            this.results.circuitReadiness.overall = 'not_ready';
        } else {
            const needsWork = individualStatuses.filter(s => 
                s.status === 'needs_work' || s.status === 'performance_concerns'
            ).length;
            
            if (needsWork > individualStatuses.length * 0.3) {
                this.results.circuitReadiness.overall = 'needs_improvement';
            } else {
                this.results.circuitReadiness.overall = 'ready';
            }
        }
    }

    extractPerformanceBottlenecks() {
        const constraintResults = this.results.suiteResults.constraints?.results;
        
        if (constraintResults) {
            for (const [circuit, analysis] of Object.entries(constraintResults)) {
                if (analysis.constraints?.constraints > 50000) {
                    this.results.aggregatedFindings.performanceBottlenecks.push({
                        circuit: circuit,
                        issue: 'High constraint count',
                        value: analysis.constraints.constraints,
                        recommendation: 'Consider optimizing circuit logic'
                    });
                }
                
                if (analysis.performance?.averageWitnessTime > 5000) {
                    this.results.aggregatedFindings.performanceBottlenecks.push({
                        circuit: circuit,
                        issue: 'Slow witness generation',
                        value: `${analysis.performance.averageWitnessTime}ms`,
                        recommendation: 'Optimize computational complexity'
                    });
                }
            }
        }
    }

    extractBuildSystemIssues() {
        const buildResults = this.results.suiteResults.buildIntegration?.results?.buildSystem;
        
        if (buildResults) {
            for (const [test, result] of Object.entries(buildResults)) {
                if (!result.passed) {
                    this.results.aggregatedFindings.buildSystemIssues.push({
                        test: test,
                        issue: result.error || 'Test failed',
                        recommendation: 'Fix build system configuration'
                    });
                }
                
                if (result.warnings?.length > 0) {
                    result.warnings.forEach(warning => {
                        this.results.aggregatedFindings.buildSystemIssues.push({
                            test: test,
                            issue: warning,
                            recommendation: 'Address build system warning'
                        });
                    });
                }
            }
        }
    }

    extractIntegrationProblems() {
        const integrationResults = this.results.suiteResults.buildIntegration?.results?.integration;
        
        if (integrationResults) {
            for (const [test, result] of Object.entries(integrationResults)) {
                if (!result.passed) {
                    this.results.aggregatedFindings.integrationProblems.push({
                        component: test,
                        issue: result.error || 'Integration test failed',
                        recommendation: 'Fix component integration'
                    });
                }
            }
        }
    }

    calculateOverallScore() {
        const totalTests = this.results.summary.totalTests;
        const passedTests = this.results.summary.passedTests;
        const criticalIssues = this.results.summary.criticalIssues;
        
        if (totalTests === 0) {
            this.results.summary.overallScore = 0;
            return;
        }
        
        // Base score from test pass rate
        let score = (passedTests / totalTests) * 100;
        
        // Penalties for critical issues
        const criticalPenalty = Math.min(criticalIssues * 10, 50);
        score -= criticalPenalty;
        
        // Bonus for completing all test suites
        if (this.results.summary.completedSuites === this.results.summary.totalTestSuites) {
            score += 5;
        }
        
        this.results.summary.overallScore = Math.max(0, Math.min(100, score));
    }

    async generateMasterReport() {
        console.log('  📄 Generating comprehensive master report...');
        
        const report = {
            metadata: this.results.metadata,
            executiveSummary: this.generateExecutiveSummary(),
            detailedResults: {
                summary: this.results.summary,
                suiteResults: this.results.suiteResults,
                circuitReadiness: this.results.circuitReadiness,
                aggregatedFindings: this.results.aggregatedFindings
            },
            recommendations: this.results.recommendations,
            actionPlan: this.generateActionPlan(),
            appendices: {
                environmentInfo: this.results.metadata.environment,
                testConfiguration: this.generateTestConfiguration()
            }
        };
        
        // Save JSON report
        const reportPath = path.join(MASTER_RESULTS_DIR, 'master-circuit-test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        // Generate markdown summary
        const markdownReport = this.generateMarkdownReport(report);
        const markdownPath = path.join(MASTER_RESULTS_DIR, 'CIRCUIT_TEST_SUMMARY.md');
        fs.writeFileSync(markdownPath, markdownReport);
        
        // Generate executive summary
        const executiveSummaryPath = path.join(MASTER_RESULTS_DIR, 'EXECUTIVE_SUMMARY.md');
        fs.writeFileSync(executiveSummaryPath, this.generateExecutiveSummaryMarkdown());
        
        console.log(`    ✅ Master report generated:`);
        console.log(`      • JSON Report: ${reportPath}`);
        console.log(`      • Markdown Summary: ${markdownPath}`);
        console.log(`      • Executive Summary: ${executiveSummaryPath}`);
    }

    generateExecutiveSummary() {
        const readiness = this.results.circuitReadiness.overall;
        const score = this.results.summary.overallScore;
        const completedSuites = this.results.summary.completedSuites;
        const totalSuites = this.results.summary.totalTestSuites;
        
        return {
            overallReadiness: readiness,
            overallScore: score,
            suitesCompleted: `${completedSuites}/${totalSuites}`,
            keyFindings: this.generateKeyFindings(),
            immediateActions: this.results.recommendations.immediate.slice(0, 3),
            recommendedTimeline: this.generateTimeline()
        };
    }

    generateKeyFindings() {
        const findings = [];
        
        // Circuit readiness findings
        const readyCircuits = Object.entries(this.results.circuitReadiness.individual)
            .filter(([_, status]) => status.status === 'ready').length;
        const totalCircuits = Object.keys(this.results.circuitReadiness.individual).length;
        
        findings.push(`Circuit Readiness: ${readyCircuits}/${totalCircuits} circuits production-ready`);
        
        // Security findings
        const criticalVulns = this.results.aggregatedFindings.securityVulnerabilities
            .filter(v => v.severity === 'HIGH' || v.severity === 'CRITICAL').length;
        
        findings.push(`Security: ${criticalVulns} critical security issues identified`);
        
        // Performance findings
        const perfBottlenecks = this.results.aggregatedFindings.performanceBottlenecks.length;
        findings.push(`Performance: ${perfBottlenecks} performance bottlenecks detected`);
        
        // Build system findings
        const buildIssues = this.results.aggregatedFindings.buildSystemIssues.length;
        findings.push(`Build System: ${buildIssues} build and integration issues found`);
        
        return findings;
    }

    generateTimeline() {
        const readiness = this.results.circuitReadiness.overall;
        const criticalIssues = this.results.summary.criticalIssues;
        
        if (readiness === 'not_ready' || criticalIssues > 5) {
            return 'Significant work required - 4-6 weeks to production readiness';
        } else if (readiness === 'needs_improvement' || criticalIssues > 0) {
            return 'Minor improvements needed - 2-3 weeks to production readiness';
        } else {
            return 'Production ready - can deploy with current state';
        }
    }

    generateActionPlan() {
        const plan = {
            immediate: [],
            shortTerm: [],
            longTerm: [],
            ongoing: []
        };
        
        // Immediate actions (critical issues)
        if (this.results.summary.criticalIssues > 0) {
            plan.immediate.push('Address all critical security vulnerabilities');
        }
        
        if (this.results.aggregatedFindings.buildSystemIssues.length > 0) {
            plan.immediate.push('Fix build system and integration issues');
        }
        
        // Short term actions
        if (this.results.aggregatedFindings.performanceBottlenecks.length > 0) {
            plan.shortTerm.push('Optimize circuit performance bottlenecks');
        }
        
        plan.shortTerm.push('Implement comprehensive CI/CD pipeline');
        plan.shortTerm.push('Add formal circuit verification');
        
        // Long term actions
        plan.longTerm.push('Implement advanced security monitoring');
        plan.longTerm.push('Optimize for production scalability');
        plan.longTerm.push('Develop circuit upgrade mechanisms');
        
        // Ongoing actions
        plan.ongoing.push('Run comprehensive test suite on every build');
        plan.ongoing.push('Monitor performance metrics in production');
        plan.ongoing.push('Regular security audits');
        
        return plan;
    }

    generateTestConfiguration() {
        return {
            testSuites: [
                { name: 'Comprehensive Circuit Tests', description: 'Full circuit functionality testing' },
                { name: 'Constraint Analysis', description: 'Performance and complexity analysis' },
                { name: 'Security Testing', description: 'Security vulnerability assessment' },
                { name: 'Build Integration', description: 'Build system and integration testing' }
            ],
            circuits: ['generic_proof', 'balance_proof', 'follower_proof', 'dynamic_comparator', 'template_validator'],
            environment: this.results.metadata.environment
        };
    }

    generateMarkdownReport(report) {
        const sections = [
            '# ZEPHIS Circuit Testing - Comprehensive Report',
            '',
            `**Generated:** ${report.metadata.startTime}`,
            `**Duration:** ${(report.metadata.duration / 1000).toFixed(1)} seconds`,
            `**Overall Score:** ${report.executiveSummary.overallScore.toFixed(1)}%`,
            `**Circuit Readiness:** ${report.executiveSummary.overallReadiness}`,
            '',
            '## Executive Summary',
            '',
            '### Key Findings',
            report.executiveSummary.keyFindings.map(finding => `- ${finding}`).join('\n'),
            '',
            '### Test Suite Results',
            `- **Completed Test Suites:** ${report.executiveSummary.suitesCompleted}`,
            `- **Total Tests:** ${report.detailedResults.summary.totalTests}`,
            `- **Passed:** ${report.detailedResults.summary.passedTests}`,
            `- **Failed:** ${report.detailedResults.summary.failedTests}`,
            `- **Critical Issues:** ${report.detailedResults.summary.criticalIssues}`,
            '',
            '## Circuit Readiness Assessment',
            '',
            Object.entries(report.detailedResults.circuitReadiness.individual)
                .map(([circuit, status]) => 
                    `- **${circuit}:** ${status.status}${status.issues.length > 0 ? ` (${status.issues.join(', ')})` : ''}`
                ).join('\n'),
            '',
            '## Critical Issues',
            '',
            '### Security Vulnerabilities',
            report.detailedResults.aggregatedFindings.securityVulnerabilities.length > 0 
                ? report.detailedResults.aggregatedFindings.securityVulnerabilities
                    .map(vuln => `- **${vuln.circuit}:** ${vuln.name} (${vuln.severity})`)
                    .join('\n')
                : '- No critical security vulnerabilities found',
            '',
            '### Performance Bottlenecks',
            report.detailedResults.aggregatedFindings.performanceBottlenecks.length > 0
                ? report.detailedResults.aggregatedFindings.performanceBottlenecks
                    .map(perf => `- **${perf.circuit}:** ${perf.issue} (${perf.value})`)
                    .join('\n')
                : '- No significant performance bottlenecks found',
            '',
            '## Immediate Action Items',
            '',
            report.recommendations.immediate.length > 0
                ? report.recommendations.immediate
                    .map(rec => `- ${rec.recommendation || rec}`)
                    .join('\n')
                : '- No immediate actions required',
            '',
            '## Recommended Timeline',
            `${report.executiveSummary.recommendedTimeline}`,
            '',
            '---',
            '*Report generated by ZEPHIS Master Circuit Test Orchestrator*'
        ];
        
        return sections.join('\n');
    }

    generateExecutiveSummaryMarkdown() {
        const readiness = this.results.circuitReadiness.overall;
        const score = this.results.summary.overallScore;
        
        return `# ZEPHIS Circuit Testing - Executive Summary

## Overall Assessment

**Circuit Readiness:** ${readiness.toUpperCase()}
**Test Score:** ${score.toFixed(1)}%
**Recommendation:** ${this.generateTimeline()}

## Key Metrics

- **Test Suites Completed:** ${this.results.summary.completedSuites}/${this.results.summary.totalTestSuites}
- **Total Tests Executed:** ${this.results.summary.totalTests}
- **Success Rate:** ${((this.results.summary.passedTests / this.results.summary.totalTests) * 100).toFixed(1)}%
- **Critical Issues:** ${this.results.summary.criticalIssues}
- **Security Vulnerabilities:** ${this.results.aggregatedFindings.securityVulnerabilities.length}
- **Performance Issues:** ${this.results.aggregatedFindings.performanceBottlenecks.length}

## Circuit Status

${Object.entries(this.results.circuitReadiness.individual)
  .map(([circuit, status]) => `- **${circuit}:** ${status.status}`)
  .join('\n')}

## Next Steps

${this.generateActionPlan().immediate.length > 0 
  ? '### Immediate Actions Required\n' + this.generateActionPlan().immediate.map(action => `- ${action}`).join('\n')
  : '### No Immediate Actions Required'
}

${this.generateActionPlan().shortTerm.length > 0
  ? '\n### Short Term (2-4 weeks)\n' + this.generateActionPlan().shortTerm.map(action => `- ${action}`).join('\n')
  : ''
}

---
*Generated: ${new Date().toISOString()}*
`;
    }

    generateActionableRecommendations() {
        console.log('\n💡 ACTIONABLE RECOMMENDATIONS');
        console.log('=' .repeat(50));

        // Immediate actions
        const immediateActions = [];
        
        if (this.results.summary.criticalIssues > 0) {
            immediateActions.push('🚨 CRITICAL: Address security vulnerabilities immediately');
        }
        
        if (this.results.aggregatedFindings.buildSystemIssues.length > 0) {
            immediateActions.push('🔧 Fix build system issues to enable reliable deployment');
        }
        
        if (this.results.circuitReadiness.overall === 'not_ready') {
            immediateActions.push('⚠️  Circuits not ready for production - complete testing first');
        }

        this.results.recommendations.immediate = immediateActions;

        if (immediateActions.length > 0) {
            console.log('\n🚨 IMMEDIATE ACTIONS REQUIRED:');
            immediateActions.forEach(action => console.log(`   ${action}`));
        } else {
            console.log('\n✅ No critical issues requiring immediate attention');
        }

        // Short term recommendations
        const shortTermActions = [
            '📊 Implement continuous performance monitoring',
            '🔐 Add automated security testing to CI/CD',
            '📋 Create circuit upgrade and migration procedures',
            '🧪 Expand test coverage for edge cases'
        ];

        this.results.recommendations.shortTerm = shortTermActions;

        console.log('\n📅 SHORT TERM RECOMMENDATIONS (2-4 weeks):');
        shortTermActions.forEach(action => console.log(`   ${action}`));

        // Long term recommendations
        const longTermActions = [
            '🏗️  Implement formal circuit verification',
            '⚡ Optimize circuit constraints for better performance',
            '🔄 Set up automated circuit regression testing',
            '📈 Implement production performance monitoring'
        ];

        this.results.recommendations.longTerm = longTermActions;

        console.log('\n🎯 LONG TERM GOALS (1-3 months):');
        longTermActions.forEach(action => console.log(`   ${action}`));
    }

    printMasterSummary() {
        console.log('\n' + '='.repeat(80));
        console.log('🎯 MASTER CIRCUIT TESTING SUMMARY');
        console.log('='.repeat(80));

        console.log(`\n📊 Overall Results:`);
        console.log(`   • Test Suites Completed: ${this.results.summary.completedSuites}/${this.results.summary.totalTestSuites}`);
        console.log(`   • Total Tests: ${this.results.summary.totalTests}`);
        console.log(`   • Passed: ${this.results.summary.passedTests}`);
        console.log(`   • Failed: ${this.results.summary.failedTests}`);
        console.log(`   • Critical Issues: ${this.results.summary.criticalIssues}`);
        console.log(`   • Overall Score: ${this.results.summary.overallScore.toFixed(1)}%`);

        console.log(`\n🚀 Circuit Readiness:`);
        console.log(`   • Overall Status: ${this.results.circuitReadiness.overall.toUpperCase()}`);
        
        Object.entries(this.results.circuitReadiness.individual).forEach(([circuit, status]) => {
            const statusIcon = status.status === 'ready' ? '✅' : 
                              status.status.includes('security') ? '🚨' :
                              status.status.includes('performance') ? '⚡' : '⚠️ ';
            console.log(`   • ${circuit}: ${statusIcon} ${status.status}`);
        });

        console.log(`\n📋 Test Suite Results:`);
        Object.entries(this.results.suiteResults).forEach(([suite, result]) => {
            const status = result.status === 'completed' ? '✅' : 
                          result.status === 'failed' ? '❌' : '⚠️ ';
            console.log(`   ${status} ${suite}: ${result.status}`);
        });

        if (this.results.aggregatedFindings.securityVulnerabilities.length > 0) {
            console.log(`\n🛡️  Security Issues:`);
            console.log(`   • Critical Vulnerabilities: ${this.results.aggregatedFindings.securityVulnerabilities.filter(v => v.severity === 'HIGH' || v.severity === 'CRITICAL').length}`);
            console.log(`   • Total Security Issues: ${this.results.aggregatedFindings.securityVulnerabilities.length}`);
        }

        if (this.results.aggregatedFindings.performanceBottlenecks.length > 0) {
            console.log(`\n⚡ Performance Issues:`);
            console.log(`   • Performance Bottlenecks: ${this.results.aggregatedFindings.performanceBottlenecks.length}`);
        }

        console.log(`\n⏱️  Recommended Timeline:`);
        console.log(`   ${this.generateTimeline()}`);

        console.log('\n' + '='.repeat(80));
    }

    async generateErrorReport(error) {
        const errorReport = {
            timestamp: new Date().toISOString(),
            error: {
                message: error.message,
                stack: error.stack
            },
            partialResults: this.results,
            environment: this.results.metadata.environment
        };

        const errorReportPath = path.join(MASTER_RESULTS_DIR, 'error-report.json');
        fs.writeFileSync(errorReportPath, JSON.stringify(errorReport, null, 2));

        console.log(`\n📄 Error report saved to: ${errorReportPath}`);
    }
}

// Main execution
if (require.main === module) {
    const orchestrator = new MasterCircuitTestOrchestrator();
    
    orchestrator.orchestrateAllTests()
        .then((results) => {
            const success = results.circuitReadiness.overall !== 'not_ready' && 
                           results.summary.criticalIssues === 0;
            
            console.log(`\n🏁 Testing orchestration complete!`);
            console.log(`Exit code: ${success ? 0 : 1}`);
            
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('\n💥 Master orchestration failed catastrophically');
            process.exit(1);
        });
}

module.exports = { MasterCircuitTestOrchestrator };