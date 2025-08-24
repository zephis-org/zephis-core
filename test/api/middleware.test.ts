import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { 
  validateRequest, 
  errorHandler, 
  corsMiddleware, 
  rateLimiter, 
  authMiddleware,
  requestLogger 
} from '../../src/api/middleware';

describe('API Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      headers: {},
      method: 'GET',
      url: '/test',
      ip: '127.0.0.1'
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      sendStatus: vi.fn(),
      statusCode: 200,
      on: vi.fn()
    };

    mockNext = vi.fn();
  });

  describe('validateRequest', () => {
    it('should pass valid request', () => {
      const validator = validateRequest('createSession');
      mockReq.body = { metadata: { key: 'value' } };

      validator(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject invalid request', () => {
      const validator = validateRequest('navigate');
      mockReq.body = { invalidField: 'value' };

      validator(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate complex schemas', () => {
      const validator = validateRequest('prove');
      mockReq.body = {
        template: 'test-template',
        claim: 'test-claim',
        params: { amount: 100 }
      };

      validator(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate template creation', () => {
      const validator = validateRequest('createTemplate');
      mockReq.body = {
        domain: 'test.com',
        name: 'Test',
        selectors: { field: '.selector' },
        extractors: { test: '() => true' }
      };

      validator(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('errorHandler', () => {
    it('should handle errors', () => {
      const error = new Error('Test error');
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Test error'
        })
      );
    });

    it('should handle errors without message', () => {
      const error = new Error();
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal server error'
        })
      );
    });
  });

  describe('corsMiddleware', () => {
    beforeEach(() => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001';
    });

    it('should set CORS headers for allowed origin', () => {
      mockReq.headers!.origin = 'http://localhost:3000';

      corsMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'http://localhost:3000'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not set origin header for disallowed origin', () => {
      mockReq.headers!.origin = 'http://evil.com';

      corsMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).not.toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'http://evil.com'
      );
    });

    it('should handle OPTIONS requests', () => {
      mockReq.method = 'OPTIONS';

      corsMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.sendStatus).toHaveBeenCalledWith(204);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('rateLimiter', () => {
    it('should allow requests within limit', () => {
      const limiter = rateLimiter(60000, 3);

      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);

      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(3);
    });

    it('should block requests over limit', () => {
      const limiter = rateLimiter(60000, 2);

      limiter(mockReq as Request, mockRes as Response, mockNext);
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      mockNext.mockClear();
      mockRes.status = vi.fn().mockReturnThis();
      
      limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Too many requests'
        })
      );
    });

    it('should reset after window expires', () => {
      vi.useFakeTimers();
      const limiter = rateLimiter(1000, 1);

      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1001);
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('authMiddleware', () => {
    it('should allow requests when auth not required', () => {
      process.env.REQUIRE_API_KEY = 'false';

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should check API key when required', () => {
      process.env.REQUIRE_API_KEY = 'true';
      process.env.API_KEY = 'secret-key';
      mockReq.headers!['x-api-key'] = 'secret-key';

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid API key', () => {
      process.env.REQUIRE_API_KEY = 'true';
      process.env.API_KEY = 'secret-key';
      mockReq.headers!['x-api-key'] = 'wrong-key';

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Unauthorized'
        })
      );
    });

    it('should reject missing API key', () => {
      process.env.REQUIRE_API_KEY = 'true';
      process.env.API_KEY = 'secret-key';

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requestLogger', () => {
    it('should log request details on finish', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      let finishCallback: any;

      mockRes.on = vi.fn((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));

      finishCallback();

      logSpy.mockRestore();
    });

    it('should measure request duration', () => {
      vi.useFakeTimers();
      let finishCallback: any;

      mockRes.on = vi.fn((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      const _startTime = Date.now();
      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      
      vi.advanceTimersByTime(150);
      
      finishCallback();

      vi.useRealTimers();
    });
  });
});