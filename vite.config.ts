import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import removeConsole from "vite-plugin-remove-console";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/google-oauth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/proxy': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/google-sheets': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/config': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    mode === 'production' && removeConsole(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  }
}));
