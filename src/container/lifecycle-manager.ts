import { v4 as uuidv4 } from "uuid";
import { EventEmitter } from "events";
import { BrowserManager } from "./browser-manager";
import { IsolationManager } from "./isolation-manager";
import { ZephisSession, SessionStatus } from "../types";
import logger from "../utils/logger";

export class LifecycleManager extends EventEmitter {
  private sessions: Map<string, ZephisSession> = new Map();
  private browserManager: BrowserManager;
  private isolationManager: IsolationManager;
  private sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.browserManager = new BrowserManager();
    this.isolationManager = new IsolationManager();

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.browserManager.on("browser:created", ({ sessionId }) => {
      this.updateSessionStatus(sessionId, SessionStatus.READY);
    });

    this.browserManager.on("browser:destroyed", ({ sessionId }) => {
      this.cleanupSession(sessionId);
    });

    this.isolationManager.on(
      "container:created",
      ({ sessionId, vncPort, webVncPort }) => {
        const session = this.sessions.get(sessionId);
        if (session) {
          session.vncUrl = `vnc://localhost:${vncPort}`;
          session.browserUrl = `http://localhost:${webVncPort}`;
        }
      },
    );

    this.isolationManager.on("container:destroyed", ({ sessionId }) => {
      this.sessions.delete(sessionId);
    });
  }

  async createSession(): Promise<ZephisSession> {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 600000);

    const session: ZephisSession = {
      id: sessionId,
      containerId: "",
      browserUrl: "",
      vncUrl: "",
      status: SessionStatus.INITIALIZING,
      createdAt: now,
      expiresAt,
    };

    this.sessions.set(sessionId, session);
    logger.info(`Creating session ${sessionId}`);

    try {
      const container = await this.isolationManager.createContainer(sessionId);
      session.containerId = container.id;

      await new Promise((resolve) => setTimeout(resolve, 5000));

      await this.browserManager.createBrowser(sessionId);

      this.updateSessionStatus(sessionId, SessionStatus.READY);

      this.scheduleSessionExpiry(sessionId);

      this.emit("session:created", session);

      return session;
    } catch (error) {
      logger.error(`Failed to create session ${sessionId}:`, error);
      session.status = SessionStatus.FAILED;
      await this.destroySession(sessionId);
      throw error;
    }
  }

  private updateSessionStatus(sessionId: string, status: SessionStatus): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      this.emit("session:status", { sessionId, status });
      logger.info(`Session ${sessionId} status updated to ${status}`);
    }
  }

  private scheduleSessionExpiry(sessionId: string): void {
    const timeout = setTimeout(async () => {
      logger.info(`Session ${sessionId} expired`);
      await this.destroySession(sessionId);
    }, 600000);

    this.sessionTimeouts.set(sessionId, timeout);
  }

  async navigateToTarget(sessionId: string, url: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (
      session.status !== SessionStatus.READY &&
      session.status !== SessionStatus.ACTIVE
    ) {
      throw new Error(`Session ${sessionId} is not ready`);
    }

    this.updateSessionStatus(sessionId, SessionStatus.ACTIVE);
    await this.browserManager.navigateTo(sessionId, url);
  }

  async waitForUserLogin(
    sessionId: string,
    expectedUrl?: string,
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    logger.info(`Waiting for user to complete login for session ${sessionId}`);

    const page = this.browserManager.getPage(sessionId);
    if (!page) {
      throw new Error(`No page found for session ${sessionId}`);
    }

    return new Promise((resolve, reject) => {
      let timeout: NodeJS.Timeout;
      const checkInterval = setInterval(async () => {
        try {
          // Check if session was destroyed
          const currentSession = this.sessions.get(sessionId);
          if (
            !currentSession ||
            currentSession.status === SessionStatus.DESTROYED ||
            currentSession.status === SessionStatus.FAILED
          ) {
            clearInterval(checkInterval);
            if (timeout) clearTimeout(timeout);
            reject(new Error(`Session ${sessionId} terminated`));
            return;
          }

          const currentUrl = page.url();

          if (expectedUrl && currentUrl.includes(expectedUrl)) {
            clearInterval(checkInterval);
            if (timeout) clearTimeout(timeout);
            logger.info(`User login completed for session ${sessionId}`);
            resolve();
          }
        } catch (error) {
          clearInterval(checkInterval);
          if (timeout) clearTimeout(timeout);
          reject(error);
        }
      }, 2000);

      timeout = setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error("Login timeout"));
      }, 300000);
    });
  }

  async capturePageData(
    sessionId: string,
    selectors: Record<string, string>,
  ): Promise<Record<string, string>> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.updateSessionStatus(sessionId, SessionStatus.CAPTURING);

    try {
      const data = await this.browserManager.extractData(sessionId, selectors);
      logger.info(`Data captured for session ${sessionId}`, {
        fields: Object.keys(data),
      });
      return data;
    } finally {
      this.updateSessionStatus(sessionId, SessionStatus.ACTIVE);
    }
  }

  async getSession(sessionId: string): Promise<ZephisSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async destroySession(sessionId: string): Promise<void> {
    logger.info(`Destroying session ${sessionId}`);

    const timeout = this.sessionTimeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.sessionTimeouts.delete(sessionId);
    }

    this.updateSessionStatus(sessionId, SessionStatus.DESTROYED);

    await Promise.all([
      this.browserManager.destroyBrowser(sessionId),
      this.isolationManager.destroyContainer(sessionId),
    ]);

    this.sessions.delete(sessionId);
    this.emit("session:destroyed", { sessionId });
  }

  private async cleanupSession(sessionId: string): Promise<void> {
    const timeout = this.sessionTimeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.sessionTimeouts.delete(sessionId);
    }
    this.sessions.delete(sessionId);
  }

  async destroyAll(): Promise<void> {
    const promises = Array.from(this.sessions.keys()).map((sessionId) =>
      this.destroySession(sessionId),
    );
    await Promise.all(promises);
  }

  getActiveSessions(): ZephisSession[] {
    return Array.from(this.sessions.values());
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}
