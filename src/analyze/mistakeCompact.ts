import type { MistakePattern } from "../types.js";

/** Same caps as other compact improve-context fields (flags, feedback, sections). */
const CONTEXT_MAX_PATTERNS = 3;
const CONTEXT_MAX_EXAMPLES = 2;
const CONTEXT_MAX_CHARS = 80;

export interface MistakeContextEntry {
  kind: string;
  tool: string;
  n: number;
  ex: Array<{ m: string; c?: string }>;
}

/** Ultra-compact mistake slice for improve-context files (LLM reads only this). */
export function mistakePatternsForContext(
  patterns: MistakePattern[] | undefined
): MistakeContextEntry[] | undefined {
  if (!patterns?.length) return undefined;

  return patterns.slice(0, CONTEXT_MAX_PATTERNS).map((p) => ({
    kind: p.kind,
    tool: p.tool,
    n: p.count,
    ex: p.examples.slice(0, CONTEXT_MAX_EXAMPLES).map((e) => ({
      m: e.mistake.slice(0, CONTEXT_MAX_CHARS),
      ...(e.correction ? { c: e.correction.slice(0, CONTEXT_MAX_CHARS) } : {}),
    })),
  }));
}
