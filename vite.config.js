/* global process */
// Este archivo corre en Node (dev server), no en el navegador.
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Monta los handlers serverless de api/ en el dev server de Vite.
 *
 * Así el modo proxy (VITE_USE_PROXY=true) es real también en desarrollo: el
 * navegador llama a /api/llm, este middleware ejecuta EXACTAMENTE el mismo
 * handler que corre en Vercel, y la API key vive solo en process.env del
 * servidor — nunca en el bundle.
 */
function serverlessDevPlugin() {
  return {
    name: 'serverless-dev',
    configureServer(server) {
      const montar = (ruta, importar) => {
        server.middlewares.use(ruta, (req, res) => {
          let raw = ''
          req.on('data', (c) => { raw += c })
          req.on('end', async () => {
            try {
              req.body = raw ? JSON.parse(raw) : {}
            } catch {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'JSON inválido' }))
              return
            }
            // Shim mínimo de la respuesta de Vercel (res.status().json())
            const shim = {
              status(code) { res.statusCode = code; return this },
              json(obj) {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(obj))
              },
            }
            try {
              const { default: handler } = await importar()
              await handler(req, shim)
            } catch (e) {
              console.error(`[serverless-dev] ${ruta}:`, e)
              if (!res.writableEnded) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: e.message }))
              }
            }
          })
        })
      }

      montar('/api/llm', () => import('./api/llm.js'))
      montar('/api/triage', () => import('./api/triage.js'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Las keys server-side (sin prefijo VITE_) no llegan a import.meta.env; los
  // handlers las leen de process.env, así que hay que ponerlas ahí en dev.
  const env = loadEnv(mode, process.cwd(), '')
  for (const k of ['GROQ_API_KEY', 'GEMINI_API_KEY']) {
    if (env[k] && !process.env[k]) process.env[k] = env[k]
  }

  return {
    plugins: [react(), serverlessDevPlugin()],
  }
})
