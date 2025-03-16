import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import type { ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "localhost",
    port: 3000,
    strictPort: true,
    proxy: {
      // Proxy API requests to our API handler
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    {
      name: 'api-handler',
      configureServer(server: ViteDevServer) {
        // Import the API handler dynamically to avoid issues with ESM
        import('./src/server').then(({ apiHandler }) => {
          server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
            if (req.url?.startsWith('/api')) {
              try {
                // Convert Express request to standard Request
                const request = new Request(`http://${req.headers.host}${req.url}`, {
                  method: req.method,
                  headers: new Headers(req.headers as Record<string, string>),
                  body: req.method !== 'GET' && req.method !== 'HEAD' ? await readBody(req) : undefined,
                });

                // Handle the request with our API handler
                const response = await apiHandler(request);

                // Convert Response to Express response
                res.statusCode = response.status;
                response.headers.forEach((value, key) => {
                  res.setHeader(key, value);
                });

                res.end(await response.text());
              } catch (error) {
                console.error('Error handling API request:', error);
                res.statusCode = 500;
                res.end('Internal Server Error');
              }
            } else {
              next();
            }
          });
        }).catch(err => {
          console.error('Failed to load API handler:', err);
          // Continue server startup even if API handler fails to load
          // This allows the React app to run even if the API handler has issues
        });
      }
    }
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  }
}));

// Helper function to read the request body
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
  });
}
