import type { AgentProfile } from "../types.js";

/** Short flag for tables and improve context (one primary flag). */
export function shortFlag(flags: AgentProfile["flags"]): string {
  if (flags.length === 0) return "ok";
  const f = flags[0];
  switch (f.type) {
    case "never-invoked-agent":
    case "never-applied-skill":
      return "never";
    case "rarely-used-agent":
      return "rare";
    case "hot-path":
      return "hot";
    case "recurring-mistakes":
      return "mistake";
    case "unused-tool":
      return "tool";
    case "dead-section":
      return "dead";
    case "low-confidence-dead-section":
      return "dead?";
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
