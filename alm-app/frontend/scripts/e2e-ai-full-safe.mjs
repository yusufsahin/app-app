import { spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const backendDir = path.resolve(repoRoot, "backend");
const composeFile = path.resolve(repoRoot, "docker-compose.local.yml");

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: true,
    env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function isPortOpen(host, port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

const hasLocalInfra =
  (await isPortOpen("127.0.0.1", 5433)) && (await isPortOpen("127.0.0.1", 6379));

if (!process.env.ALM_E2E_SKIP_DOCKER && !hasLocalInfra) {
  const dockerCheck = spawnSync("docker", ["info"], { cwd: repoRoot, stdio: "pipe", shell: true });
  if (dockerCheck.status === 0) {
    run("docker", ["compose", "-f", composeFile, "up", "-d", "db", "redis"], repoRoot);
  } else {
    console.error(
      "Infra unavailable: PostgreSQL(5433) and Redis(6379) are down, and Docker daemon is not running.",
    );
    console.error(
      "Start Docker Desktop or run local services manually, then retry `npm run test:e2e:ai:full`.",
    );
    process.exit(1);
  }
}
run("uv", ["run", "alembic", "upgrade", "head"], backendDir);

run(
  "npx",
  ["playwright", "test", "--project=ai-smoke", "e2e/ai-smoke.spec.ts"],
  path.resolve(repoRoot, "frontend"),
  {
    ...process.env,
    PLAYWRIGHT_START_BACKEND: "1",
    ALM_DATABASE_URL:
      process.env.ALM_DATABASE_URL ?? "postgresql+asyncpg://alm:alm_dev_password@localhost:5433/alm",
    ALM_REDIS_URL: process.env.ALM_REDIS_URL ?? "redis://localhost:6379/0",
  },
);
