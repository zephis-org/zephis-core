import { Request, Response } from "express";
import { WebSocket } from "ws";
import { LifecycleManager } from "../container/lifecycle-manager";
import { TemplateLoader } from "../template-engine/template-loader";
import { ProofGenerator } from "../proof/proof-generator";
import { ContractClient } from "../blockchain/contract-client";
import { ChainManager } from "../blockchain/chain-manager";
import { TLSSessionCapture } from "../tls/session-capture";
import { DataExtractor } from "../tls/data-extractor";
import { APIResponse, ProofRequest, Template } from "../types";
import logger from "../utils/logger";

let lifecycleManager: LifecycleManager;
let templateLoader: TemplateLoader;
let proofGenerator: ProofGenerator;
let chainManager: ChainManager;
let tlsCaptures: Map<string, TLSSessionCapture>;
let dataExtractors: Map<string, DataExtractor>;

// Initialize instances
function initializeHandlers() {
  if (!lifecycleManager) {
    lifecycleManager = new LifecycleManager();
    templateLoader = new TemplateLoader();
    proofGenerator = new ProofGenerator();
    chainManager = new ChainManager();
    tlsCaptures = new Map<string, TLSSessionCapture>();
    dataExtractors = new Map<string, DataExtractor>();
  }
}

// Call initialization
initializeHandlers();

// Session Management Handlers
export async function createSession(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const session = await lifecycleManager.createSession();

    const tlsCapture = new TLSSessionCapture();
    const dataExtractor = new DataExtractor();
    tlsCaptures.set(session.id, tlsCapture);
    dataExtractors.set(session.id, dataExtractor);

    const response: APIResponse = {
      success: true,
      data: session,
      timestamp: Date.now(),
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error("Failed to create session:", error);
    const response: APIResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create session",
      timestamp: Date.now(),
    };
    res.status(500).json(response);
  }
}

export async function getSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  const session = await lifecycleManager.getSession(sessionId);

  if (!session) {
    const response: APIResponse = {
      success: false,
      error: "Session not found",
      timestamp: Date.now(),
    };
    res.status(404).json(response);
    return;
  }

  const response: APIResponse = {
    success: true,
    data: session,
    timestamp: Date.now(),
  };

  res.json(response);
}

export async function destroySession(
  req: Request,
  res: Response,
): Promise<void> {
  const { sessionId } = req.params;

  try {
    await lifecycleManager.destroySession(sessionId);
    tlsCaptures.delete(sessionId);
    dataExtractors.delete(sessionId);

    const response: APIResponse = {
      success: true,
      data: { message: "Session destroyed" },
      timestamp: Date.now(),
    };

    res.json(response);
  } catch (error) {
    logger.error("Failed to destroy session:", error);
    const response: APIResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to destroy session",
      timestamp: Date.now(),
    };
    res.status(500).json(response);
  }
}

export async function listSessions(
  _req: Request,
  res: Response,
): Promise<void> {
  const sessions = lifecycleManager.getActiveSessions();

  const response: APIResponse = {
    success: true,
    data: sessions,
    timestamp: Date.now(),
  };

  res.json(response);
}

// Navigation Handlers
export async function navigate(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { url } = req.body;

  try {
    await lifecycleManager.navigateToTarget(sessionId, url);

    const response: APIResponse = {
      success: true,
      data: { message: "Navigation successful", url },
      timestamp: Date.now(),
    };

    res.json(response);
  } catch (error) {
    logger.error("Navigation failed:", error);
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Navigation failed",
      timestamp: Date.now(),
    };
    res.status(500).json(response);
  }
}

export async function waitForLogin(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { expectedUrl } = req.body;

  try {
    await lifecycleManager.waitForUserLogin(sessionId, expectedUrl);

    const response: APIResponse = {
      success: true,
      data: { message: "Login completed" },
      timestamp: Date.now(),
    };

    res.json(response);
  } catch (error) {
    logger.error("Login wait failed:", error);
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Login wait failed",
      timestamp: Date.now(),
    };
    res.status(500).json(response);
  }
}

// Data Capture Handlers
export async function captureData(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { template: templateName } = req.body;

  try {
    const template = await templateLoader.loadTemplate(templateName);
    const data = await lifecycleManager.capturePageData(
      sessionId,
      template.selectors,
    );

    const response: APIResponse = {
      success: true,
      data,
      timestamp: Date.now(),
    };

    res.json(response);
  } catch (error) {
    logger.error("Data capture failed:", error);
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Data capture failed",
      timestamp: Date.now(),
    };
    res.status(500).json(response);
  }
}

// Proof Generation Handler
export async function generateProof(
  req: Request,
  res: Response,
): Promise<void> {
  const { sessionId } = req.params;
  const proofRequest: ProofRequest = req.body;

  try {
    let template: Template;
    if (typeof proofRequest.template === "string") {
      template = await templateLoader.loadTemplate(proofRequest.template);
    } else {
      template = proofRequest.template;
    }

    const dataExtractor = dataExtractors.get(sessionId);
    const tlsCapture = tlsCaptures.get(sessionId);

    if (!dataExtractor || !tlsCapture) {
      throw new Error("Session not properly initialized");
    }

    const extractedData = await dataExtractor.extractData(template.selectors);
    const tlsData = await tlsCapture.getSessionForDomain(template.domain);

    if (!tlsData) {
      throw new Error("No TLS data captured for domain");
    }

    const proof = await proofGenerator.generateProof(
      sessionId,
      template,
      proofRequest.claim,
      extractedData,
      tlsData,
    );

    const response: APIResponse = {
      success: true,
      data: proof,
      timestamp: Date.now(),
    };

    res.json(response);
  } catch (error) {
    logger.error("Proof generation failed:", error);
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Proof generation failed",
      timestamp: Date.now(),
    };
    res.status(500).json(response);
  }
}

// Template Management Handlers
export async function listTemplates(
  _req: Request,
  res: Response,
): Promise<void> {
  const templates = templateLoader.listTemplates();

  const response: APIResponse = {
    success: true,
    data: templates,
    timestamp: Date.now(),
  };

  res.json(response);
}

export async function getTemplate(req: Request, res: Response): Promise<void> {
  const { name } = req.params;

  const template = templateLoader.getTemplate(name);

  if (!template) {
    const response: APIResponse = {
      success: false,
      error: "Template not found",
      timestamp: Date.now(),
    };
    res.status(404).json(response);
    return;
  }

  const response: APIResponse = {
    success: true,
    data: template,
    timestamp: Date.now(),
  };

  res.json(response);
}

export async function createTemplate(
  req: Request,
  res: Response,
): Promise<void> {
  const template: Template = req.body;

  try {
    const name = template.name.toLowerCase().replace(/\s+/g, "-");
    await templateLoader.saveTemplate(name, template);

    const response: APIResponse = {
      success: true,
      data: { name, template },
      timestamp: Date.now(),
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error("Failed to create template:", error);
    const response: APIResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create template",
      timestamp: Date.now(),
    };
    res.status(500).json(response);
  }
}

export async function updateTemplate(
  req: Request,
  res: Response,
): Promise<void> {
  const { name } = req.params;
  const template: Template = req.body;

  try {
    await templateLoader.saveTemplate(name, template);

    const response: APIResponse = {
      success: true,
      data: { name, template },
      timestamp: Date.now(),
    };

    res.json(response);
  } catch (error) {
    logger.error("Failed to update template:", error);
    const response: APIResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update template",
      timestamp: Date.now(),
    };
    res.status(500).json(response);
  }
}

export async function deleteTemplate(
  req: Request,
  res: Response,
): Promise<void> {
  const { name } = req.params;

  try {
    await templateLoader.deleteTemplate(name);

    const response: APIResponse = {
      success: true,
      data: { message: "Template deleted" },
      timestamp: Date.now(),
    };

    res.json(response);
  } catch (error) {
    logger.error("Failed to delete template:", error);
    const response: APIResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete template",
      timestamp: Date.now(),
    };
    res.status(500).json(response);
  }
}

// Proof Verification Handlers
export async function verifyProof(req: Request, res: Response): Promise<void> {
  const proof = req.body;

  try {
    const isValid = await proofGenerator.verifyProof(proof);

    const response: APIResponse = {
      success: true,
      data: { valid: isValid },
      timestamp: Date.now(),
    };

    res.json(response);
  } catch (error) {
    logger.error("Proof verification failed:", error);
    const response: APIResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Proof verification failed",
      timestamp: Date.now(),
    };
    res.status(500).json(response);
  }
}

export async function submitProof(req: Request, res: Response): Promise<void> {
  const { proof, chainId } = req.body;

  try {
    const chain = chainManager.getChain(chainId || 1);
    if (!chain) {
      throw new Error("Chain not supported");
    }

    const contractClient = new ContractClient(
      chain.rpcUrl,
      chain.chain.id,
      chain.contractAddress,
    );

    const result = await contractClient.verifyProof(proof);

    const response: APIResponse = {
      success: true,
      data: result,
      timestamp: Date.now(),
    };

    res.json(response);
  } catch (error) {
    logger.error("Proof submission failed:", error);
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Proof submission failed",
      timestamp: Date.now(),
    };
    res.status(500).json(response);
  }
}

// Chain Management Handlers
export async function listChains(_req: Request, res: Response): Promise<void> {
  const chains = chainManager.getSupportedChains().map((id) => ({
    id,
    name: chainManager.getChainName(id),
    info: chainManager.getChainInfo(id),
  }));

  const response: APIResponse = {
    success: true,
    data: chains,
    timestamp: Date.now(),
  };

  res.json(response);
}

export async function getChainInfo(req: Request, res: Response): Promise<void> {
  const chainId = parseInt(req.params.chainId);

  const info = chainManager.getChainInfo(chainId);

  if (!info) {
    const response: APIResponse = {
      success: false,
      error: "Chain not found",
      timestamp: Date.now(),
    };
    res.status(404).json(response);
    return;
  }

  const response: APIResponse = {
    success: true,
    data: info,
    timestamp: Date.now(),
  };

  res.json(response);
}

export async function setActiveChain(
  req: Request,
  res: Response,
): Promise<void> {
  const chainId = parseInt(req.params.chainId);

  try {
    chainManager.setActiveChain(chainId);

    const response: APIResponse = {
      success: true,
      data: { chainId, message: "Active chain updated" },
      timestamp: Date.now(),
    };

    res.json(response);
  } catch (error) {
    logger.error("Failed to set active chain:", error);
    const response: APIResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to set active chain",
      timestamp: Date.now(),
    };
    res.status(500).json(response);
  }
}

// Health & Status Handlers
export async function healthCheck(_req: Request, res: Response): Promise<void> {
  const response: APIResponse = {
    success: true,
    data: { status: "healthy", uptime: process.uptime() },
    timestamp: Date.now(),
  };

  res.json(response);
}

export async function getStatus(_req: Request, res: Response): Promise<void> {
  const status = {
    sessions: lifecycleManager.getSessionCount(),
    templates: templateLoader.listTemplates().length,
    chains: chainManager.getSupportedChains().length,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  const response: APIResponse = {
    success: true,
    data: status,
    timestamp: Date.now(),
  };

  res.json(response);
}

// Alias for compatibility
export const health = healthCheck;

// WebSocket Handler
export function streamSession(ws: WebSocket, req: Request): void {
  const { sessionId } = req.params;

  ws.on("message", (message) => {
    logger.debug(`WebSocket message for session ${sessionId}:`, message);
  });

  ws.on("close", () => {
    logger.debug(`WebSocket closed for session ${sessionId}`);
  });

  ws.send(JSON.stringify({ type: "connected", sessionId }));
}
