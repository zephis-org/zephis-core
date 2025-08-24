![ZEPHIS Cover](assets/intro.webp)

ZEPHIS is an open-source zkTLS framework that generates cryptographic proofs of TLS sessions, enabling users to prove web interactions without revealing sensitive data.

[![npm version](https://badge.fury.io/js/@zephis%2Fcore.svg)](https://badge.fury.io/js/@zephis%2Fcore)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
npm install @zephis/core
```

## Basic Usage

```typescript
import { Zephis } from '@zephis/core';

const zephis = new Zephis({
  apiUrl: 'http://localhost:3000'
});

// Create an isolated browser session
const session = await zephis.createSession();

// Generate proof of web interaction
const proof = await session.generateProof({
  template: 'chase-bank',
  claim: 'balanceGreaterThan',
  params: { amount: 1000 }
});
```

## Core Features

- **Zero Exposure Login**: Users manually enter credentials in isolated browser sessions
- **Ephemeral Containers**: Self-destructing Docker containers for maximum security
- **Template-Based Extraction**: Easy website integration via JSON templates
- **ZK Proof Generation**: Generate zero-knowledge proofs from TLS session data
- **Multi-Chain Support**: Works with Ethereum, Polygon, Arbitrum, Optimism, and more
- **Real-time WebSocket**: Stream session updates in real-time
- **Bank-Grade Security**: TLS certificate validation and session isolation
- **No Data Persistence**: Memory-only storage for enhanced privacy
- **Custom Templates**: Create templates for any website or service

## 📖 Documentation

For detailed documentation and advanced features, visit:
- [Official Documentation](https://zephis.org/docs)
- [Protocol Introduction](https://zephis.org/docs/protocol/intro)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

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