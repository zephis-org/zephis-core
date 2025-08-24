# Zephis Circuit Testing Framework

A comprehensive testing framework for zero-knowledge circuits in the Zephis Protocol, providing extensive testing capabilities for circuit unit testing, security validation, performance benchmarking, and integration testing.

## 🎯 Overview

This testing framework provides comprehensive coverage of all circuit components in the Zephis Protocol:

- **Circuit Unit Testing**: Extensive test vectors for all circuit components
- **Security Testing**: Vulnerability assessment and attack vector testing  
- **Performance Benchmarking**: Performance analysis and optimization recommendations
- **Build System Testing**: Integration testing of compilation and setup processes
- **Docker Testing**: Containerized environment testing
- **Master Orchestration**: Coordinated execution of all test suites

## 📁 Framework Structure

```
test/circuits/
├── master-test-orchestrator.js          # Main entry point for all testing
├── comprehensive-circuit-test-suite.js  # Circuit unit testing framework
├── security-test-suite.js               # Security vulnerability testing
├── performance-benchmark-suite.js       # Performance benchmarking
├── build-system-integration-test-suite.js # Build system testing
├── circuit-constraint-analyzer.js       # Constraint analysis tools
├── circuit-security-tester.js          # Security testing tools
├── master-circuit-test-orchestrator.js # Test coordination
└── README.md                           # This documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Circom 2.0+
- SnarkJS 0.7+
- Docker (optional, for container testing)

### Installation

The testing framework is included with the Zephis Core project. Ensure all dependencies are installed:

```bash
npm install
```

### Basic Usage

Run all tests with the master orchestrator:

```bash
# Run complete test suite
node test/circuits/master-test-orchestrator.js

# Run with parallel execution (faster)
node test/circuits/master-test-orchestrator.js --parallel

# Run specific test suites only
node test/circuits/master-test-orchestrator.js --no-performance-tests --no-docker-tests

# Get help
node test/circuits/master-test-orchestrator.js --help
```

### Individual Test Suites

Run individual test suites for focused testing:

```bash
# Circuit unit tests
node test/circuits/comprehensive-circuit-test-suite.js

# Security tests
node test/circuits/security-test-suite.js

# Performance benchmarks
node test/circuits/performance-benchmark-suite.js

# Build system tests
node test/circuits/build-system-integration-test-suite.js
```

## 🧪 Test Suites

### 1. Comprehensive Circuit Tests

Tests all circuit components with extensive test vectors:

- **Generic Proof Circuit**: All claim types, data types, edge cases
- **Dynamic Comparator**: All comparison operations (GT, LT, EQ, Contains, Range, NEQ)
- **Template Validator**: Hash validation, domain authorization, timestamp checks
- **Integration Testing**: Circuit-to-circuit communication
- **Constraint Testing**: Constraint satisfaction and witness generation

**Key Features:**
- Comprehensive test vector generation
- Boundary condition testing
- Constraint satisfaction verification
- Witness generation validation
- Integration testing between circuits

**Example:**
```bash
node test/circuits/comprehensive-circuit-test-suite.js
```

### 2. Security Testing Suite

Comprehensive security assessment with attack vector testing:

- **Attack Vectors**: Overflow, underflow, timestamp manipulation, constraint bypass
- **Data Leakage**: Detection of information leakage from private inputs
- **Timing Attacks**: Analysis of execution time variations
- **Constraint Bypass**: Attempts to circumvent security constraints
- **Fuzzing**: Random input testing for vulnerability discovery

**Security Test Categories:**
- Malicious input resistance
- Constraint enforcement
- Data privacy protection
- Timing attack resistance
- Boundary condition security

**Example:**
```bash
node test/circuits/security-test-suite.js
```

### 3. Performance Benchmarking

Performance analysis and optimization recommendations:

- **Witness Generation**: Execution time benchmarking
- **Constraint Analysis**: Constraint count and complexity analysis
- **Memory Profiling**: Memory usage and leak detection
- **Scalability Testing**: Performance across different input sizes
- **Resource Utilization**: CPU and memory efficiency analysis

**Benchmark Categories:**
- Execution time measurements
- Memory usage profiling
- Constraint complexity analysis
- Scalability assessment
- Resource efficiency evaluation

**Example:**
```bash
node test/circuits/performance-benchmark-suite.js
```

### 4. Build System Integration

Testing of the circuit build pipeline and dependencies:

- **Compilation Testing**: Circuit compilation with error scenarios
- **Setup Process**: Trusted setup and key generation testing
- **Validation Scripts**: Build artifact validation
- **Dependency Management**: Package integrity and version compatibility
- **Docker Integration**: Containerized build testing

**Build Test Categories:**
- Compilation process validation
- Error handling and recovery
- Dependency resolution
- Artifact generation verification
- Container environment testing

**Example:**
```bash
node test/circuits/build-system-integration-test-suite.js
```

## 📊 Test Results and Reporting

### Report Generation

Each test suite generates comprehensive reports:

- **JSON Reports**: Machine-readable detailed results
- **HTML Reports**: Human-readable interactive reports
- **Executive Summaries**: High-level status and recommendations
- **Master Reports**: Consolidated results from all test suites

### Report Locations

```
test/circuits/
├── test-results/                    # Circuit test results
├── security-test-results/          # Security test results
├── performance-benchmarks/         # Performance benchmark results
├── build-test-results/             # Build system test results
└── master-test-results/            # Consolidated master results
```

### Key Metrics

The framework tracks and reports on:

- **Test Coverage**: Number of tests executed and passed
- **Security Risk Level**: Overall security assessment (LOW/MEDIUM/HIGH)
- **Performance Scores**: Circuit performance ratings
- **Build Health**: Build system integrity status
- **Overall Health**: Consolidated system health assessment

## 🔧 Configuration

### Test Configuration

Configure test execution through command-line options:

```bash
# Master orchestrator options
--no-circuit-tests      # Skip circuit unit tests
--no-build-tests        # Skip build system tests  
--no-security-tests     # Skip security vulnerability tests
--no-performance-tests  # Skip performance benchmarks
--no-docker-tests       # Skip Docker integration tests
--parallel              # Enable parallel test execution
--verbose               # Enable verbose output
```

### Environment Variables

Set environment-specific configurations:

```bash
export NODE_ENV=test
export ZEPHIS_TEST_TIMEOUT=300000    # 5 minute timeout
export ZEPHIS_TEST_PARALLEL=true     # Enable parallel execution
export ZEPHIS_TEST_VERBOSE=false     # Verbose logging
```

## 📈 Performance Targets

The framework uses the following performance targets:

### Circuit Performance Targets

| Circuit | Max Witness Time | Max Memory | Max Constraints |
|---------|------------------|------------|-----------------|
| generic_proof | 5000ms | 1GB | 50,000 |
| dynamic_comparator | 2000ms | 500MB | 8,000 |
| template_validator | 3000ms | 512MB | 6,000 |

### Success Criteria

- **Test Success Rate**: ≥95%
- **Security Risk Level**: LOW
- **Performance Score**: ≥70/100
- **Build Success Rate**: ≥90%

## 🛡️ Security Testing

### Attack Vectors Tested

The security suite tests resistance to:

1. **Overflow Attacks**: Integer and array overflow attempts
2. **Underflow Attacks**: Negative value injection
3. **Timestamp Manipulation**: Time-based attack vectors
4. **Constraint Bypass**: Attempts to circumvent security constraints
5. **Data Length Bypass**: Array bounds manipulation
6. **Pattern Injection**: Malicious pattern insertion
7. **Hash Collisions**: Hash function attack attempts
8. **Domain Spoofing**: Unauthorized domain access

### Security Assessment

Security risk levels:
- **LOW**: No vulnerabilities detected, all attacks blocked
- **MEDIUM**: Minor vulnerabilities, some attacks partially successful
- **HIGH**: Critical vulnerabilities, multiple successful attacks

## 🏗️ Circuit Architecture Testing

### Circuits Tested

1. **GenericDataProof**: Main proof generation circuit
   - Multiple claim types (GT, LT, EQ, Contains)
   - Dynamic input sizing
   - TLS session integration

2. **DynamicComparator**: Flexible comparison operations
   - All comparison operations
   - Pattern matching
   - Range validation

3. **TemplateValidator**: Template authenticity verification
   - Hash validation
   - Domain authorization
   - Timestamp verification

### Test Vector Categories

- **Valid Claims**: Expected successful proof generation
- **Invalid Claims**: Expected failures and rejections
- **Boundary Conditions**: Edge cases and limits
- **Security Attacks**: Malicious input attempts
- **Integration Scenarios**: Multi-circuit workflows

## 🐳 Docker Integration

### Container Testing

The framework tests circuit compilation and execution in containerized environments:

- **Image Building**: Docker image compilation
- **Container Execution**: Runtime environment validation
- **Circuit Compilation**: In-container circuit building
- **Resource Constraints**: Memory and CPU limits testing

### Docker Test Scenarios

1. **Basic Container**: Node.js runtime validation
2. **Dependency Installation**: NPM package installation
3. **Circuit Compilation**: Full build process in container
4. **Resource Usage**: Memory and CPU monitoring

## 📋 Best Practices

### Test Development

1. **Comprehensive Coverage**: Test all code paths and edge cases
2. **Realistic Test Data**: Use production-like test vectors
3. **Security Focus**: Always include security test cases
4. **Performance Awareness**: Monitor and benchmark performance
5. **Documentation**: Document test purposes and expectations

### Test Execution

1. **Regular Testing**: Run tests frequently during development
2. **CI/CD Integration**: Automate testing in build pipelines
3. **Environment Isolation**: Use clean environments for testing
4. **Result Analysis**: Review and act on test results
5. **Regression Testing**: Maintain baseline performance metrics

## 🔍 Troubleshooting

### Common Issues

1. **Circom Not Found**
   ```bash
   # Install Circom globally
   npm install -g circom
   
   # Or use local installation
   npx circom --version
   ```

2. **Memory Issues**
   ```bash
   # Increase Node.js memory limit
   node --max-old-space-size=8192 test/circuits/master-test-orchestrator.js
   ```

3. **Docker Permission Issues**
   ```bash
   # Add user to docker group (Linux)
   sudo usermod -aG docker $USER
   
   # Or run with sudo
   sudo node test/circuits/master-test-orchestrator.js
   ```

4. **Timeout Issues**
   ```bash
   # Increase timeout for large circuits
   export ZEPHIS_TEST_TIMEOUT=600000  # 10 minutes
   ```

### Debug Mode

Enable verbose logging for debugging:

```bash
node test/circuits/master-test-orchestrator.js --verbose
```

### Log Analysis

Check log files for detailed error information:
```bash
# Check test logs
cat test/circuits/*/logs/*.log

# Check system logs
journalctl -u zephis-test
```

## 📚 API Reference

### Master Test Orchestrator

```javascript
const { MasterTestOrchestrator } = require('./master-test-orchestrator');

const orchestrator = new MasterTestOrchestrator({
    runCircuitTests: true,
    runBuildTests: true,
    runSecurityTests: true,
    runPerformanceTests: true,
    runDockerTests: false,
    parallel: true,
    verbose: false
});

orchestrator.runAllTests().then(results => {
    console.log('Overall Health:', results.consolidatedMetrics.overallHealth);
    console.log('Success Rate:', results.consolidatedMetrics.overallSuccessRate);
});
```

### Individual Test Suites

```javascript
// Circuit Testing
const { ComprehensiveCircuitTester } = require('./comprehensive-circuit-test-suite');
const circuitTester = new ComprehensiveCircuitTester();
circuitTester.runAllTests();

// Security Testing
const { SecurityTestSuite } = require('./security-test-suite');
const securityTester = new SecurityTestSuite();
securityTester.runAllSecurityTests();

// Performance Benchmarking
const { PerformanceBenchmarkSuite } = require('./performance-benchmark-suite');
const performanceTester = new PerformanceBenchmarkSuite();
performanceTester.runAllBenchmarks();
```

## 🤝 Contributing

### Adding New Tests

1. **Create Test Vectors**: Add comprehensive test cases
2. **Implement Test Logic**: Write test execution code
3. **Add Documentation**: Document test purpose and expectations
4. **Update Configuration**: Add configuration options if needed
5. **Test Integration**: Ensure integration with master orchestrator

### Test Structure

```javascript
// Example test structure
class NewTestSuite {
    constructor() {
        this.results = {};
        this.setupTestEnvironment();
    }

    async runAllTests() {
        // Test implementation
    }

    async generateReport() {
        // Report generation
    }
}
```

## 📜 License

This testing framework is part of the Zephis Protocol and follows the same licensing terms as the main project.

## 🆘 Support

For issues or questions about the testing framework:

1. Check the troubleshooting section above
2. Review test logs and error messages
3. Create an issue in the project repository
4. Contact the development team

---

**Note**: This testing framework is designed to provide comprehensive validation of the Zephis Protocol circuits. Regular execution of these tests is essential for maintaining system reliability, security, and performance.