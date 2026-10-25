import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    nodePolyfills(),
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsConfigPaths(),
  ],
  server: {
    port: 3000,
    host: true,
    // Worktrees and unpacked tools live inside this folder; their edits must not reload the app.
    watch: { ignored: ["**/.claude/**", "**/analysis/private/**", "**/hyperframes-main/**"] },
  },
  // Scan dependencies from the app entry only, not every HTML file in the folder.
  optimizeDeps: { entries: ["index.html"] },
  resolve: {
    alias: {
      'node:async_hooks': '/src/lib/empty.ts',
      'async_hooks': '/src/lib/empty.ts',
    },
  },

});
