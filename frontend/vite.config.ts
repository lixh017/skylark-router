import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In Tauri build mode, TAURI_ENV_TARGET_TRIPLE is set by the Tauri CLI.
// The WebView loads file:// and calls the Go sidecar via absolute URL —
// no proxy needed. The proxy is only used in plain web dev mode.
const isTauriBuild = process.env.TAURI_ENV_TARGET_TRIPLE !== undefined;

export default defineConfig({
  plugins: [react()],
  // Don't clear the terminal output in Tauri dev mode.
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    proxy: isTauriBuild
      ? {}
      : {
          "/api": {
            target: "http://localhost:16898",
            changeOrigin: true,
          },
          "/v1": {
            target: "http://localhost:16898",
            changeOrigin: true,
          },
        },
  },
});
