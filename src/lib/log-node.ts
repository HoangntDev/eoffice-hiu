// Ghi log ra file, chỉ nạp ở runtime Node (src/instrumentation.ts import động khi NEXT_RUNTIME === "nodejs").
// logs/app-YYYY-MM-DD.log, xoay theo ngày, giữ 7 file; mỗi dòng là đúng chuỗi JSON mà logEvent() tạo ra.
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { isLevelEnabled, formatLogLine, logEvent, setLogSink } from "@/lib/log";
import { logLevel } from "@/lib/env";
import { APP_VERSION } from "@/lib/version";

export const LOG_DIR = path.join(process.cwd(), "logs");
const MAX_FILES = 7;

function localDate(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

let started = false;

export function startFileLogging() {
  if (started) return;
  started = true;
  mkdirSync(LOG_DIR, { recursive: true });

  const transport = new DailyRotateFile({
    dirname: LOG_DIR,
    filename: "app-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxFiles: MAX_FILES,
    auditFile: path.join(LOG_DIR, ".app-log-audit.json"),
  });
  const logger = winston.createLogger({
    // Lọc mức đã làm ở logEvent(); ở đây nhận mọi dòng được chuyển tới.
    level: "debug",
    format: winston.format.printf((info) => String(info.message)),
    transports: [transport],
  });
  setLogSink((level, line) => logger.log({ level, message: line }));

  logEvent("info", "app.start", {
    source: "app",
    version: APP_VERSION,
    nodeEnv: process.env.NODE_ENV,
    logLevel: logLevel(),
    pid: process.pid,
  });

  // next start tự xử lý SIGINT/SIGTERM rồi gọi process.exit(). Ghi winston (bất đồng bộ) lúc đó dễ mất dòng,
  // nên app.stop được ghi đồng bộ trong handler "exit" vào đúng file của ngày hiện tại.
  let signal: string | null = null;
  for (const name of ["SIGINT", "SIGTERM"] as const) process.once(name, () => { signal = name; });
  process.once("exit", (code) => {
    if (!isLevelEnabled("info")) return;
    const line = formatLogLine("info", "app.stop", {
      source: "app",
      version: APP_VERSION,
      nodeEnv: process.env.NODE_ENV,
      signal,
      exitCode: code,
      uptimeSec: Math.round(process.uptime()),
    });
    console.info(line);
    try {
      appendFileSync(path.join(LOG_DIR, `app-${localDate()}.log`), `${line}\n`);
    } catch {
      // Không ghi được file khi đang thoát thì bỏ qua.
    }
  });
}
