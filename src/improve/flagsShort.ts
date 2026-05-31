import type { AgentProfile } from "../types.js";

/** Short flag for tables and improve context (one primary flag). */
export function shortFlag(flags: AgentProfile["flags"]): string {
  if (flags.length === 0) return "ok";
  const f = flags[0];
  switch (f.type) {
    case "never-invoked-agent":
    case "never-applied-skill":
      return "inactive";
    case "rarely-used-agent":
      return "underused";
    case "hot-path":
      return "healthy";
    case "recurring-mistakes":
      return "correction";
    case "unused-tool":
      return "tool-gap";
    case "dead-section":
      return "stale-doc";
    case "low-confidence-dead-section":
      return "stale-doc?";
    default:
      return "ok";
  }
}

/** Table display: ok → em dash */
export function displayFlag(flags: AgentProfile["flags"]): string {
  const f = shortFlag(flags);
  return f === "ok" ? "—" : f;
}

export function isNeverInvoked(flags: AgentProfile["flags"]): boolean {
  const t = flags[0]?.type;
  return t === "never-invoked-agent" || t === "never-applied-skill";
}
