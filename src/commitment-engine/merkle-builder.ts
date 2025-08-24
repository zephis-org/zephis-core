import * as crypto from 'crypto';

export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  index?: number;
  data?: any;
}

export interface MerkleTree {
  root: MerkleNode;
  leaves: MerkleNode[];
  depth: number;
  totalNodes: number;
}

export interface MerkleProof {
  leaf: string;
  path: string[];
  indices: number[];
  root: string;
}

export class MerkleBuilder {
  private hashFunction: (data: Buffer) => string;

  constructor(hashAlgorithm: string = 'sha256') {
    this.hashFunction = (data: Buffer) => {
      return crypto.createHash(hashAlgorithm).update(data).digest('hex');
    };
  }

  public buildTree(data: any[]): MerkleTree {
    if (data.length === 0) {
      throw new Error('Cannot build Merkle tree from empty data');
    }

    // Create leaf nodes
    const leaves = data.map((item, index) => ({
      hash: this.hashData(item),
      index,
      data: item
    }));

    // Build tree from leaves
    const root = this.buildTreeFromLeaves([...leaves]);
    const depth = this.calculateDepth(leaves.length);

    return {
      root,
      leaves,
      depth,
      totalNodes: this.calculateTotalNodes(leaves.length)
    };
  }

  private buildTreeFromLeaves(nodes: MerkleNode[]): MerkleNode {
    if (nodes.length === 1) {
      return nodes[0];
    }

    const nextLevel: MerkleNode[] = [];

    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = i + 1 < nodes.length ? nodes[i + 1] : left;

      const parentHash = this.hashFunction(
        Buffer.concat([
          Buffer.from(left.hash, 'hex'),
          Buffer.from(right.hash, 'hex')
        ])
      );

      const parentNode: MerkleNode = {
        hash: parentHash,
        left,
        right
      };

      nextLevel.push(parentNode);
    }

    return this.buildTreeFromLeaves(nextLevel);
  }

  private hashData(data: any): string {
    let buffer: Buffer;

    if (Buffer.isBuffer(data)) {
      buffer = data;
    } else if (typeof data === 'string') {
      buffer = Buffer.from(data, 'utf8');
    } else {
      buffer = Buffer.from(JSON.stringify(data), 'utf8');
    }

    return this.hashFunction(buffer);
  }

  private calculateDepth(leafCount: number): number {
    return Math.ceil(Math.log2(leafCount));
  }

  private calculateTotalNodes(leafCount: number): number {
    let total = leafCount;
    let currentLevel = leafCount;

    while (currentLevel > 1) {
      currentLevel = Math.ceil(currentLevel / 2);
      total += currentLevel;
    }

    return total;
  }

  public generateProof(tree: MerkleTree, leafIndex: number): MerkleProof | null {
    if (leafIndex < 0 || leafIndex >= tree.leaves.length) {
      return null;
    }

    const leaf = tree.leaves[leafIndex];
    const path: string[] = [];
    const indices: number[] = [];

    this.collectProofPath(tree.root, leaf.hash, leafIndex, path, indices, tree.leaves.length);

    return {
      leaf: leaf.hash,
      path,
      indices,
      root: tree.root.hash
    };
  }

  private collectProofPath(
    node: MerkleNode,
    targetHash: string,
    leafIndex: number,
    path: string[],
    indices: number[],
    totalLeaves: number
  ): boolean {
    if (!node.left && !node.right) {
      return node.hash === targetHash;
    }

    if (!node.left || !node.right) {
      return false;
    }

    const leftFound = this.collectProofPath(
      node.left,
      targetHash,
      leafIndex,
      path,
      indices,
      totalLeaves
    );

    const rightFound = this.collectProofPath(
      node.right,
      targetHash,
      leafIndex,
      path,
      indices,
      totalLeaves
    );

    if (leftFound) {
      path.push(node.right.hash);
      indices.push(1); // Right sibling
      return true;
    } else if (rightFound) {
      path.push(node.left.hash);
      indices.push(0); // Left sibling
      return true;
    }

    return false;
  }

  public verifyProof(proof: MerkleProof): boolean {
    try {
      let currentHash = proof.leaf;
      let currentIndex = proof.indices.reduce((acc, bit, i) => acc + bit * Math.pow(2, i), 0);

      for (let i = 0; i < proof.path.length; i++) {
        const siblingHash = proof.path[i];
        const isRightSibling = proof.indices[i] === 1;

        if (isRightSibling) {
          currentHash = this.hashFunction(
            Buffer.concat([
              Buffer.from(currentHash, 'hex'),
              Buffer.from(siblingHash, 'hex')
            ])
          );
        } else {
          currentHash = this.hashFunction(
            Buffer.concat([
              Buffer.from(siblingHash, 'hex'),
              Buffer.from(currentHash, 'hex')
            ])
          );
        }

        currentIndex = Math.floor(currentIndex / 2);
      }

      return currentHash === proof.root;
    } catch (error) {
      return false;
    }
  }

  public updateTree(tree: MerkleTree, newData: any[]): MerkleTree {
    const combinedData = [...tree.leaves.map(leaf => leaf.data), ...newData];
    return this.buildTree(combinedData);
  }

  public generateBatchProof(tree: MerkleTree, leafIndices: number[]): MerkleProof[] {
    return leafIndices
      .map(index => this.generateProof(tree, index))
      .filter((proof): proof is MerkleProof => proof !== null);
  }

  public verifyBatchProof(proofs: MerkleProof[]): boolean {
    return proofs.every(proof => this.verifyProof(proof));
  }

  public buildSparseTree(data: Map<number, any>, maxIndex: number): MerkleTree {
    const sparseData: any[] = new Array(maxIndex + 1).fill(null);
    
    data.forEach((value, index) => {
      if (index <= maxIndex) {
        sparseData[index] = value;
      }
    });

    return this.buildTree(sparseData);
  }

  public generateInclusionProof(tree: MerkleTree, data: any): MerkleProof | null {
    const dataHash = this.hashData(data);
    const leafIndex = tree.leaves.findIndex(leaf => leaf.hash === dataHash);
    
    if (leafIndex === -1) {
      return null;
    }

    return this.generateProof(tree, leafIndex);
  }

  public generateNonInclusionProof(tree: MerkleTree, data: any): {
    isNotIncluded: boolean;
    proof?: string;
  } {
    const dataHash = this.hashData(data);
    const isIncluded = tree.leaves.some(leaf => leaf.hash === dataHash);

    if (isIncluded) {
      return { isNotIncluded: false };
    }

    // Generate proof of non-inclusion
    const proofHash = this.hashFunction(
      Buffer.concat([
        Buffer.from(tree.root.hash, 'hex'),
        Buffer.from(dataHash, 'hex')
      ])
    );

    return {
      isNotIncluded: true,
      proof: proofHash
    };
  }

  public compressMerkleProof(proof: MerkleProof): {
    compressedProof: string;
    metadata: any;
  } {
    const compressed = {
      leaf: proof.leaf,
      path: proof.path,
      indices: this.compressBitArray(proof.indices),
      root: proof.root
    };

    return {
      compressedProof: Buffer.from(JSON.stringify(compressed)).toString('base64'),
      metadata: {
        originalSize: JSON.stringify(proof).length,
        compressedSize: Buffer.from(JSON.stringify(compressed)).toString('base64').length
      }
    };
  }

  private compressBitArray(bits: number[]): string {
    let result = 0;
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] === 1) {
        result |= (1 << i);
      }
    }
    return result.toString(16);
  }

  public decompressMerkleProof(compressed: {
    compressedProof: string;
    metadata: any;
  }): MerkleProof {
    const decompressed = JSON.parse(
      Buffer.from(compressed.compressedProof, 'base64').toString('utf8')
    );

    return {
      leaf: decompressed.leaf,
      path: decompressed.path,
      indices: this.decompressBitArray(decompressed.indices),
      root: decompressed.root
    };
  }

  private decompressBitArray(hex: string): number[] {
    const num = parseInt(hex, 16);
    const bits: number[] = [];
    
    for (let i = 0; i < 32; i++) {
      if (num & (1 << i)) {
        bits[i] = 1;
      } else {
        bits[i] = 0;
      }
    }

    // Remove trailing zeros
    while (bits.length > 0 && bits[bits.length - 1] === 0) {
      bits.pop();
    }

    return bits;
  }

  public getMerkleRoot(data: any[]): string {
    if (data.length === 0) return '';
    const tree = this.buildTree(data);
    return tree.root.hash;
  }

  public exportTree(tree: MerkleTree): string {
    const serializable = {
      root: this.serializeNode(tree.root),
      leafCount: tree.leaves.length,
      depth: tree.depth,
      totalNodes: tree.totalNodes
    };

    return JSON.stringify(serializable);
  }

  private serializeNode(node: MerkleNode): any {
    return {
      hash: node.hash,
      index: node.index,
      data: node.data,
      left: node.left ? this.serializeNode(node.left) : undefined,
      right: node.right ? this.serializeNode(node.right) : undefined
    };
  }

  public importTree(treeString: string): MerkleTree {
    const parsed = JSON.parse(treeString);
    
    return {
      root: this.deserializeNode(parsed.root),
      leaves: this.collectLeaves(this.deserializeNode(parsed.root)),
      depth: parsed.depth,
      totalNodes: parsed.totalNodes
    };
  }

  private deserializeNode(nodeData: any): MerkleNode {
    const node: MerkleNode = {
      hash: nodeData.hash,
    };
    
    if (nodeData.index !== undefined) node.index = nodeData.index;
    if (nodeData.data !== undefined) node.data = nodeData.data;
    if (nodeData.left) node.left = this.deserializeNode(nodeData.left);
    if (nodeData.right) node.right = this.deserializeNode(nodeData.right);
    
    return node;
  }

  private collectLeaves(node: MerkleNode): MerkleNode[] {
    if (!node.left && !node.right && node.data !== undefined) {
      return [node];
    }

    const leaves: MerkleNode[] = [];
    if (node.left) leaves.push(...this.collectLeaves(node.left));
    if (node.right) leaves.push(...this.collectLeaves(node.right));
    
    return leaves;
  }
}