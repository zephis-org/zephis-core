import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        'test/',
        '*.config.*',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'threads',
    threads: {
      singleThread: false,
      minThreads: 2,
      maxThreads: 4,
    },
    reporters: ['verbose'],
    outputFile: {
      junit: './test-results/junit.xml',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@test': resolve(__dirname, './test'),
    },
  },
  define: {
    __TEST__: true,
  },
});