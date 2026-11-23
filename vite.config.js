import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Standalone admin panel for the DARA Blog API.
// Dev:  VITE_API_URL empty → requests go to /api/v1 and are proxied to the local backend (no CORS needed).
// Prod: VITE_API_URL=https://blog-api.example.com/api/v1 (set in .env.production or the host's env settings).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.DEV_BACKEND_URL || "http://localhost:8004";
  return {
    plugins: [react()],
    base: env.ADMIN_BASE || "/",
    server: {
      port: 5175,
      proxy: { "/api": backend, "/uploads": backend },
    },
    preview: { port: 4173 },
  };
});
