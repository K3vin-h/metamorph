import type { AgentProfile, AnalysisTotals, Config, Flag, FlagType, MistakePattern } from "../types.js";
import { scrubSecrets } from "../security.js";

interface TargetData {
  id: string;
  path: string;
  invocations: number;
  declaredTools: string[];
  usedTools: string[];
  sections: string[];
  rawContent: string;
  loads: number;
  applied: number;
  mistakePatterns?: MistakePattern[];
}

// Keywords that suggest a section's content is being exercised
const SECTION_KEYWORDS: Record<string, string[]> = {
  "security": ["security", "auth", "secret", "permission", "credential"],
  "testing": ["test", "spec", "coverage", "assert", "tdd"],
  "review": ["review", "lint", "check", "audit", "verify"],
  "rollback": ["rollback", "restore", "undo", "revert"],
  "setup": ["setup", "install", "configure", "init", "bootstrap"],
  "usage": ["when to use", "use when", "usage", "trigger", "invoke"],
  "output": ["output", "result", "response", "return", "format"],
  "steps": ["step", "process", "workflow", "procedure", "how"],
  "rules": ["rule", "must", "never", "always", "constraint", "guideline"],
};

function computeSectionScore(
  sections: string[],
  _rawContent: string,
  usedTools: string[]
): { score: number; deadSections: string[] } {
  if (sections.length === 0) return { score: 100, deadSections: [] };

  const deadSections: string[] = [];
  const usedToolsLower = usedTools.map((t) => t.toLowerCase());

  let hitCount = 0;
  for (const section of sections) {
    const headingText = section.replace(/^#+\s*/, "").toLowerCase();
    let hit = false;

    // Check if any section keyword category matches used tools
    for (const [, keywords] of Object.entries(SECTION_KEYWORDS)) {
      if (keywords.some((kw) => headingText.includes(kw))) {
        if (usedToolsLower.some((t) => keywords.some((kw) => t.includes(kw)))) {
          hit = true;
          break;
        }
      }
    }

    if (hit) {
      hitCount++;
    } else {
      deadSections.push(section);
    }
  }

  const score = sections.length > 0 ? (hitCount / sections.length) * 100 : 100;
  return { score, deadSections };
}

export function scoreTarget(
  data: TargetData,
  totals: AnalysisTotals,
  config: Config,
  kind: "agent" | "skill"
): AgentProfile {
  const { id, path, invocations, declaredTools, usedTools, sections, rawContent, loads, applied, mistakePatterns } = data;
  const readMode = config.read.transcripts;

  // Invocation score (40%)
  const totalRuns = kind === "agent" ? Math.max(1, totals.agentRuns) : Math.max(1, totals.skillLoads);
  const invocationScore = Math.min(100, (invocations / totalRuns) * 100 * 5); // *5 so ~20% usage = 100

  // Tool usage score (30%)
  const toolScore =
    declaredTools.length === 0
      ? 100
      : (usedTools.length / declaredTools.length) * 100;

  // Section coverage score (20%)
  const { score: sectionScore, deadSections } = computeSectionScore(
    sections,
    rawContent,
    usedTools
  );

  // Skill apply score (10%) — only meaningful for skills
  const skillApplyScore =
    kind === "skill" ? (loads === 0 ? 100 : (applied / loads) * 100) : 100;

  const combined = Math.round(
    invocationScore * 0.4 +
    toolScore * 0.3 +
    sectionScore * 0.2 +
    skillApplyScore * 0.1
  );

  // Generate flags
  const flags: Flag[] = [];

  if (invocations === 0) {
    flags.push({ type: kind === "skill" ? "never-applied-skill" : "never-invoked-agent", confidence: "high" });
  } else if (combined < config.flagThreshold) {
    flags.push({ type: "rarely-used-agent", confidence: "low" });
  } else if (combined >= 80) {
    flags.push({ type: "hot-path", confidence: "high" });
  }

  for (const tool of declaredTools) {
    if (!usedTools.includes(tool)) {
      // In redacted/off mode we can't see subagent tool calls, so tool-usage flags are uncertain
      const toolConfidence = readMode === "full" ? "high" : "low";
      flags.push({ type: "unused-tool", target: tool, confidence: toolConfidence });
    }
  }

  // Only flag dead sections when we have enough invocations to be confident.
  // With fewer invocations the section keyword matching produces too many false positives.
  if (invocations >= 5) {
    for (const section of deadSections) {
      // "dead-section" (high confidence) only in full mode where we can see tool call content.
      // In redacted/off mode, section coverage is a heuristic — always low confidence.
      const type: FlagType = readMode === "full" ? "dead-section" : "low-confidence-dead-section";
      const confidence: "high" | "low" = readMode === "full" ? "high" : "low";
      flags.push({ type, section, confidence });
    }
  }

  if (kind === "skill" && loads > 0 && applied === 0) {
    flags.push({ type: "never-applied-skill", confidence: "high" });
  }

  const mistakeCount = (mistakePatterns ?? []).reduce((s, p) => s + p.count, 0);
  if (mistakeCount >= 2) {
    flags.push({ type: "recurring-mistakes", confidence: mistakeCount >= 4 ? "high" : "low" });
  }

  // Build flagged section text (only for flagged sections, to keep analysis.json compact)
  const flaggedSectionText: Record<string, string> = {};
  for (const flag of flags) {
    if (flag.section) {
      const sectionContent = extractSectionContent(rawContent, flag.section);
      if (sectionContent) {
        flaggedSectionText[flag.section] = scrubSecrets(sectionContent);
      }
    }
  }

  return {
    id,
    path,
    score: Math.max(0, Math.min(100, combined)),
    invocations,
    declaredTools,
    usedTools,
    flags,
    ...(Object.keys(flaggedSectionText).length > 0 ? { flaggedSectionText } : {}),
  };
}

function extractSectionContent(content: string, sectionHeading: string): string {
  const lines = content.split("\n");
  const headingLevel = (sectionHeading.match(/^#+/) ?? [""])[0].length;
  let inSection = false;
  const sectionLines: string[] = [];

  for (const line of lines) {
    if (line.trim() === sectionHeading.trim()) {
      inSection = true;
      sectionLines.push(line);
      continue;
    }
    if (inSection) {
      const level = (line.match(/^#+/) ?? [""])[0].length;
      if (level > 0 && level <= headingLevel) break;
      sectionLines.push(line);
    }
  }

  return sectionLines.join("\n").trim();
}
