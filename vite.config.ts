import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // Override with HEARTH_API when the backend runs on another port
        // (e.g. two checkouts side by side).
        target: process.env.HEARTH_API ?? "http://127.0.0.1:8010",
        changeOrigin: true,
      },
    },
  },
});
