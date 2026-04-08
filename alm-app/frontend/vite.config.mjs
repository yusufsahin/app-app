import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HTML_STYLE = `
  :root{--primary:#6366f1;--muted:#64748b}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#0f172a;line-height:1.65}
  .top-bar{position:sticky;top:0;z-index:10;background:#fff;border-bottom:1px solid #e2e8f0;padding:.6rem 1.5rem;display:flex;align-items:center;gap:.75rem;font-size:.875rem}
  .top-bar a.back{color:var(--muted);text-decoration:none;border:1px solid #e2e8f0;border-radius:6px;padding:.2rem .7rem}
  .top-bar a.back:hover{background:#f8fafc}
  .lang-label{color:var(--muted);margin-left:auto}
  .lang-btn{padding:.2rem .75rem;border-radius:6px;border:1px solid #e2e8f0;background:transparent;font-size:.875rem;cursor:pointer;text-decoration:none;color:#0f172a}
  .lang-btn.active{background:var(--primary);color:#fff;border-color:var(--primary)}
  main{max-width:56rem;margin:0 auto;padding:2rem 1.5rem 5rem}
  h1{font-size:1.875rem;font-weight:700;letter-spacing:-.025em;border-bottom:1px solid #e2e8f0;padding-bottom:.5rem;margin-bottom:1.5rem;margin-top:.5rem}
  h2{font-size:1.35rem;font-weight:600;margin:2.5rem 0 .6rem;padding-top:.25rem}
  h3{font-size:1.1rem;font-weight:600;margin:1.5rem 0 .4rem}
  h4{font-weight:600;margin:.75rem 0 .25rem}
  p{color:var(--muted);margin:.45rem 0}
  li{color:var(--muted);margin:.2rem 0}
  ul,ol{padding-left:1.5rem;margin:.4rem 0}
  a{color:var(--primary);text-underline-offset:3px}
  code{background:#f1f5f9;padding:.1em .35em;border-radius:4px;font-size:.875em;font-family:ui-monospace,monospace}
  pre{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:1rem;overflow-x:auto;margin:.75rem 0}
  pre code{background:transparent;padding:0;font-size:.85em}
  blockquote{border-left:3px solid #e2e8f0;padding-left:1rem;color:var(--muted);font-style:italic;margin:.75rem 0}
  table{width:100%;border-collapse:collapse;font-size:.9rem;margin:.75rem 0}
  th{background:#f8fafc;border:1px solid #e2e8f0;padding:.5rem .75rem;font-weight:600;text-align:left}
  td{border:1px solid #e2e8f0;padding:.45rem .75rem;color:var(--muted)}
  hr{border:none;border-top:1px solid #e2e8f0;margin:1.75rem 0}
  strong{color:#0f172a;font-weight:600}
  img{max-width:100%;border-radius:6px}
`;

function buildTutorialHtml({ lang, title, otherFile, otherLabel, content }) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
  <style>${HTML_STYLE}</style>
</head>
<body>
  <div class="top-bar">
    <a class="back" href="/">&#8592; Back to app</a>
    <span class="lang-label">Language:</span>
    <a class="lang-btn active" href="#">${lang === "en" ? "English" : "Türkçe"}</a>
    <a class="lang-btn" href="${otherFile}" target="_blank" rel="noopener noreferrer">${otherLabel}</a>
  </div>
  <main>${content}</main>
</body>
</html>`;
}

/** Convert repo docs/USER_TUTORIAL_*.md to styled HTML in public/docs/ */
function syncUserTutorialMarkdown() {
  return {
    name: "sync-user-tutorial-markdown",
    buildStart() {
      const repoDocs = path.resolve(__dirname, "../docs");
      const outDir = path.resolve(__dirname, "public/docs");
      fs.mkdirSync(outDir, { recursive: true });

      const files = [
        { md: "USER_TUTORIAL_EN.md", html: "USER_TUTORIAL_EN.html", lang: "en", title: "ALM User Guide",            otherFile: "USER_TUTORIAL_TR.html", otherLabel: "Türkçe"  },
        { md: "USER_TUTORIAL_TR.md", html: "USER_TUTORIAL_TR.html", lang: "tr", title: "ALM Kullanıcı Kılavuzu", otherFile: "USER_TUTORIAL_EN.html", otherLabel: "English" },
      ];

      for (const f of files) {
        const src = path.join(repoDocs, f.md);
        if (!fs.existsSync(src)) {
          console.warn(`[sync-user-tutorial-markdown] Missing ${src}`);
          continue;
        }
        const md = fs.readFileSync(src, "utf-8");
        const content = marked.parse(md);
        const html = buildTutorialHtml({ lang: f.lang, title: f.title, otherFile: f.otherFile, otherLabel: f.otherLabel, content });
        fs.writeFileSync(path.join(outDir, f.html), html, "utf-8");
        console.log(`[sync-user-tutorial-markdown] Generated ${f.html}`);
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
