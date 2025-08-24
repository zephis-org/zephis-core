import express from "express";
import helmet from "helmet";
import dotenv from "dotenv";
// @ts-ignore
import expressWs from "express-ws";
import routes from "./api/routes";
import {
  errorHandler,
  corsMiddleware,
  rateLimiter,
  authMiddleware,
  requestLogger,
} from "./api/middleware";
import logger from "./utils/logger";

dotenv.config();

const app = express();
expressWs(app);

const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(corsMiddleware);

// Request parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(rateLimiter(60000, 100));

// Request logging
app.use(requestLogger);

// Authentication (optional)
if (process.env.REQUIRE_API_KEY === "true") {
  app.use(authMiddleware);
}

// API routes
app.use("/api/v1", routes);

// Error handling
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`ZEPHIS Core server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT signal received: closing HTTP server");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

// Export blockchain utilities for SDK usage
export { ContractClient } from "./blockchain/contract-client";
export { ProofSubmitter } from "./blockchain/proof-submitter";
export type { ProofData, PublicInputs } from "./blockchain/contract-client";

// Export types
export * from "./types";

export default app;
