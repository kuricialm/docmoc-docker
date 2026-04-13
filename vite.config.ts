import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { ChildProcess, spawn } from "child_process";

function expressBackend() {
  let proc: ChildProcess | null = null;
  return {
    name: 'express-backend',
    configureServer() {
      if (proc) return;
      proc = spawn('node', ['server.cjs'], {
        cwd: path.resolve(__dirname),
        stdio: 'inherit',
        env: { ...process.env, PORT: '3001', DATA_DIR: path.join(__dirname, 'data') },
      });
      proc.on('error', (err) => console.error('[express-backend]', err.message));
      proc.on('exit', (code) => { console.log('[express-backend] exited', code); proc = null; });
    },
    closeBundle() {
      proc?.kill();
      proc = null;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "development" && expressBackend(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
