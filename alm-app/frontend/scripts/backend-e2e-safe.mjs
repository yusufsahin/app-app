import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "../../backend");

const child = spawn(
  "uvicorn",
  ["alm.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"],
  {
    cwd: backendDir,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      ALM_DEBUG: "true",
      ALM_JWT_SECRET_KEY: process.env.ALM_JWT_SECRET_KEY ?? "dev-e2e-secret",
    },
  },
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
