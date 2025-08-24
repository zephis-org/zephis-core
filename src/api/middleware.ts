import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import logger from "../utils/logger";

const schemas = {
  createSession: z.object({
    metadata: z.record(z.any()).optional(),
  }),

  navigate: z.object({
    url: z.string().url(),
  }),

  waitLogin: z.object({
    expectedUrl: z.string().optional(),
  }),

  capture: z.object({
    template: z.string(),
  }),

  prove: z.object({
    template: z.union([
      z.string(),
      z.object({
        domain: z.string(),
        name: z.string(),
        selectors: z.record(z.string()),
        extractors: z.record(z.string()),
      }),
    ]),
    claim: z.string(),
    params: z.record(z.any()).optional(),
  }),

  createTemplate: z.object({
    domain: z.string(),
    name: z.string(),
    selectors: z.record(z.string()),
    extractors: z.record(z.string()),
    validation: z
      .object({
        requiredFields: z.array(z.string()).optional(),
        maxDataSize: z.number().optional(),
        allowedDomains: z.array(z.string()).optional(),
      })
      .optional(),
  }),

  updateTemplate: z.object({
    domain: z.string(),
    name: z.string(),
    selectors: z.record(z.string()),
    extractors: z.record(z.string()),
    validation: z
      .object({
        requiredFields: z.array(z.string()).optional(),
        maxDataSize: z.number().optional(),
        allowedDomains: z.array(z.string()).optional(),
      })
      .optional(),
  }),

  verify: z.object({
    proof: z.object({
      a: z.tuple([z.string(), z.string()]),
      b: z.tuple([
        z.tuple([z.string(), z.string()]),
        z.tuple([z.string(), z.string()]),
      ]),
      c: z.tuple([z.string(), z.string()]),
    }),
    publicInputs: z.array(z.string()),
    metadata: z.object({
      sessionId: z.string(),
      template: z.string(),
      claim: z.string(),
      timestamp: z.number(),
      domain: z.string(),
      circuitId: z.string(),
    }),
  }),

  submit: z.object({
    proof: z.any(),
    chainId: z.number().optional(),
  }),
};

export function validateRequest(schemaName: keyof typeof schemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    const schema = schemas[schemaName];

    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("Validation error:", error.errors);
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
          timestamp: Date.now(),
        });
      } else {
        next(error);
      }
    }
  };
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error("API error:", err);

  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
    timestamp: Date.now(),
  });
}

export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
  } else {
    next();
  }
}

export function rateLimiter(
  windowMs: number = 60000,
  maxRequests: number = 100,
) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const requestData = requests.get(ip);

    if (!requestData || now > requestData.resetTime) {
      requests.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
      next();
    } else if (requestData.count < maxRequests) {
      requestData.count++;
      next();
    } else {
      res.status(429).json({
        success: false,
        error: "Too many requests",
        timestamp: Date.now(),
      });
    }
  };
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const apiKey = req.headers["x-api-key"];

  if (process.env.REQUIRE_API_KEY === "true") {
    if (!apiKey || apiKey !== process.env.API_KEY) {
      res.status(401).json({
        success: false,
        error: "Unauthorized",
        timestamp: Date.now(),
      });
      return;
    }
  }

  next();
}

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  });

  next();
}
