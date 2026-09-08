import { defineConfig, loadEnv } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { deploymentEnvironment } from './deployment.config.ts'

export default defineConfig(({ mode, command }) => {
  const deploying = command === 'build'
  const env = deploymentEnvironment(
    deploying ? mode : 'preview',
    loadEnv(mode, process.cwd(), 'VITE_'),
  )
  // The Cloudflare target is selected at build time, never from a stale deploy flag.
  process.env.CLOUDFLARE_ENV =
    deploying && mode === 'production' ? 'production' : ''
  return {
    resolve: { tsconfigPaths: true },
    define: Object.fromEntries(
      Object.entries(env).map(([key, value]) => [
        `import.meta.env.${key}`,
        JSON.stringify(value),
      ]),
    ),
    plugins: [
      cloudflare({
        viteEnvironment: { name: 'ssr' },
        remoteBindings: false,
        inspectorPort: false,
      }),
      tailwindcss(),
      tanstackStart(),
      react(),
    ],
    server: { host: '127.0.0.1', strictPort: true },
    preview: { host: '127.0.0.1', strictPort: true },
  }
})
