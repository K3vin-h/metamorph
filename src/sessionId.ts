import * as fs from "fs";

/** Stable session id for warm-up counting across Claude Code, Cursor, and Codex hooks. */
export function resolveSessionId(): string {
  if (process.env.CLAUDE_SESSION_ID) {
    return process.env.CLAUDE_SESSION_ID;
  }

  const transcriptPath = process.env.CURSOR_TRANSCRIPT_PATH;
  if (transcriptPath) {
    const match = transcriptPath.match(/agent-transcripts\/([^/]+)\//);
    if (match) return `cursor-${match[1]}`;
  }

  try {
    if (!process.stdin.isTTY) {
      const raw = fs.readFileSync(0, "utf8").trim();
      if (raw) {
        const payload = JSON.parse(raw) as { session_id?: string };
        if (typeof payload.session_id === "string" && payload.session_id.length > 0) {
          return payload.session_id;
        }
      }
    }
  } catch {
    // Hook hosts may not pass stdin JSON — fall through to timestamp id.
  }

  return `session-${Date.now()}`;
}
