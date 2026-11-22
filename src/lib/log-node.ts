import { logEvent } from "@/lib/log";
import { logLevel } from "@/lib/env";
import { APP_VERSION } from "@/lib/version";

let started = false;

export function logProcessLifecycle() {
  if (started) return;
  started = true;
  logEvent("info", "app.start", {
    source: "app",
    version: APP_VERSION,
    nodeEnv: process.env.NODE_ENV,
    logLevel: logLevel(),
    pid: process.pid,
  });

  let signal: string | null = null;
  for (const name of ["SIGINT", "SIGTERM"] as const) process.once(name, () => { signal = name; });
  process.once("exit", (code) => {
    logEvent("info", "app.stop", {
      source: "app",
      version: APP_VERSION,
      nodeEnv: process.env.NODE_ENV,
      signal,
      exitCode: code,
      uptimeSec: Math.round(process.uptime()),
    });
  });
}
