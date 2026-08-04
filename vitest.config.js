import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // per-file override: `// @vitest-environment jsdom` for DOMParser/IDB tests
  },
})
