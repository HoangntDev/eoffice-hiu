// Structured JSON logging for Route Handlers. Never log PDF contents, PINs or tokens.
type Level = "debug" | "info" | "warn" | "error";

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): Level {
  const configured = process.env.LOG_LEVEL as Level | undefined;
  return configured && configured in order ? configured : "info";
}

export function requestIdFrom(request: Request): string {
  const incoming = request.headers.get("x-request-id");
  return incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
}

export function logEvent(level: Level, event: string, fields: Record<string, unknown> = {}) {
  if (order[level] < order[minLevel()]) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
