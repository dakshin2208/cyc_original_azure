import { fileURLToPath } from 'url'
import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration for the AI platform.
 *
 * Scope is limited to `lib/ai/**` unit tests. The `@/*` path alias mirrors the
 * project's `tsconfig.json` so tests can import from `@/lib/ai/...` exactly as
 * production code does.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'lib/ai/**/*.test.ts',
      'lib/knowledge/**/*.test.ts',
      'lib/retrieval/**/*.test.ts',
      'lib/recommendation/**/*.test.ts',
      'lib/opinion/**/*.test.ts',
      'components/chat/**/*.test.ts',
    ],
  },
})
