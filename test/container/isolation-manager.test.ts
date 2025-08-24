import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IsolationManager } from '../../src/container/isolation-manager';
import Docker from 'dockerode';

vi.mock('dockerode');

describe('IsolationManager', () => {
  let isolationManager: IsolationManager;
  let mockDocker: any;
  let mockContainer: any;

  beforeEach(() => {
    mockContainer = {
      id: 'container-123',
      start: vi.fn(),
      stop: vi.fn(),
      remove: vi.fn(),
      inspect: vi.fn(),
      exec: vi.fn()
    };

    mockDocker = {
      createContainer: vi.fn().mockResolvedValue(mockContainer),
      getContainer: vi.fn().mockReturnValue(mockContainer),
      listContainers: vi.fn().mockResolvedValue([])
    };

    (Docker as any).mockImplementation(() => mockDocker);

    isolationManager = new IsolationManager({
      image: 'test-image',
      memory: '1g',
      cpuShares: 512,
      timeout: 60000
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createContainer', () => {
    it('should create a container', async () => {
      const sessionId = 'test-session-123';
      const container = await isolationManager.createContainer(sessionId);

      expect(container).toBe(mockContainer);
      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: 'test-image',
          name: `zephis-${sessionId}`,
          Hostname: `zephis-${sessionId}`
        })
      );
      expect(mockContainer.start).toHaveBeenCalled();
    });

    it('should emit container:created event', async () => {
      const sessionId = 'test-session-123';
      const eventPromise = new Promise(resolve => {
        isolationManager.once('container:created', resolve);
      });

      await isolationManager.createContainer(sessionId);
      const event = await eventPromise;

      expect(event).toEqual(expect.objectContaining({
        sessionId,
        containerId: 'container-123',
        vncPort: expect.any(Number)
      }));
    });

    it('should handle creation errors', async () => {
      mockDocker.createContainer.mockRejectedValue(new Error('Creation failed'));

      await expect(isolationManager.createContainer('test-session'))
        .rejects.toThrow('Creation failed');
    });

    it('should handle no available VNC ports', async () => {
      // Use all available ports
      for (let i = 0; i < 100; i++) {
        await isolationManager.createContainer(`session-${i}`);
      }

      // Clear mock calls
      mockDocker.createContainer.mockClear();

      // Try to create one more container when no ports available
      await expect(isolationManager.createContainer('no-port-session'))
        .rejects.toThrow('No available VNC ports');
    });
  });

  describe('getContainerInfo', () => {
    beforeEach(async () => {
      await isolationManager.createContainer('test-session');
    });

    it('should get container info', async () => {
      const inspectData = {
        Id: 'container-123',
        State: { Running: true }
      };
      mockContainer.inspect.mockResolvedValue(inspectData);

      const info = await isolationManager.getContainerInfo('test-session');

      expect(info).toEqual(inspectData);
      expect(mockContainer.inspect).toHaveBeenCalled();
    });

    it('should return null for non-existent container', async () => {
      const info = await isolationManager.getContainerInfo('non-existent');
      expect(info).toBeNull();
    });

    it('should handle inspect errors', async () => {
      mockContainer.inspect.mockRejectedValue(new Error('Inspect failed'));

      const info = await isolationManager.getContainerInfo('test-session');
      expect(info).toBeNull();
    });
  });

  describe('executeCommand', () => {
    beforeEach(async () => {
      await isolationManager.createContainer('test-session');
    });

    it('should execute command in container', async () => {
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('command output'));
          } else if (event === 'end') {
            callback();
          }
        })
      };

      const mockExec = {
        start: vi.fn().mockResolvedValue(mockStream)
      };

      mockContainer.exec.mockResolvedValue(mockExec);

      const output = await isolationManager.executeCommand('test-session', ['echo', 'test']);

      expect(output).toBe('command output');
      expect(mockContainer.exec).toHaveBeenCalledWith({
        Cmd: ['echo', 'test'],
        AttachStdout: true,
        AttachStderr: true
      });
    });

    it('should throw error for non-existent container', async () => {
      await expect(isolationManager.executeCommand('non-existent', ['echo']))
        .rejects.toThrow('No container found for session non-existent');
    });

    it('should handle execution errors', async () => {
      mockContainer.exec.mockRejectedValue(new Error('Exec failed'));

      await expect(isolationManager.executeCommand('test-session', ['echo']))
        .rejects.toThrow('Exec failed');
    });
  });

  describe('destroyContainer', () => {
    beforeEach(async () => {
      await isolationManager.createContainer('test-session');
    });

    it('should destroy container', async () => {
      mockContainer.inspect.mockResolvedValue({
        HostConfig: {
          PortBindings: {
            '5900/tcp': [{ HostPort: '5900' }]
          }
        }
      });

      await isolationManager.destroyContainer('test-session');

      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 5 });
      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
    });

    it('should emit container:destroyed event', async () => {
      mockContainer.inspect.mockResolvedValue({
        HostConfig: { PortBindings: {} }
      });

      const eventPromise = new Promise(resolve => {
        isolationManager.once('container:destroyed', resolve);
      });

      await isolationManager.destroyContainer('test-session');
      const event = await eventPromise;

      expect(event).toEqual({ sessionId: 'test-session' });
    });

    it('should release VNC port', async () => {
      mockContainer.inspect.mockResolvedValue({
        HostConfig: {
          PortBindings: {
            '5900/tcp': [{ HostPort: '5900' }]
          }
        }
      });

      await isolationManager.destroyContainer('test-session');

      // Port should be available again
      const newContainer = await isolationManager.createContainer('new-session');
      expect(newContainer).toBeDefined();
    });

    it('should handle destroy errors gracefully', async () => {
      mockContainer.stop.mockRejectedValue(new Error('Stop failed'));
      mockContainer.inspect.mockResolvedValue({ HostConfig: {} });

      await isolationManager.destroyContainer('test-session');

      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
    });

    it('should do nothing for non-existent container', async () => {
      await isolationManager.destroyContainer('non-existent');
      expect(mockContainer.stop).not.toHaveBeenCalled();
    });
  });

  describe('destroyAll', () => {
    it('should destroy all containers', async () => {
      await isolationManager.createContainer('session1');
      await isolationManager.createContainer('session2');

      mockContainer.inspect.mockResolvedValue({ HostConfig: {} });

      await isolationManager.destroyAll();

      expect(mockContainer.stop).toHaveBeenCalledTimes(2);
      expect(mockContainer.remove).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanupStaleContainers', () => {
    it('should cleanup stale containers', async () => {
      const staleContainers = [
        { Id: 'stale1' },
        { Id: 'stale2' }
      ];

      mockDocker.listContainers.mockResolvedValue(staleContainers);

      await isolationManager.cleanupStaleContainers();

      expect(mockDocker.listContainers).toHaveBeenCalledWith({
        all: true,
        filters: { label: ['zephis=true'] }
      });

      expect(mockContainer.remove).toHaveBeenCalledTimes(2);
    });

    it('should handle cleanup errors', async () => {
      mockDocker.listContainers.mockRejectedValue(new Error('List failed'));

      await isolationManager.cleanupStaleContainers();

      expect(mockContainer.remove).not.toHaveBeenCalled();
    });
  });

  describe('parseMemory', () => {
    it('should parse memory values correctly', async () => {
      const testCases = [
        { input: '100b', expected: 100 },
        { input: '1k', expected: 1024 },
        { input: '2m', expected: 2 * 1024 * 1024 },
        { input: '1g', expected: 1024 * 1024 * 1024 }
      ];

      for (const { input, expected } of testCases) {
        const manager = new IsolationManager({ memory: input });
        const _container = await manager.createContainer(`test-${input}`);
        
        const createCall = mockDocker.createContainer.mock.calls.find(
          call => call[0].name === `zephis-test-${input}`
        );
        
        expect(createCall[0].HostConfig.Memory).toBe(expected);
      }
    });

    it('should throw error for invalid memory format', () => {
      expect(() => new IsolationManager({ memory: 'invalid' }))
        .toThrow('Invalid memory format');
    });
  });
});