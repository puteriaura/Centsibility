import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nodePolyfills } from "vite-plugin-node-polyfills";

function prerenderLandingPlugin(): Plugin {
  const heroHtml = `<div id="prerender-landing" class="landing-hero landing-wrap" style="max-width:1120px;margin:0 auto;padding:72px 24px 48px;font-family:'Lexend',system-ui,sans-serif">
    <div class="landing-hero-copy">
      <span class="landing-kicker" style="display:block;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#5F6B82;margin:0 0 12px">For kids aged 6 to 17</span>
      <h1 style="font-family:'Baloo 2',system-ui,sans-serif;font-size:clamp(2.25rem,5vw,3.75rem);line-height:1.05;font-weight:800;margin:0 0 16px">Pocket money that teaches.</h1>
      <p class="landing-lead" style="font-size:1.0625rem;line-height:1.6;color:#475569;max-width:540px;margin:0 0 28px">Your child saves for something they want, gives a little to others and borrows from family without interest. You see every step and approve what leaves their wallet.</p>
      <div class="landing-actions" style="display:flex;gap:12px;flex-wrap:wrap">
        <a href="/login" style="display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;border-radius:14px;background:#DDC518;color:#262101;font-weight:700;text-decoration:none;border:1px solid #7D6F09">Parent sign in</a>
        <a href="/kid-login" style="display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;border-radius:14px;border:1px solid #CBD5E1;color:inherit;font-weight:600;text-decoration:none">Young saver sign in</a>
      </div>
    </div>
    <figure class="landing-photo" style="margin:24px 0 0">
      <img src="/images/bicycle-park.webp" alt="A child's blue bicycle with a yellow helmet, parked by a lake" width="1200" height="600" fetchpriority="high" style="width:100%;height:auto;border-radius:16px;display:block" />
    </figure>
  </div>`;
  return {
    name: "prerender-landing",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace('<div id="root"></div>', `<div id="root">${heroHtml}</div>`);
    },
  };
}

export default defineConfig({
  plugins: [
    nodePolyfills(),
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsConfigPaths(),
    prerenderLandingPlugin(),
  ],
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase/")) return "vendor-supabase";
          if (id.includes("framer-motion") || id.includes("/motion/")) return "vendor-motion";
          if (id.includes("@tanstack/")) return "vendor-router";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) return "vendor-react";
        },
      },
    },
  },
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
      "node:async_hooks": "/src/lib/empty.ts",
      "async_hooks": "/src/lib/empty.ts",
    },
  },
});
