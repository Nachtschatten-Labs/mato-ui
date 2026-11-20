import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    // Paper-server tests use node:test and run from `pnpm test:paper`.
    exclude: ['**/node_modules/**', '**/.git/**', 'solana-os/**'],
    globals: false,
    restoreMocks: true,
  },
})
