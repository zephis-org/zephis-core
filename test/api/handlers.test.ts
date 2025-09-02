import { describe, it, expect, beforeEach, vi, afterEach, beforeAll } from 'vitest';
import { Request, Response } from 'express';
import { WebSocket } from 'ws';
import { SessionStatus } from '../../src/types';

// Mock all dependencies BEFORE importing handlers
vi.mock('../../src/container/lifecycle-manager', () => ({
  LifecycleManager: vi.fn().mockImplementation(() => ({
    createSession: vi.fn(),
    getSession: vi.fn(),
    destroySession: vi.fn(),
    getActiveSessions: vi.fn(),
    navigateToTarget: vi.fn(),
    waitForUserLogin: vi.fn(),
    capturePageData: vi.fn()
  }))
}));

vi.mock('../../src/template-engine/template-loader', () => ({
  TemplateLoader: vi.fn().mockImplementation(() => ({
    loadTemplate: vi.fn(),
    listTemplates: vi.fn(),
    getTemplate: vi.fn(),
    saveTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn()
  }))
}));

vi.mock('../../src/proof/proof-generator', () => ({
  ProofGenerator: vi.fn().mockImplementation(() => ({
    generateProof: vi.fn()
  }))
}));

vi.mock('../../src/blockchain/contract-client', () => ({
  ContractClient: vi.fn().mockImplementation(() => ({
    submitProof: vi.fn(),
    verifyProof: vi.fn()
  }))
}));

vi.mock('../../src/blockchain/chain-manager', () => ({
  ChainManager: vi.fn().mockImplementation(() => ({
    getActiveChain: vi.fn(),
    getSupportedChains: vi.fn(),
    getChainById: vi.fn(),
    setActiveChain: vi.fn()
  }))
}));

vi.mock('../../src/tls/session-capture', () => ({
  TLSSessionCapture: vi.fn().mockImplementation(() => ({
    getSessionForDomain: vi.fn(),
    captureSession: vi.fn()
  }))
}));

vi.mock('../../src/tls/data-extractor', () => ({
  DataExtractor: vi.fn().mockImplementation(() => ({
    extractData: vi.fn()
  }))
}));

vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Now import handlers after all mocks are set up
let handlers: any;
let LifecycleManager: any;
let TemplateLoader: any;
let ProofGenerator: any;
let ChainManager: any;

describe('API Handlers', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let lifecycleManagerInstance: any;
  let templateLoaderInstance: any;
  let proofGeneratorInstance: any;
  let chainManagerInstance: any;

  beforeAll(async () => {
    // Import modules after mocks are set
    handlers = await import('../../src/api/handlers');
    const lifecycleModule = await import('../../src/container/lifecycle-manager');
    const templateModule = await import('../../src/template-engine/template-loader');
    const proofModule = await import('../../src/proof/proof-generator');
    const chainModule = await import('../../src/blockchain/chain-manager');
    
    LifecycleManager = lifecycleModule.LifecycleManager;
    TemplateLoader = templateModule.TemplateLoader;
    ProofGenerator = proofModule.ProofGenerator;
    ChainManager = chainModule.ChainManager;

    // Get the singleton instances created by handlers
    lifecycleManagerInstance = LifecycleManager.mock.results[0]?.value;
    templateLoaderInstance = TemplateLoader.mock.results[0]?.value;
    proofGeneratorInstance = ProofGenerator.mock.results[0]?.value;
    chainManagerInstance = ChainManager.mock.results[0]?.value;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      body: {},
      params: {},
      query: {},
      headers: {}
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const mockSession = {
        id: 'session-123',
        containerId: 'container-456',
        browserUrl: 'http://localhost:9222',
        vncUrl: 'vnc://localhost:5900',
        status: SessionStatus.READY,
        createdAt: new Date(),
        expiresAt: new Date()
      };

      lifecycleManagerInstance.createSession.mockResolvedValue(mockSession);

      await handlers.createSession(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSession,
        timestamp: expect.any(Number)
      });
    });

    it('should handle errors when creating session fails', async () => {
      const error = new Error('Docker connection failed');
      
      lifecycleManagerInstance.createSession.mockRejectedValue(error);

      await handlers.createSession(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Docker connection failed',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('getSession', () => {
    it('should get session successfully', async () => {
      const mockSession = {
        id: 'session-123',
        status: SessionStatus.ACTIVE
      };

      mockReq.params = { sessionId: 'session-123' };
      lifecycleManagerInstance.getSession.mockResolvedValue(mockSession);

      await handlers.getSession(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSession,
        timestamp: expect.any(Number)
      });
    });

    it('should return 404 when session not found', async () => {
      mockReq.params = { sessionId: 'non-existent' };
      lifecycleManagerInstance.getSession.mockResolvedValue(null);

      await handlers.getSession(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session not found',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('destroySession', () => {
    it('should destroy session successfully', async () => {
      mockReq.params = { sessionId: 'session-123' };
      lifecycleManagerInstance.destroySession.mockResolvedValue(undefined);

      await handlers.destroySession(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Session destroyed' },
        timestamp: expect.any(Number)
      });
    });

    it('should handle errors when destroying session fails', async () => {
      const error = new Error('Container not found');
      
      mockReq.params = { sessionId: 'session-123' };
      lifecycleManagerInstance.destroySession.mockRejectedValue(error);

      await handlers.destroySession(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Container not found',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('listSessions', () => {
    it('should list all active sessions', async () => {
      const mockSessions = [
        { id: 'session-1', status: SessionStatus.ACTIVE },
        { id: 'session-2', status: SessionStatus.READY }
      ];

      lifecycleManagerInstance.getActiveSessions.mockReturnValue(mockSessions);

      await handlers.listSessions(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSessions,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('navigate', () => {
    it('should navigate to URL successfully', async () => {
      mockReq.params = { sessionId: 'session-123' };
      mockReq.body = { url: 'https://example.com' };
      
      lifecycleManagerInstance.navigateToTarget.mockResolvedValue(undefined);

      await handlers.navigate(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Navigation successful', url: 'https://example.com' },
        timestamp: expect.any(Number)
      });
    });

    it('should handle navigation errors', async () => {
      const error = new Error('Invalid URL');
      
      mockReq.params = { sessionId: 'session-123' };
      mockReq.body = { url: 'invalid-url' };
      
      lifecycleManagerInstance.navigateToTarget.mockRejectedValue(error);

      await handlers.navigate(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid URL',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('waitForLogin', () => {
    it('should wait for login successfully', async () => {
      mockReq.params = { sessionId: 'session-123' };
      mockReq.body = { expectedUrl: 'https://example.com/dashboard' };
      
      lifecycleManagerInstance.waitForUserLogin.mockResolvedValue(undefined);

      await handlers.waitForLogin(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Login completed' },
        timestamp: expect.any(Number)
      });
    });

    it('should handle login wait errors', async () => {
      const error = new Error('Login timeout');
      
      mockReq.params = { sessionId: 'session-123' };
      mockReq.body = { expectedUrl: 'https://example.com/dashboard' };
      
      lifecycleManagerInstance.waitForUserLogin.mockRejectedValue(error);

      await handlers.waitForLogin(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Login timeout',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('captureData', () => {
    it('should capture data successfully', async () => {
      const mockTemplate = {
        domain: 'example.com',
        name: 'Example',
        selectors: {
          balance: '.balance',
          username: '.username'
        }
      };

      const mockData = {
        balance: '$1000',
        username: 'testuser'
      };

      mockReq.params = { sessionId: 'session-123' };
      mockReq.body = { template: 'example-template' };
      
      templateLoaderInstance.loadTemplate.mockResolvedValue(mockTemplate);
      lifecycleManagerInstance.capturePageData.mockResolvedValue(mockData);

      await handlers.captureData(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockData,
        timestamp: expect.any(Number)
      });
    });

    it('should handle capture errors', async () => {
      const error = new Error('Template not found');
      
      mockReq.params = { sessionId: 'session-123' };
      mockReq.body = { template: 'non-existent' };
      
      templateLoaderInstance.loadTemplate.mockRejectedValue(error);

      await handlers.captureData(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Template not found',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('listTemplates', () => {
    it('should list all templates', async () => {
      const mockTemplates = ['template1', 'template2', 'template3'];

      templateLoaderInstance.listTemplates.mockReturnValue(mockTemplates);

      await handlers.listTemplates(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockTemplates,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('getTemplate', () => {
    it('should get template successfully', async () => {
      const mockTemplate = {
        domain: 'example.com',
        name: 'Example Template',
        selectors: {}
      };

      mockReq.params = { name: 'example' };
      templateLoaderInstance.getTemplate.mockReturnValue(mockTemplate);

      await handlers.getTemplate(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockTemplate,
        timestamp: expect.any(Number)
      });
    });

    it('should return 404 when template not found', async () => {
      mockReq.params = { name: 'non-existent' };
      templateLoaderInstance.getTemplate.mockReturnValue(null);

      await handlers.getTemplate(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Template not found',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      await handlers.healthCheck(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          status: 'healthy',
          uptime: expect.any(Number)
        },
        timestamp: expect.any(Number)
      });
    });
  });

  describe('getStatus', () => {
    it('should return system status', async () => {
      const mockChains = [1, 137, 42161];
      const mockTemplates = ['template1', 'template2'];

      // Mock getSessionCount method
      lifecycleManagerInstance.getSessionCount = vi.fn().mockReturnValue(3);
      templateLoaderInstance.listTemplates.mockReturnValue(mockTemplates);
      chainManagerInstance.getSupportedChains.mockReturnValue(mockChains);

      await handlers.getStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          sessions: 3,
          templates: 2,
          chains: 3,
          uptime: expect.any(Number),
          memory: expect.any(Object)
        },
        timestamp: expect.any(Number)
      });
    });
  });

  describe('createTemplate', () => {
    it('should create template successfully', async () => {
      const mockTemplate = {
        domain: 'example.com',
        name: 'Example Template',
        selectors: { balance: '.balance' },
        extractors: { balance: 'el => el.textContent' }
      };

      mockReq.body = mockTemplate;
      templateLoaderInstance.saveTemplate.mockResolvedValue(undefined);

      await handlers.createTemplate(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          name: 'example-template',
          template: mockTemplate
        },
        timestamp: expect.any(Number)
      });
    });

    it('should handle template creation errors', async () => {
      const error = new Error('Template already exists');
      mockReq.body = { name: 'Test', domain: 'test.com', selectors: {}, extractors: {} };
      
      templateLoaderInstance.saveTemplate.mockRejectedValue(error);

      await handlers.createTemplate(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Template already exists',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('updateTemplate', () => {
    it('should update template successfully', async () => {
      const mockTemplate = {
        domain: 'example.com',
        name: 'Updated Template',
        selectors: { balance: '.new-balance' },
        extractors: { balance: 'el => el.textContent' }
      };

      mockReq.params = { name: 'example-template' };
      mockReq.body = mockTemplate;
      templateLoaderInstance.saveTemplate.mockResolvedValue(undefined);

      await handlers.updateTemplate(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          name: 'example-template',
          template: mockTemplate
        },
        timestamp: expect.any(Number)
      });
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template successfully', async () => {
      mockReq.params = { name: 'example-template' };
      templateLoaderInstance.deleteTemplate.mockResolvedValue(undefined);

      await handlers.deleteTemplate(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Template deleted' },
        timestamp: expect.any(Number)
      });
    });
  });

  describe('verifyProof', () => {
    it('should verify proof successfully', async () => {
      const mockProof = {
        proof: { a: ['0x1', '0x2'], b: [['0x3', '0x4'], ['0x5', '0x6']], c: ['0x7', '0x8'] },
        publicInputs: ['0x9', '0xa']
      };

      mockReq.body = mockProof;
      proofGeneratorInstance.verifyProof = vi.fn().mockResolvedValue(true);

      await handlers.verifyProof(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { valid: true },
        timestamp: expect.any(Number)
      });
    });
  });

  describe('submitProof', () => {
    it('should submit proof successfully', async () => {
      const mockProof = {
        proof: { a: ['0x1', '0x2'], b: [['0x3', '0x4'], ['0x5', '0x6']], c: ['0x7', '0x8'] },
        publicInputs: ['0x9', '0xa']
      };
      const mockResult = {
        transactionHash: '0xabc123',
        blockNumber: 12345
      };

      mockReq.body = { proof: mockProof, chainId: 1 };
      
      const mockChain = {
        rpcUrl: 'https://eth.rpc',
        chain: { id: 1 },
        contractAddress: '0xcontract'
      };
      
      chainManagerInstance.getChain = vi.fn().mockReturnValue(mockChain);
      
      // Mock ContractClient
      const { ContractClient } = await import('../../src/blockchain/contract-client');
      const mockContractClientInstance = {
        verifyProof: vi.fn().mockResolvedValue(mockResult)
      };
      vi.mocked(ContractClient).mockImplementation(() => mockContractClientInstance as any);

      await handlers.submitProof(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
        timestamp: expect.any(Number)
      });
    });

    it('should handle unsupported chain error', async () => {
      mockReq.body = { proof: {}, chainId: 999 };
      chainManagerInstance.getChain = vi.fn().mockReturnValue(null);

      await handlers.submitProof(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Chain not supported',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('listChains', () => {
    it('should list all supported chains', async () => {
      const mockChainIds = [1, 137, 42161];
      
      chainManagerInstance.getSupportedChains.mockReturnValue(mockChainIds);
      chainManagerInstance.getChainName = vi.fn().mockImplementation((id) => {
        const names: Record<number, string> = { 1: 'Ethereum', 137: 'Polygon', 42161: 'Arbitrum' };
        return names[id];
      });
      chainManagerInstance.getChainInfo = vi.fn().mockImplementation((id) => ({
        id,
        name: chainManagerInstance.getChainName(id),
        rpcUrl: `https://rpc-${id}.com`
      }));

      await handlers.listChains(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [
          { id: 1, name: 'Ethereum', info: { id: 1, name: 'Ethereum', rpcUrl: 'https://rpc-1.com' } },
          { id: 137, name: 'Polygon', info: { id: 137, name: 'Polygon', rpcUrl: 'https://rpc-137.com' } },
          { id: 42161, name: 'Arbitrum', info: { id: 42161, name: 'Arbitrum', rpcUrl: 'https://rpc-42161.com' } }
        ],
        timestamp: expect.any(Number)
      });
    });
  });

  describe('getChainInfo', () => {
    it('should get chain info successfully', async () => {
      const mockInfo = {
        id: 1,
        name: 'Ethereum',
        rpcUrl: 'https://eth.rpc',
        contractAddress: '0xcontract'
      };

      mockReq.params = { chainId: '1' };
      chainManagerInstance.getChainInfo = vi.fn().mockReturnValue(mockInfo);

      await handlers.getChainInfo(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockInfo,
        timestamp: expect.any(Number)
      });
    });

    it('should return 404 when chain not found', async () => {
      mockReq.params = { chainId: '999' };
      chainManagerInstance.getChainInfo = vi.fn().mockReturnValue(null);

      await handlers.getChainInfo(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Chain not found',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('setActiveChain', () => {
    it('should set active chain successfully', async () => {
      mockReq.params = { chainId: '137' };
      chainManagerInstance.setActiveChain = vi.fn().mockReturnValue(undefined);

      await handlers.setActiveChain(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { chainId: 137, message: 'Active chain updated' },
        timestamp: expect.any(Number)
      });
    });

    it('should handle chain setting errors', async () => {
      const error = new Error('Invalid chain ID');
      mockReq.params = { chainId: '999' };
      chainManagerInstance.setActiveChain = vi.fn().mockImplementation(() => {
        throw error;
      });

      await handlers.setActiveChain(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid chain ID',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('generateProof', () => {
    it('should handle missing session data', async () => {
      mockReq.params = { sessionId: 'invalid-session' };
      mockReq.body = { template: 'example', claim: 'test' };

      await handlers.generateProof(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session not properly initialized',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('streamSession', () => {
    it('should handle WebSocket connections', () => {
      const mockWs = {
        send: vi.fn(),
        close: vi.fn(),
        on: vi.fn()
      } as any;

      mockReq.params = { sessionId: 'session-123' };

      handlers.streamSession(mockWs, mockReq as Request);

      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'connected',
        sessionId: 'session-123'
      }));
    });
  });
});