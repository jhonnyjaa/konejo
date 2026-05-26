import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Tauri usa puerto fijo en dev
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Ignora cambios en Rust para no recargar innecesariamente
      ignored: ["**/src-tauri/**"],
    },
  },
  // Variables de entorno disponibles en el frontend
  envPrefix: ["VITE_", "TAURI_"],
}));
