import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { CircuitLoader } from '../../src/proof/circuit-loader';

// Mock fs/promises
vi.mock('fs/promises');

describe('CircuitLoader', () => {
  let circuitLoader: CircuitLoader;
  const mockCircuitPath = '/mock/circuits';

  beforeEach(() => {
    vi.clearAllMocks();
    circuitLoader = new CircuitLoader(mockCircuitPath);
  });

  describe('loadCircuit', () => {
    it('should load circuit configuration', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const config = await circuitLoader.loadCircuit('test_circuit');

      expect(config).toEqual({
        name: 'test_circuit',
        wasmPath: path.join(mockCircuitPath, 'test_circuit', 'test_circuit.wasm'),
        zkeyPath: path.join(mockCircuitPath, 'test_circuit', 'test_circuit_final.zkey'),
        verificationKeyPath: path.join(mockCircuitPath, 'test_circuit', 'verification_key.json')
      });
    });

    it('should cache loaded circuits', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const config1 = await circuitLoader.loadCircuit('test_circuit');
      const config2 = await circuitLoader.loadCircuit('test_circuit');

      expect(config1).toBe(config2);
      // Access should be called 3 times (once for each file) only on first load
      expect(fs.access).toHaveBeenCalledTimes(3);
    });

    it('should throw error if circuit files not found', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      await expect(circuitLoader.loadCircuit('nonexistent'))
        .rejects.toThrow('Circuit file not found');
    });
  });

  describe('loadWasm', () => {
    it('should load WASM file successfully', async () => {
      const mockWasmContent = Buffer.from('mock wasm content');
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockWasmContent);

      const result = await circuitLoader.loadWasm('test_circuit');

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(mockCircuitPath, 'test_circuit', 'test_circuit.wasm')
      );
      expect(result).toEqual(mockWasmContent);
    });
  });

  describe('loadZkey', () => {
    it('should load zkey file successfully', async () => {
      const mockZkeyContent = Buffer.from('mock zkey content');
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockZkeyContent);

      const result = await circuitLoader.loadZkey('test_circuit');

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(mockCircuitPath, 'test_circuit', 'test_circuit_final.zkey')
      );
      expect(result).toEqual(mockZkeyContent);
    });
  });

  describe('loadVerificationKey', () => {
    it('should load verification key successfully', async () => {
      const mockVkey = { protocol: 'groth16', curve: 'bn128' };
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        Buffer.from(JSON.stringify(mockVkey))
      );

      const result = await circuitLoader.loadVerificationKey('test_circuit');

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(mockCircuitPath, 'test_circuit', 'verification_key.json'),
        'utf-8'
      );
      expect(result).toEqual(mockVkey);
    });
  });

  describe('getCircuit', () => {
    it('should return cached circuit', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      await circuitLoader.loadCircuit('test_circuit');
      const circuit = circuitLoader.getCircuit('test_circuit');

      expect(circuit).toBeDefined();
      expect(circuit?.name).toBe('test_circuit');
    });

    it('should return undefined for non-cached circuit', () => {
      const circuit = circuitLoader.getCircuit('nonexistent');
      expect(circuit).toBeUndefined();
    });
  });

  describe('listCircuits', () => {
    it('should list loaded circuits', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await circuitLoader.loadCircuit('circuit1');
      await circuitLoader.loadCircuit('circuit2');

      const circuits = circuitLoader.listCircuits();
      expect(circuits).toEqual(['circuit1', 'circuit2']);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached circuits', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await circuitLoader.loadCircuit('circuit1');
      circuitLoader.clearCache();

      const circuits = circuitLoader.listCircuits();
      expect(circuits).toEqual([]);
    });
  });

  describe('getCircuitInfo', () => {
    it('should return circuit info with sizes', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1024,
        mtime: new Date('2024-01-01')
      } as any);

      const info = await circuitLoader.getCircuitInfo('test_circuit');

      expect(info).toEqual({
        name: 'test_circuit',
        wasmSize: 1024,
        zkeySize: 1024
      });
    });
  });
});