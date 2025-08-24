#!/usr/bin/env node

/**
 * Circuit Constraint Analyzer
 * 
 * This module provides detailed constraint analysis for circuits:
 * 1. Constraint counting and complexity analysis
 * 2. Critical path analysis
 * 3. Memory usage profiling
 * 4. Circuit optimization recommendations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CIRCUITS_DIR = path.join(__dirname, '..', '..', 'circuits');
const BUILD_DIR = path.join(CIRCUITS_DIR, 'build');
const ANALYSIS_DIR = path.join(__dirname, 'analysis');

class CircuitConstraintAnalyzer {
    constructor() {
        this.results = {};
        this.createAnalysisDir();
    }

    createAnalysisDir() {
        if (!fs.existsSync(ANALYSIS_DIR)) {
            fs.mkdirSync(ANALYSIS_DIR, { recursive: true });
        }
    }

    async analyzeAllCircuits() {
        console.log('🔍 Starting Circuit Constraint Analysis\n');

        const circuits = [
            'generic_proof',
            'balance_proof', 
            'follower_proof',
            'dynamic_comparator',
            'template_validator'
        ];

        for (const circuitName of circuits) {
            console.log(`\n📊 Analyzing ${circuitName}...`);
            
            try {
                const analysis = await this.analyzeCircuit(circuitName);
                this.results[circuitName] = analysis;
                this.printCircuitAnalysis(circuitName, analysis);
            } catch (error) {
                console.error(`❌ Failed to analyze ${circuitName}: ${error.message}`);
                this.results[circuitName] = { error: error.message };
            }
        }

        await this.generateAnalysisReport();
        this.printOverallAnalysis();
    }

    async analyzeCircuit(circuitName) {
        const analysis = {
            name: circuitName,
            files: this.checkCircuitFiles(circuitName),
            constraints: null,
            witnesses: null,
            performance: null,
            optimization: []
        };

        // Analyze R1CS if available
        if (analysis.files.r1cs.exists) {
            analysis.constraints = this.analyzeR1CS(circuitName);
        }

        // Analyze WASM if available
        if (analysis.files.wasm.exists) {
            analysis.performance = await this.analyzePerformance(circuitName);
        }

        // Generate optimization recommendations
        analysis.optimization = this.generateOptimizationRecommendations(analysis);

        return analysis;
    }

    checkCircuitFiles(circuitName) {
        const files = {
            circom: {
                path: path.join(CIRCUITS_DIR, `${circuitName}.circom`),
                exists: false,
                size: 0
            },
            r1cs: {
                path: path.join(BUILD_DIR, circuitName, `${circuitName}.r1cs`),
                exists: false,
                size: 0
            },
            wasm: {
                path: path.join(CIRCUITS_DIR, `${circuitName}.wasm`),
                exists: false,
                size: 0
            },
            zkey: {
                path: path.join(CIRCUITS_DIR, `${circuitName}_final.zkey`),
                exists: false,
                size: 0
            }
        };

        // Check if files exist and get sizes
        for (const [type, file] of Object.entries(files)) {
            if (fs.existsSync(file.path)) {
                file.exists = true;
                file.size = fs.statSync(file.path).size;
            }
        }

        return files;
    }

    analyzeR1CS(circuitName) {
        const r1csPath = path.join(BUILD_DIR, circuitName, `${circuitName}.r1cs`);
        
        if (!fs.existsSync(r1csPath)) {
            return null;
        }

        try {
            // Use snarkjs to get R1CS info
            const snarkjs = this.getSnarkjsPath();
            const infoCmd = `${snarkjs} r1cs info "${r1csPath}"`;
            const output = execSync(infoCmd, { stdio: 'pipe', encoding: 'utf8' });
            
            return this.parseR1CSInfo(output);
        } catch (error) {
            return {
                error: 'Failed to analyze R1CS',
                details: error.message
            };
        }
    }

    parseR1CSInfo(output) {
        const info = {
            constraints: 0,
            publicSignals: 0,
            privateSignals: 0,
            wires: 0,
            labels: 0
        };

        const lines = output.split('\n');
        for (const line of lines) {
            if (line.includes('# of Constraints:')) {
                info.constraints = parseInt(line.match(/\d+/)?.[0] || '0');
            } else if (line.includes('# of Private Inputs:')) {
                info.privateSignals = parseInt(line.match(/\d+/)?.[0] || '0');
            } else if (line.includes('# of Public Inputs:')) {
                info.publicSignals = parseInt(line.match(/\d+/)?.[0] || '0');
            } else if (line.includes('# of Wires:')) {
                info.wires = parseInt(line.match(/\d+/)?.[0] || '0');
            }
        }

        // Calculate additional metrics
        info.totalSignals = info.publicSignals + info.privateSignals;
        info.constraintDensity = info.constraints / Math.max(info.wires, 1);
        info.complexity = this.calculateComplexity(info);

        return info;
    }

    calculateComplexity(constraintInfo) {
        const { constraints, wires, totalSignals } = constraintInfo;
        
        // Simple complexity score based on constraints and circuit size
        let complexity = 'low';
        
        if (constraints > 50000 || wires > 100000) {
            complexity = 'very_high';
        } else if (constraints > 25000 || wires > 50000) {
            complexity = 'high';
        } else if (constraints > 10000 || wires > 25000) {
            complexity = 'medium';
        }

        return {
            level: complexity,
            score: Math.log2(constraints + wires + totalSignals),
            constraints,
            wires,
            totalSignals
        };
    }

    async analyzePerformance(circuitName) {
        const wasmPath = path.join(CIRCUITS_DIR, `${circuitName}.wasm`);
        
        if (!fs.existsSync(wasmPath)) {
            return null;
        }

        try {
            // Generate test input for performance testing
            const testInput = this.generatePerformanceTestInput(circuitName);
            const inputFile = path.join(ANALYSIS_DIR, `${circuitName}_perf_input.json`);
            const witnessFile = path.join(ANALYSIS_DIR, `${circuitName}_perf_witness.wtns`);
            
            fs.writeFileSync(inputFile, JSON.stringify(testInput, null, 2));

            // Measure witness generation time
            const iterations = 5;
            const times = [];
            const snarkjs = this.getSnarkjsPath();

            for (let i = 0; i < iterations; i++) {
                const startTime = Date.now();
                const cmd = `${snarkjs} wtns calculate "${wasmPath}" "${inputFile}" "${witnessFile}"`;
                execSync(cmd, { stdio: 'pipe' });
                times.push(Date.now() - startTime);
            }

            const performance = {
                averageWitnessTime: times.reduce((a, b) => a + b, 0) / times.length,
                minWitnessTime: Math.min(...times),
                maxWitnessTime: Math.max(...times),
                iterations: iterations,
                wasmSize: fs.statSync(wasmPath).size,
                witnessSize: fs.existsSync(witnessFile) ? fs.statSync(witnessFile).size : 0
            };

            // Clean up
            [inputFile, witnessFile].forEach(file => {
                if (fs.existsSync(file)) fs.unlinkSync(file);
            });

            return performance;

        } catch (error) {
            return {
                error: 'Performance analysis failed',
                details: error.message
            };
        }
    }

    generatePerformanceTestInput(circuitName) {
        // Generate appropriate test inputs for each circuit type
        const generators = {
            'generic_proof': () => ({
                extracted_data: Array(64).fill(0).map((_, i) => i % 256),
                tls_session_data: Array(1024).fill(0).map((_, i) => i % 256),
                data_length: 32,
                tls_length: 512,
                template_hash: 12345,
                claim_type: 1,
                threshold_value: 1000,
                domain_hash: 67890,
                timestamp_min: Math.floor(Date.now() / 1000) - 3600,
                timestamp_max: Math.floor(Date.now() / 1000) + 3600
            }),
            
            'balance_proof': () => ({
                extracted_data: Array(32).fill(0).map((_, i) => i % 256),
                tls_session_data: Array(1024).fill(0).map((_, i) => i % 256),
                data_length: 16,
                tls_length: 256,
                template_hash: 12345,
                threshold_value: 1000,
                domain_hash: 67890,
                timestamp_min: Math.floor(Date.now() / 1000) - 3600,
                timestamp_max: Math.floor(Date.now() / 1000) + 3600
            }),
            
            'follower_proof': () => ({
                extracted_data: Array(16).fill(0).map((_, i) => i % 256),
                tls_session_data: Array(512).fill(0).map((_, i) => i % 256),
                data_length: 8,
                tls_length: 128,
                template_hash: 12345,
                threshold_value: 1000,
                domain_hash: 67890,
                timestamp_min: Math.floor(Date.now() / 1000) - 3600,
                timestamp_max: Math.floor(Date.now() / 1000) + 3600
            }),
            
            'dynamic_comparator': () => ({
                claim_type: 1,
                threshold: 1000,
                threshold_max: 5000,
                data: Array(64).fill(0).map((_, i) => i % 256),
                data_length: 32,
                pattern: Array(32).fill(0),
                pattern_length: 0
            }),
            
            'template_validator': () => ({
                template_hash: 0,
                domain_hash: 12345,
                timestamp: Math.floor(Date.now() / 1000),
                template_id: 1,
                template_version: 1,
                authorized_domains: Array(16).fill(0).map((_, i) => i < 3 ? i + 1000 : 0),
                domain_count: 3,
                valid_from: Math.floor(Date.now() / 1000) - 86400,
                valid_until: Math.floor(Date.now() / 1000) + 86400,
                template_data: Array(64).fill(0).map((_, i) => i % 256),
                template_data_length: 32
            })
        };

        const generator = generators[circuitName];
        return generator ? generator() : {};
    }

    generateOptimizationRecommendations(analysis) {
        const recommendations = [];

        // Check constraint count
        if (analysis.constraints?.constraints > 100000) {
            recommendations.push({
                type: 'constraint_optimization',
                severity: 'high',
                issue: 'Very high constraint count',
                suggestion: 'Consider using lookup tables or reducing computation complexity',
                currentValue: analysis.constraints.constraints,
                targetValue: '< 50000'
            });
        }

        // Check performance
        if (analysis.performance?.averageWitnessTime > 10000) {
            recommendations.push({
                type: 'performance_optimization',
                severity: 'medium',
                issue: 'Slow witness generation',
                suggestion: 'Optimize circuit logic or use more efficient operations',
                currentValue: `${analysis.performance.averageWitnessTime}ms`,
                targetValue: '< 5000ms'
            });
        }

        // Check file sizes
        if (analysis.files.wasm.size > 5 * 1024 * 1024) { // 5MB
            recommendations.push({
                type: 'size_optimization',
                severity: 'medium',
                issue: 'Large WASM file size',
                suggestion: 'Consider reducing circuit complexity or using more efficient templates',
                currentValue: `${(analysis.files.wasm.size / (1024 * 1024)).toFixed(1)}MB`,
                targetValue: '< 2MB'
            });
        }

        // Check constraint density
        if (analysis.constraints?.constraintDensity < 0.1) {
            recommendations.push({
                type: 'efficiency_optimization',
                severity: 'low',
                issue: 'Low constraint density',
                suggestion: 'Circuit may have unused wires or inefficient signal routing',
                currentValue: analysis.constraints.constraintDensity.toFixed(3),
                targetValue: '> 0.2'
            });
        }

        return recommendations;
    }

    getSnarkjsPath() {
        try {
            execSync('snarkjs --version', { stdio: 'pipe' });
            return 'snarkjs';
        } catch (error) {
            const localPath = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'snarkjs');
            if (fs.existsSync(localPath)) {
                return localPath;
            }
            throw new Error('SnarkJS not found');
        }
    }

    printCircuitAnalysis(circuitName, analysis) {
        console.log(`  📈 ${circuitName} Analysis:`);
        
        if (analysis.constraints) {
            console.log(`    • Constraints: ${analysis.constraints.constraints.toLocaleString()}`);
            console.log(`    • Wires: ${analysis.constraints.wires.toLocaleString()}`);
            console.log(`    • Signals: ${analysis.constraints.totalSignals}`);
            console.log(`    • Complexity: ${analysis.constraints.complexity.level}`);
        }
        
        if (analysis.performance) {
            console.log(`    • Avg Witness Time: ${analysis.performance.averageWitnessTime}ms`);
            console.log(`    • WASM Size: ${(analysis.performance.wasmSize / (1024 * 1024)).toFixed(2)}MB`);
        }
        
        if (analysis.optimization.length > 0) {
            console.log(`    • Optimizations: ${analysis.optimization.length} recommendations`);
        }
    }

    async generateAnalysisReport() {
        const report = {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            circuits: this.results,
            summary: this.generateSummary(),
            recommendations: this.aggregateRecommendations()
        };

        const reportPath = path.join(ANALYSIS_DIR, 'constraint-analysis-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log(`\n✓ Analysis report saved to: ${reportPath}`);
        return report;
    }

    generateSummary() {
        const circuits = Object.values(this.results).filter(r => !r.error);
        
        return {
            totalCircuits: Object.keys(this.results).length,
            analyzedCircuits: circuits.length,
            totalConstraints: circuits.reduce((sum, c) => sum + (c.constraints?.constraints || 0), 0),
            averageConstraints: circuits.length > 0 ? 
                circuits.reduce((sum, c) => sum + (c.constraints?.constraints || 0), 0) / circuits.length : 0,
            complexityDistribution: this.calculateComplexityDistribution(circuits),
            performanceStats: this.calculatePerformanceStats(circuits)
        };
    }

    calculateComplexityDistribution(circuits) {
        const distribution = { low: 0, medium: 0, high: 0, very_high: 0 };
        
        circuits.forEach(circuit => {
            const complexity = circuit.constraints?.complexity?.level;
            if (complexity && distribution.hasOwnProperty(complexity)) {
                distribution[complexity]++;
            }
        });
        
        return distribution;
    }

    calculatePerformanceStats(circuits) {
        const performances = circuits
            .map(c => c.performance?.averageWitnessTime)
            .filter(p => p !== undefined && p !== null);

        if (performances.length === 0) {
            return { average: 0, min: 0, max: 0, count: 0 };
        }

        return {
            average: performances.reduce((sum, p) => sum + p, 0) / performances.length,
            min: Math.min(...performances),
            max: Math.max(...performances),
            count: performances.length
        };
    }

    aggregateRecommendations() {
        const allRecommendations = [];
        
        for (const [circuitName, analysis] of Object.entries(this.results)) {
            if (analysis.optimization) {
                analysis.optimization.forEach(rec => {
                    allRecommendations.push({
                        circuit: circuitName,
                        ...rec
                    });
                });
            }
        }

        // Group by severity
        const grouped = {
            high: allRecommendations.filter(r => r.severity === 'high'),
            medium: allRecommendations.filter(r => r.severity === 'medium'),
            low: allRecommendations.filter(r => r.severity === 'low')
        };

        return {
            total: allRecommendations.length,
            high: grouped.high.length,
            medium: grouped.medium.length,
            low: grouped.low.length,
            recommendations: grouped
        };
    }

    printOverallAnalysis() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 OVERALL CONSTRAINT ANALYSIS SUMMARY');
        console.log('='.repeat(60));

        const summary = this.generateSummary();

        console.log(`\n📈 Circuit Statistics:`);
        console.log(`  • Total Circuits: ${summary.totalCircuits}`);
        console.log(`  • Successfully Analyzed: ${summary.analyzedCircuits}`);
        console.log(`  • Total Constraints: ${summary.totalConstraints.toLocaleString()}`);
        console.log(`  • Average Constraints: ${Math.round(summary.averageConstraints).toLocaleString()}`);

        console.log(`\n🎯 Complexity Distribution:`);
        Object.entries(summary.complexityDistribution).forEach(([level, count]) => {
            if (count > 0) {
                console.log(`  • ${level}: ${count} circuits`);
            }
        });

        if (summary.performanceStats.count > 0) {
            console.log(`\n⚡ Performance Statistics:`);
            console.log(`  • Average Witness Time: ${Math.round(summary.performanceStats.average)}ms`);
            console.log(`  • Fastest Circuit: ${Math.round(summary.performanceStats.min)}ms`);
            console.log(`  • Slowest Circuit: ${Math.round(summary.performanceStats.max)}ms`);
        }

        const recommendations = this.aggregateRecommendations();
        console.log(`\n💡 Optimization Opportunities:`);
        console.log(`  • High Priority: ${recommendations.high}`);
        console.log(`  • Medium Priority: ${recommendations.medium}`);
        console.log(`  • Low Priority: ${recommendations.low}`);

        console.log('\n' + '='.repeat(60));
    }
}

// Main execution
if (require.main === module) {
    const analyzer = new CircuitConstraintAnalyzer();
    
    analyzer.analyzeAllCircuits()
        .then(() => {
            console.log('\n🎉 Circuit constraint analysis completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Circuit constraint analysis failed:', error.message);
            process.exit(1);
        });
}

module.exports = { CircuitConstraintAnalyzer };