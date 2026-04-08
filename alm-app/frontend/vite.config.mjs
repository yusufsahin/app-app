import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Copy repo `docs/USER_TUTORIAL_*.md` into `public/docs` so the SPA can fetch them at /docs/... */
function syncUserTutorialMarkdown() {
  return {
    name: "sync-user-tutorial-markdown",
    buildStart() {
      const repoDocs = path.resolve(__dirname, "../docs");
      const outDir = path.resolve(__dirname, "public/docs");
      fs.mkdirSync(outDir, { recursive: true });
      for (const name of ["USER_TUTORIAL_EN.md", "USER_TUTORIAL_TR.md"]) {
        const src = path.join(repoDocs, name);
        if (!fs.existsSync(src)) {
          console.warn(`[sync-user-tutorial-markdown] Missing ${src}`);
          continue;
        }
        fs.copyFileSync(src, path.join(outDir, name));
      }
    },
  };
}

export default defineConfig({
  plugins: [syncUserTutorialMarkdown(), react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("monaco-editor")) return "vendor-monaco";
          if (id.includes("@tiptap") || id.includes("prosemirror")) return "vendor-editor";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("@tanstack/react-query")) return "vendor-query";
          if (id.includes("react-router") || id.includes("history")) return "vendor-router";
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
