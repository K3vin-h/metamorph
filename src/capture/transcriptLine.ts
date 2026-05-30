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

  if (typeof raw.role === "string") {
    return {
      lineType: raw.role,
      role: raw.role,
      content: raw.content,
      timestamp,
    };
  }

  return null;
}

export function contentBlocks(content: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(content)) return [];
  return content.filter(isRecord);
}
