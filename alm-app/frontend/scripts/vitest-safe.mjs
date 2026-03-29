import childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { syncBuiltinESMExports } from "node:module";

function createNoopChildProcess() {
  const proc = new EventEmitter();
  proc.pid = 0;
  proc.stdin = null;
  proc.stdout = null;
  proc.stderr = null;
  proc.kill = () => false;
  proc.ref = () => proc;
  proc.unref = () => proc;
  return proc;
}

if (process.platform === "win32") {
  const originalExec = childProcess.exec;

  childProcess.exec = function patchedExec(command, ...args) {
    if (command === "net use") {
      const callback = args.at(-1);
      if (typeof callback === "function") {
        queueMicrotask(() => callback(null, "", ""));
      }
      return createNoopChildProcess();
    }
    return originalExec.call(this, command, ...args);
  };

  syncBuiltinESMExports();
}

const forwardedArgs = process.argv.slice(2);
const cliArgs = forwardedArgs.length > 0 ? forwardedArgs : ["--run"];
process.argv = ["node", "vitest", ...cliArgs];

await import("../node_modules/vitest/vitest.mjs");
