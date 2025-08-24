import Docker from "dockerode";
import { EventEmitter } from "events";
import { ContainerConfig } from "../types";
import logger from "../utils/logger";

export class IsolationManager extends EventEmitter {
  private docker: Docker;
  private containers: Map<string, Docker.Container> = new Map();
  private config: ContainerConfig;
  private vncPortPool: Set<number> = new Set();

  constructor(config?: Partial<ContainerConfig>) {
    super();
    this.docker = new Docker({
      socketPath: process.env.DOCKER_HOST || "/var/run/docker.sock",
    });

    this.config = {
      image: "zephis/ephemeral-browser:latest",
      memory: "2g",
      cpuShares: 1024,
      timeout: 600000,
      network: "bridge",
      ...config,
    };

    // Validate memory format on construction
    if (config?.memory) {
      this.validateMemoryFormat(config.memory);
    }

    this.initializeVncPortPool();
  }

  private initializeVncPortPool(): void {
    const start = parseInt(process.env.VNC_PORT_RANGE_START || "5900");
    const end = parseInt(process.env.VNC_PORT_RANGE_END || "5999");

    for (let port = start; port <= end; port++) {
      this.vncPortPool.add(port);
    }
  }

  private getAvailableVncPort(): number | null {
    const port = this.vncPortPool.values().next().value;
    if (port) {
      this.vncPortPool.delete(port);
      return port;
    }
    return null;
  }

  private releaseVncPort(port: number): void {
    this.vncPortPool.add(port);
  }

  async createContainer(sessionId: string): Promise<Docker.Container> {
    try {
      logger.info(`Creating container for session ${sessionId}`);

      const vncPort = this.getAvailableVncPort();
      if (!vncPort) {
        throw new Error("No available VNC ports");
      }

      const container = await this.docker.createContainer({
        Image: this.config.image,
        name: `zephis-${sessionId}`,
        Hostname: `zephis-${sessionId}`,
        Env: [
          `SESSION_ID=${sessionId}`,
          `VNC_PORT=${vncPort}`,
          "DISPLAY=:99",
          "SCREEN_WIDTH=1920",
          "SCREEN_HEIGHT=1080",
          "SCREEN_DEPTH=24",
          "VNC_PASSWORD=zephis",
          ...Object.entries(this.config.environment || {}).map(
            ([key, value]) => `${key}=${value}`,
          ),
        ],
        HostConfig: {
          Memory: this.parseMemory(this.config.memory),
          CpuShares: this.config.cpuShares,
          AutoRemove: true,
          ReadonlyRootfs: false,
          SecurityOpt: ["no-new-privileges"],
          CapDrop: ["ALL"],
          CapAdd: ["SYS_ADMIN"],
          Tmpfs: {
            "/tmp": "rw,noexec,nosuid,size=1g",
            "/var/tmp": "rw,noexec,nosuid,size=512m",
          },
          PortBindings: {
            "5900/tcp": [{ HostPort: vncPort.toString() }],
            "6080/tcp": [{ HostPort: (vncPort + 100).toString() }],
          },
          NetworkMode: this.config.network,
          Dns: ["8.8.8.8", "8.8.4.4"],
        },
        ExposedPorts: {
          "5900/tcp": {},
          "6080/tcp": {},
        },
        AttachStdin: false,
        AttachStdout: true,
        AttachStderr: true,
        Tty: false,
        OpenStdin: false,
        StdinOnce: false,
      });

      await container.start();
      this.containers.set(sessionId, container);

      this.scheduleContainerDestruction(sessionId);

      this.emit("container:created", {
        sessionId,
        containerId: container.id,
        vncPort,
        webVncPort: vncPort + 100,
      });

      logger.info(
        `Container created for session ${sessionId} with VNC port ${vncPort}`,
      );

      return container;
    } catch (error) {
      logger.error(
        `Failed to create container for session ${sessionId}:`,
        error,
      );
      throw error;
    }
  }

  private validateMemoryFormat(memory: string): void {
    const match = memory.toLowerCase().match(/^(\d+)([bkmg])?$/);
    if (!match) {
      throw new Error("Invalid memory format");
    }
  }

  private parseMemory(memory: string): number {
    const units: Record<string, number> = {
      b: 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
    };

    const match = memory.toLowerCase().match(/^(\d+)([bkmg])?$/);
    if (!match) {
      throw new Error(`Invalid memory format: ${memory}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2] || "b";

    return value * units[unit];
  }

  private scheduleContainerDestruction(sessionId: string): void {
    setTimeout(async () => {
      await this.destroyContainer(sessionId);
    }, this.config.timeout);
  }

  async getContainerInfo(
    sessionId: string,
  ): Promise<Docker.ContainerInspectInfo | null> {
    const container = this.containers.get(sessionId);
    if (!container) {
      return null;
    }

    try {
      return await container.inspect();
    } catch (error) {
      logger.error(
        `Failed to inspect container for session ${sessionId}:`,
        error,
      );
      return null;
    }
  }

  async executeCommand(sessionId: string, command: string[]): Promise<string> {
    const container = this.containers.get(sessionId);
    if (!container) {
      throw new Error(`No container found for session ${sessionId}`);
    }

    try {
      const exec = await container.exec({
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Detach: false });

      return new Promise((resolve, reject) => {
        let output = "";

        stream.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });

        stream.on("end", () => {
          resolve(output);
        });

        stream.on("error", reject);
      });
    } catch (error) {
      logger.error(
        `Failed to execute command in container ${sessionId}:`,
        error,
      );
      throw error;
    }
  }

  async destroyContainer(sessionId: string): Promise<void> {
    const container = this.containers.get(sessionId);
    if (!container) {
      return;
    }

    try {
      const info = await container.inspect();
      const vncPort = parseInt(
        info.HostConfig.PortBindings?.["5900/tcp"]?.[0]?.HostPort || "0",
      );

      if (vncPort) {
        this.releaseVncPort(vncPort);
      }

      await container.stop({ t: 5 });
      await container.remove({ force: true });

      this.containers.delete(sessionId);
      this.emit("container:destroyed", { sessionId });

      logger.info(`Container destroyed for session ${sessionId}`);
    } catch (error) {
      logger.error(
        `Error destroying container for session ${sessionId}:`,
        error,
      );

      try {
        await container.remove({ force: true });
        this.containers.delete(sessionId);
      } catch (forceError) {
        logger.error(
          `Failed to force remove container ${sessionId}:`,
          forceError,
        );
      }
    }
  }

  async destroyAll(): Promise<void> {
    const promises = Array.from(this.containers.keys()).map((sessionId) =>
      this.destroyContainer(sessionId),
    );
    await Promise.all(promises);
  }

  async cleanupStaleContainers(): Promise<void> {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          label: ["zephis=true"],
        },
      });

      for (const containerInfo of containers) {
        const container = this.docker.getContainer(containerInfo.Id);
        try {
          await container.remove({ force: true });
          logger.info(`Cleaned up stale container ${containerInfo.Id}`);
        } catch (error) {
          logger.error(
            `Failed to clean up container ${containerInfo.Id}:`,
            error,
          );
        }
      }
    } catch (error) {
      logger.error("Failed to cleanup stale containers:", error);
    }
  }
}
