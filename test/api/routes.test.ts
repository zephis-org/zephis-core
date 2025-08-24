import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';

// Mock handlers before importing routes
vi.mock('../../src/api/handlers', () => ({
  createSession: vi.fn((req, res) => res.json({ success: true })),
  getSession: vi.fn((req, res) => res.json({ success: true })),
  navigate: vi.fn((req, res) => res.json({ success: true })),
  waitForLogin: vi.fn((req, res) => res.json({ success: true })),
  captureData: vi.fn((req, res) => res.json({ success: true })),
  generateProof: vi.fn((req, res) => res.json({ success: true })),
  verifyProof: vi.fn((req, res) => res.json({ success: true })),
  submitProof: vi.fn((req, res) => res.json({ success: true })),
  destroySession: vi.fn((req, res) => res.json({ success: true })),
  listSessions: vi.fn((req, res) => res.json({ success: true })),
  createTemplate: vi.fn((req, res) => res.json({ success: true })),
  getTemplate: vi.fn((req, res) => res.json({ success: true })),
  updateTemplate: vi.fn((req, res) => res.json({ success: true })),
  deleteTemplate: vi.fn((req, res) => res.json({ success: true })),
  listTemplates: vi.fn((req, res) => res.json({ success: true })),
  listChains: vi.fn((req, res) => res.json({ success: true })),
  getChainInfo: vi.fn((req, res) => res.json({ success: true })),
  setActiveChain: vi.fn((req, res) => res.json({ success: true })),
  healthCheck: vi.fn((req, res) => res.json({ success: true, data: { status: 'healthy' } })),
  getStatus: vi.fn((req, res) => res.json({ success: true })),
  streamSession: vi.fn()
}));

// Mock middleware
vi.mock('../../src/api/middleware', () => ({
  validateRequest: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  authMiddleware: vi.fn((_req: any, _res: any, next: any) => next()),
  rateLimiter: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  corsMiddleware: vi.fn((_req: any, _res: any, next: any) => next()),
  errorHandler: vi.fn((err: any, _req: any, res: any, _next: any) => 
    res.status(500).json({ error: err.message })
  ),
  requestLogger: vi.fn((_req: any, _res: any, next: any) => next())
}));

describe('API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
  });

  describe('Route Setup', () => {
    it('should export setupRoutes function', async () => {
      const routes = await import('../../src/api/routes');
      expect(typeof routes.setupRoutes).toBe('function');
    });

    it('should setup routes on express app', async () => {
      const routes = await import('../../src/api/routes');
      const routerUseSpy = vi.spyOn(app, 'use');
      
      routes.setupRoutes(app);
      
      // Check that routes were added
      expect(routerUseSpy).toHaveBeenCalled();
    });
  });

  describe('Route Definitions', () => {
    it('should define session routes', async () => {
      const routes = await import('../../src/api/routes');
      const router = routes.default;
      
      // Check router exists
      expect(router).toBeDefined();
      
      // Check stack has routes
      if (router && router.stack) {
        const routePaths = router.stack
          .filter((layer: any) => layer.route)
          .map((layer: any) => layer.route.path);
        
        expect(routePaths.length).toBeGreaterThan(0);
      }
    });
  });
});