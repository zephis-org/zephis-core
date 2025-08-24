import { Router } from "express";
import asyncHandler from "express-async-handler";
import * as handlers from "./handlers";
import { validateRequest } from "./middleware";

const router = Router();

// Session Management
router.post(
  "/sessions",
  validateRequest("createSession"),
  asyncHandler(handlers.createSession),
);

router.get("/sessions/:sessionId", asyncHandler(handlers.getSession));

router.delete("/sessions/:sessionId", asyncHandler(handlers.destroySession));

router.get("/sessions", asyncHandler(handlers.listSessions));

// Navigation & Interaction
router.post(
  "/sessions/:sessionId/navigate",
  validateRequest("navigate"),
  asyncHandler(handlers.navigate),
);

router.post(
  "/sessions/:sessionId/wait-login",
  validateRequest("waitLogin"),
  asyncHandler(handlers.waitForLogin),
);

// Data Extraction & Proof Generation
router.post(
  "/sessions/:sessionId/capture",
  validateRequest("capture"),
  asyncHandler(handlers.captureData),
);

router.post(
  "/sessions/:sessionId/prove",
  validateRequest("prove"),
  asyncHandler(handlers.generateProof),
);

// Template Management
router.get("/templates", asyncHandler(handlers.listTemplates));

router.get("/templates/:name", asyncHandler(handlers.getTemplate));

router.post(
  "/templates",
  validateRequest("createTemplate"),
  asyncHandler(handlers.createTemplate),
);

router.put(
  "/templates/:name",
  validateRequest("updateTemplate"),
  asyncHandler(handlers.updateTemplate),
);

router.delete("/templates/:name", asyncHandler(handlers.deleteTemplate));

// Proof Verification
router.post(
  "/verify",
  validateRequest("verify"),
  asyncHandler(handlers.verifyProof),
);

router.post(
  "/submit",
  validateRequest("submit"),
  asyncHandler(handlers.submitProof),
);

// Chain Management
router.get("/chains", asyncHandler(handlers.listChains));

router.get("/chains/:chainId", asyncHandler(handlers.getChainInfo));

router.post("/chains/:chainId/activate", asyncHandler(handlers.setActiveChain));

// Health & Status
router.get("/health", asyncHandler(handlers.healthCheck));

router.get("/status", asyncHandler(handlers.getStatus));

// WebSocket endpoint for real-time updates (handled separately in WebSocket server)
// router.ws('/sessions/:sessionId/stream', handlers.streamSession);

export function setupRoutes(app: any): void {
  app.use("/api", router);
}

export default router;
