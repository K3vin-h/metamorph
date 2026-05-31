/** Normalize Claude Code transcript JSONL lines (legacy + nested message format). */

export interface NormalizedTranscriptLine {
  lineType: string;
  role: string;
  content: unknown;
  timestamp: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function normalizeTranscriptLine(raw: unknown): NormalizedTranscriptLine | null {
  if (!isRecord(raw)) return null;

  const timestamp = typeof raw.timestamp === "string" ? raw.timestamp : new Date().toISOString();

  if (raw.type === "user" && isRecord(raw.message)) {
    const msg = raw.message;
    return {
      lineType: "user",
      role: typeof msg.role === "string" ? msg.role : "user",
      content: msg.content,
      timestamp,
    };
  }

  if (raw.type === "assistant" && isRecord(raw.message)) {
    const msg = raw.message;
    return {
      lineType: "assistant",
      role: typeof msg.role === "string" ? msg.role : "assistant",
      content: msg.content,
      timestamp,
    };
  }

  // Codex: { timestamp, type: "response_item", payload: { role, content } }
  if (raw.type === "response_item" && isRecord(raw.payload)) {
    const p = raw.payload;
    if ((p.role === "user" || p.role === "assistant") && typeof p.role === "string") {
      return { lineType: p.role, role: p.role, content: p.content, timestamp };
    }
  }

  if (typeof raw.role === "string") {
    // Cursor format: { role, message: { content } } — fall back to message.content
    const content = isRecord(raw.message) ? raw.message.content : raw.content;
    return {
      lineType: raw.role,
      role: raw.role,
      content,
      timestamp,
    };
  }

  return null;
}

export function contentBlocks(content: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(content)) return [];
  return content.filter(isRecord);
}
