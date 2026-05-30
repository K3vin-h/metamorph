import { scrubSecrets } from "../security.js";

/** Matches compact caps used elsewhere (analysis.json, improve-context). */
const MAX_SUMMARY = 80;

const MISTAKE_RE =
  /\b(wrong|incorrect|not what i (wanted|asked|meant)|that(?:'s| is) not|doesn'?t work|still (?:broken|failing|wrong)|you missed|try again|not right|bad approach|that failed|didn'?t work|stop doing|don'?t do that|fix (?:this|that|it)|please fix)\b/i;

const CORRECTION_RE =
  /\b(instead(?:,| use)?|should (?:be|use)|correct (?:way|approach)|the fix is|do it (?:like|this way)|replace .+ with|use .+ not |rather than|what i (?:want|need) is)\b/i;

const TOOL_REJECTED_RE =
  /\b(doesn'?t want to proceed|tool use was rejected|was not written|stop what you are doing)\b/i;

export interface ClassifiedUserFix {
  confidence: "high" | "low";
  mistakeSummary: string;
  correctionSummary?: string;
}

function trimSummary(text: string): string {
  const cleaned = scrubSecrets(text.replace(/\s+/g, " ").trim());
  if (cleaned.length <= MAX_SUMMARY) return cleaned;
  return cleaned.slice(0, MAX_SUMMARY - 3) + "...";
}

export function isRejectedToolResult(summary: string): boolean {
  return TOOL_REJECTED_RE.test(summary);
}

/** User sent a plain-text message to fix something after a completed tool run. */
export function classifyUserFixMessage(
  text: string,
  mode: "full" | "redacted" | "off"
): ClassifiedUserFix | null {
  if (mode === "off" || !text.trim()) return null;

  const isMistake = MISTAKE_RE.test(text);
  const isCorrection = CORRECTION_RE.test(text);
  if (!isMistake && !isCorrection) return null;

  const confidence: "high" | "low" = isMistake && isCorrection ? "high" : "low";

  if (mode === "redacted") {
    return {
      confidence,
      mistakeSummary: "User asked to fix output after a completed tool run",
      correctionSummary: isCorrection ? "User described a preferred approach" : undefined,
    };
  }

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  let mistakeSummary = "";
  let correctionSummary: string | undefined;

  for (const s of sentences) {
    if (!mistakeSummary && MISTAKE_RE.test(s)) mistakeSummary = trimSummary(s);
    if (!correctionSummary && CORRECTION_RE.test(s)) correctionSummary = trimSummary(s);
  }

  if (!mistakeSummary) mistakeSummary = trimSummary(text.slice(0, MAX_SUMMARY));
  if (isCorrection && !correctionSummary) correctionSummary = trimSummary(text.slice(0, MAX_SUMMARY));

  return { confidence, mistakeSummary, correctionSummary };
}

export function extractUserText(content: unknown): string | null {
  if (typeof content === "string") return content.trim() || null;

  const blocks = Array.isArray(content) ? content : [];
  const parts: string[] = [];

  for (const block of blocks) {
    if (typeof block !== "object" || block === null) continue;
    const b = block as Record<string, unknown>;
    if (b.type === "tool_result") continue;
    if (typeof b.text === "string") parts.push(b.text);
    else if (typeof b.content === "string") parts.push(b.content);
  }

  const joined = parts.join("\n").trim();
  return joined || null;
}

export interface ToolResultInfo {
  toolUseId: string;
  isError: boolean;
  summary: string;
}

export function extractToolResults(content: unknown): ToolResultInfo[] {
  if (!Array.isArray(content)) return [];
  const results: ToolResultInfo[] = [];

  for (const block of content) {
    if (typeof block !== "object" || block === null) continue;
    const b = block as Record<string, unknown>;
    if (b.type !== "tool_result" || typeof b.tool_use_id !== "string") continue;

    const isError = b.is_error === true;
    let summary = "";
    if (typeof b.content === "string") {
      summary = b.content;
    } else if (Array.isArray(b.content)) {
      summary = b.content
        .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
        .map((x) => (typeof x.text === "string" ? x.text : ""))
        .join(" ");
    }

    results.push({
      toolUseId: b.tool_use_id,
      isError,
      summary: trimSummary(summary.slice(0, 200)) || "completed",
    });
  }

  return results;
}
