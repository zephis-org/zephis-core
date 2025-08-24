# ZEPHIS Core ZK Circuits

This directory contains the zero-knowledge circuits for the ZEPHIS protocol, designed to enable privacy-preserving proofs of data claims extracted from TLS sessions.

## Overview

The ZEPHIS circuits support template-agnostic proof generation for various types of data claims:

- **Currency/Balance verification** (account balance greater than threshold)
- **Social metrics** (follower count, engagement rates)
- **Account verification** (age, status, badges)
- **Pattern matching** (data contains specific patterns)
- **Range verification** (values within specified ranges)

## Circuit Architecture

### Core Components

1. **`generic_proof.circom`** - Main template-agnostic circuit
   - Supports dynamic input sizing
   - Handles multiple claim types (gt, lt, eq, contains, range)
   - Validates template authenticity and domain binding
   - Includes timestamp verification for freshness

2. **`dynamic_comparator.circom`** - Flexible comparison logic
   - Supports 6 comparison types: GT, LT, EQ, Contains, Range, NEQ
   - Handles variable data lengths
   - Pattern matching for substring/text searches
   - Numeric extraction from byte arrays

3. **`template_validator.circom`** - Template hash validation
   - Ensures template authenticity
   - Domain authorization checking  
   - Validity period enforcement
   - Multi-party template registry support

### Specialized Templates

- **`BalanceProof`** - Optimized for financial balance checks
- **`FollowerProof`** - Social media metrics verification
- **`SocialMediaTemplateValidator`** - Domain-specific template validation
- **`FinancialTemplateValidator`** - Enhanced security for financial data

## Circuit Parameters

| Circuit | Max Data Length | Max TLS Length | Use Case |
|---------|----------------|----------------|----------|
| `generic_proof` | 64 bytes | 1024 bytes | General purpose |
| `balance_proof` | 32 bytes | 1024 bytes | Financial data |
| `follower_proof` | 16 bytes | 512 bytes | Social metrics |
| `dynamic_comparator` | 64 bytes | - | Comparison logic |
| `template_validator` | - | - | Template validation |

## Build System

### Prerequisites

```bash
# Install Circom compiler
npm install -g circom

# Or use local installation
npm install
```

### Build Commands

```bash
# Compile all circuits
npm run circuits:compile

# Generate trusted setup (zkeys and verification keys)
npm run circuits:setup

# Run circuit tests
npm run circuits:test

# Clean build artifacts
npm run circuits:clean

# Full build pipeline
npm run build:circuits
```

### Build Process

1. **Compilation**: Circom compiles `.circom` files to R1CS, WASM, and symbols
2. **Trusted Setup**: Generates proving keys (zkey) and verification keys
3. **Testing**: Validates circuits with test vectors
4. **Docker Integration**: Builds are included in Docker containers

## File Structure

```
circuits/
├── README.md                     # This file
├── manifest.json                 # Circuit build manifest
├── ceremony-info.json           # Trusted setup information
├── generic_proof.circom         # Main circuit template
├── dynamic_comparator.circom    # Comparison logic
├── template_validator.circom    # Template validation
├── generic_proof.wasm           # Compiled WASM files
├── generic_proof_final.zkey     # Proving keys
├── verification_key.json        # Verification key
├── build/                       # Build artifacts
│   ├── generic_proof/
│   │   ├── generic_proof.r1cs
│   │   ├── generic_proof.sym
│   │   └── generic_proof_js/
│   └── circuit-info.json
└── setup/                      # Trusted setup files
    └── powersOfTau28_hez_final_15.ptau
```

## Security Considerations

### Trusted Setup

The current setup is suitable for **development and testing** only. For production deployment:

1. Use a proper multi-party trusted setup ceremony
2. Verify ceremony transcripts and contributions
3. Use independently generated Powers of Tau parameters
4. Implement key rotation mechanisms

### Circuit Security

- **Template Validation**: All templates must be cryptographically verified
- **Domain Binding**: Templates are bound to specific domains
- **Timestamp Validation**: Proofs include freshness guarantees
- **Input Validation**: All inputs are constrained within valid ranges
- **Hash Integrity**: TLS session data is cryptographically verified

## Usage Examples

### Basic Proof Generation

```javascript
import { ProofGenerator } from '@zephis/core';

const generator = new ProofGenerator();

// Generate balance proof
const proof = await generator.generateProof(
    sessionId,
    'bank.example.com',
    'balanceGreaterThan',
    extractedData,
    tlsSessionData
);

// Verify proof
const isValid = await generator.verifyProof(proof);
```

### Circuit Input Format

```json
{
  "extracted_data": [/* 64-byte array */],
  "tls_session_data": [/* 1024-byte array */],
  "data_length": 8,
  "tls_length": 100,
  "template_hash": 12345,
  "claim_type": 1,
  "threshold_value": 1000,
  "domain_hash": 67890,
  "timestamp_min": 1640995200,
  "timestamp_max": 1641081600
}
```

### Supported Claim Types

| Type | Value | Description | Example |
|------|--------|------------|---------|
| GT | 1 | Greater than | Balance > $1000 |
| LT | 2 | Less than | Age < 65 |
| EQ | 3 | Equal to | Status = "verified" |
| Contains | 4 | Pattern match | Bio contains "engineer" |
| Range | 5 | Within range | Followers 1K-10K |
| NEQ | 6 | Not equal | Type ≠ "bot" |

## Performance

### Constraint Counts (Estimated)

- `generic_proof`: ~50K constraints
- `balance_proof`: ~30K constraints  
- `follower_proof`: ~25K constraints
- `dynamic_comparator`: ~15K constraints
- `template_validator`: ~20K constraints

### Proof Generation Times

- **Witness Generation**: 100-500ms
- **Proof Generation**: 2-10 seconds (depends on circuit size)
- **Verification**: 10-50ms

## Testing

### Test Vectors

The test suite includes:
- Valid input scenarios for each circuit
- Invalid input edge cases
- Performance benchmarks
- Cross-circuit compatibility tests

### Running Tests

```bash
# Run all circuit tests
npm run circuits:test

# Test specific circuit
node scripts/test-circuits.js generic_proof

# Generate benchmarks
npm run circuits:test -- --benchmark
```

## Docker Integration

### Build Configuration

The Docker build process:
1. Installs Circom and dependencies
2. Compiles all circuits
3. Generates trusted setup (development keys)
4. Runs circuit tests
5. Bundles WASM and keys for runtime

### Volume Mounting

```yaml
volumes:
  - ../circuits:/app/circuits:ro
  - circuit-build-cache:/app/circuits/build
```

### Environment Variables

- `CIRCUIT_BUILD_TIMEOUT`: Build timeout (default: 300s)
- `SKIP_CIRCUIT_SETUP`: Skip trusted setup (for faster builds)
- `CIRCUIT_TEST_ENABLED`: Run tests during build

## Development

### Adding New Circuits

1. Create new `.circom` file
2. Add to `scripts/compile-circuits.js` configuration
3. Create test vectors in `scripts/test-circuits.js`
4. Update manifest and documentation

### Circuit Design Guidelines

- **Modularity**: Use reusable components
- **Efficiency**: Minimize constraint count
- **Security**: Validate all inputs
- **Compatibility**: Follow naming conventions
- **Documentation**: Comment complex logic

### Debugging

- Use `console.log` in circuits for debugging
- Generate and inspect witness files
- Verify constraint satisfaction
- Test with edge case inputs

## Integration with ZEPHIS Core

### Circuit Loader

```typescript
const circuitLoader = new CircuitLoader();
const config = await circuitLoader.loadCircuit('generic_proof');
```

### Proof Generation

```typescript
const proof = await proofGenerator.generateProof(
    sessionId,
    template,
    claim,
    extractedData,
    tlsData
);
```

### Verification

```typescript
const isValid = await proofGenerator.verifyProof(proof);
```

## Troubleshooting

### Common Issues

1. **Compilation Errors**
   - Check Circom version compatibility
   - Verify include paths
   - Review circuit syntax

2. **Setup Failures**
   - Ensure sufficient disk space (>1GB)
   - Check network connectivity for Powers of Tau download
   - Verify file permissions

3. **Test Failures**
   - Check input data format
   - Verify constraint satisfaction
   - Review witness generation logs

### Support

For issues with circuits:
1. Check build logs in `circuits/build/`
2. Review test reports in `test/circuits/`
3. Validate setup with `npm run circuits:test`
4. Consult ZEPHIS core documentation

## License

This code is part of the ZEPHIS Protocol and is licensed under MIT License. See the project root for license details.