import * as fs from "fs";
import * as path from "path";

export function logHookError(pluginRoot: string, context: string, err: unknown): void {
  const msg = `[${new Date().toISOString()}] ${context}: ${err instanceof Error ? err.message : String(err)}\n`;
  try {
    const logPath = path.join(pluginRoot, "data", "hook-errors.log");
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, msg, "utf8");
  } catch {
    try {
      process.stderr.write(`[metamorph] ${msg}`);
    } catch {
      // Last resort — hooks must never throw
    }
  }
}

export function isNodeError(err: unknown, code: string): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as NodeJS.ErrnoException).code === code;
}
