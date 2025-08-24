![ZEPHIS Cover](assets/cover.webp)

**ZEPHIS** (Zero Exposure Proof Handling Isolated Sessions) Core is the TypeScript/Node.js library that provides the foundational components for intercepting TLS sessions, generating zero-knowledge proofs, and managing cryptographic commitments. This library handles the off-chain operations that feed into the on-chain verification contracts.

## 🚀 Quick Start

```bash
git clone https://github.com/zephis-org/zephis-core.git
cd zephis-core
npm install
npm run build
npm test
```

## 💻 Basic Usage

```typescript
import { ZephisCore } from '@zephis/core';

// Initialize ZEPHIS Core
const zephis = new ZephisCore();

// Start TLS interception
await zephis.startTLSInterception('example.com', 443);

// Generate handshake proof
const handshakeProof = await zephis.generateHandshakeProof();

// Generate session key commitment
const keyCommitment = await zephis.generateKeyCommitment();

// Generate transcript proof
const transcriptProof = await zephis.generateTranscriptProof();

// Bundle proofs for on-chain submission
const proofBundle = await zephis.bundleProofs([
  handshakeProof,
  keyCommitment,
  transcriptProof
]);

// Submit to blockchain
const result = await zephis.submitToChain(proofBundle);
```

## ✨ Core Features

- **TLS Interception**: Real-time TLS handshake capture and session key extraction
- **Zero-Knowledge Proof Generation**: Groth16 proof generation for handshake, session keys, and transcript data
- **Cryptographic Commitments**: Poseidon hash-based commitments for session keys and transcript integrity
- **Merkle Tree Construction**: Efficient transcript hashing with Merkle proof generation
- **Proof Bundling**: Batch proof creation for gas-efficient on-chain submission
- **Chain Integration**: Direct blockchain submission with viem integration
- **Modular Architecture**: Independent components for testing and customization

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- handshake-circuit.test.ts

# Run tests in watch mode
npm test -- --watch
```

## 📖 Documentation

For detailed documentation and advanced features, visit:
- [Official Documentation](https://zephis.org/docs)

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📬 Contact

Zephis Team - [https://zephis.org](https://zephis.org)

Project Link: [https://github.com/zephis-org/zephis-core](https://github.com/zephis-org/zephis-core)
