import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { include: ["pdf-lib"] },
  build: { target: "es2022", manifest: "asset-manifest.json" },
  server: { proxy: { "/api": "http://127.0.0.1:4881" } },
});
