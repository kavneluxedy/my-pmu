import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy vers l'API pour éviter les soucis de CORS en développement.
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
