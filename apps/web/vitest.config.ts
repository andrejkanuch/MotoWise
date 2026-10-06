import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // React 17+ automatic runtime, as Next compiles it: lets a .test.ts render
  // components (react-dom/server) without `import React` in every .tsx file.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
