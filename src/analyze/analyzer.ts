import * as fs from "fs";
import * as path from "path";
import type { AnalysisResult, AnalysisTotals, SessionProfile } from "../types.js";
import { readProfileCache } from "../capture/incrementalCache.js";
import { parseHistory } from "../capture/historyParser.js";
import { loadConfig } from "../config.js";
import { readFeedbackEntries } from "../feedback.js";
import { scoreTarget } from "../score/scorer.js";
import { aggregateMistakePatterns } from "./mistakeAggregator.js";
import { getCount } from "../capture/sessionCounter.js";
import { parseFrontmatter } from "../utils.js";
import { logHookError } from "../hookErrors.js";

interface DefinitionFile {
  id: string;
  filePath: string;
  relativePath: string;
  declaredTools: string[];
  sections: string[];
  rawContent: string;
}

function extractSections(content: string): string[] {
  return content
    .split("\n")
    .filter((l) => l.startsWith("#"))
    .map((l) => l.trim());
}

function extractDeclaredTools(content: string): string[] {
  const fm = parseFrontmatter(content);
  if (fm.tools) {
    return fm.tools
      .replace(/[\[\]]/g, "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  const toolMatch = content.match(/\*\*Tools[:\s]+\*\*(.*?)(?:\n|$)/);
  if (toolMatch) {
    return toolMatch[1].split(/[,;]/).map((t) => t.trim()).filter(Boolean);
  }

  const parenMatch = content.match(/\(Tools?:\s*([^)]+)\)/i);
  if (parenMatch) {
    return parenMatch[1].split(",").map((t) => t.trim()).filter(Boolean);
  }

  return [];
}

function loadDefinitionFiles(
  claudeRoot: string,
  category: "agents" | "skills",
  pluginRoot: string
): DefinitionFile[] {
  const defs: DefinitionFile[] = [];
  const baseDir = path.join(claudeRoot, category === "agents" ? "agents" : "skills");

  if (!fs.existsSync(baseDir)) return defs;

  if (category === "agents") {
    for (const file of fs.readdirSync(baseDir)) {
      if (!file.endsWith(".md")) continue;
      const filePath = path.join(baseDir, file);
      try {
        const content = fs.readFileSync(filePath, "utf8");
        const fm = parseFrontmatter(content);
        const id = fm.name ?? file.replace(".md", "");
        defs.push({
          id,
          filePath,
          relativePath: path.join("agents", file),
          declaredTools: extractDeclaredTools(content),
          sections: extractSections(content),
          rawContent: content,
        });
      } catch (err) {
        logHookError(pluginRoot, `load-agent-def:${file}`, err);
      }
    }
  } else {
    for (const skillDir of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!skillDir.isDirectory()) continue;
      const skillMd = path.join(baseDir, skillDir.name, "SKILL.md");
      if (!fs.existsSync(skillMd)) continue;
      try {
        const content = fs.readFileSync(skillMd, "utf8");
        const fm = parseFrontmatter(content);
        const id = fm.name ?? skillDir.name;
        defs.push({
          id,
          filePath: skillMd,
          relativePath: path.join("skills", skillDir.name, "SKILL.md"),
          declaredTools: extractDeclaredTools(content),
          sections: extractSections(content),
          rawContent: content,
        });
      } catch (err) {
        logHookError(pluginRoot, `load-skill-def:${skillDir.name}`, err);
      }
    }
  }

  return defs;
}

function aggregateProfiles(sessions: Record<string, SessionProfile>): {
  agentInvocations: Record<string, number>;
  agentUsedTools: Record<string, Set<string>>;
  skillLoads: Record<string, number>;
  skillApplied: Record<string, number>;
  fileExtensions: Record<string, number>;
  totalToolCalls: number;
  totalAgentRuns: number;
  totalSkillLoads: number;
  skippedTranscriptLines: number;
} {
  const agentInvocations: Record<string, number> = {};
  const agentUsedTools: Record<string, Set<string>> = {};
  const skillLoads: Record<string, number> = {};
  const skillApplied: Record<string, number> = {};
  const fileExtensions: Record<string, number> = {};
  let totalToolCalls = 0;
  let totalAgentRuns = 0;
  let totalSkillLoads = 0;
  let skippedTranscriptLines = 0;

  for (const session of Object.values(sessions)) {
    if (!session?.toolCalls) continue;

    totalToolCalls += session.toolCalls.length;
    skippedTranscriptLines += session.skippedLines ?? 0;

    for (const [agentId, count] of Object.entries(session.agentInvocations)) {
      agentInvocations[agentId] = (agentInvocations[agentId] ?? 0) + count;
      totalAgentRuns += count;
    }

    for (const ev of session.toolCalls) {
      if (ev.agentId) {
        if (!agentUsedTools[ev.agentId]) agentUsedTools[ev.agentId] = new Set();
        agentUsedTools[ev.agentId].add(ev.toolName);
      }
    }

    for (const [skillId, count] of Object.entries(session.skillLoads)) {
      skillLoads[skillId] = (skillLoads[skillId] ?? 0) + count;
      totalSkillLoads += count;
    }

    for (const [skillId, count] of Object.entries(session.skillApplied)) {
      skillApplied[skillId] = (skillApplied[skillId] ?? 0) + count;
    }

    for (const [ext, count] of Object.entries(session.fileExtensions)) {
      fileExtensions[ext] = (fileExtensions[ext] ?? 0) + count;
    }
  }

  return {
    agentInvocations,
    agentUsedTools,
    skillLoads,
    skillApplied,
    fileExtensions,
    totalToolCalls,
    totalAgentRuns,
    totalSkillLoads,
    skippedTranscriptLines,
  };
}

function computeLanguages(fileExtensions: Record<string, number>): Record<string, number> {
  const total = Object.values(fileExtensions).reduce((s, n) => s + n, 0);
  if (total === 0) return {};
  const langs: Record<string, number> = {};
  for (const [ext, count] of Object.entries(fileExtensions)) {
    langs[ext.replace(/^\./, "")] = Math.round((count / total) * 100) / 100;
  }
  return langs;
}

export async function runAnalysis(pluginRoot: string, claudeRoot: string): Promise<AnalysisResult> {
  const config = loadConfig(pluginRoot);
  const cache = readProfileCache(pluginRoot);
  const history = await parseHistory(claudeRoot, config.read.denyGlobs);
  const feedback = readFeedbackEntries(pluginRoot);
  const sessionCount = getCount(pluginRoot);

  const agg = aggregateProfiles(cache.sessions);

  for (const [k, v] of Object.entries(history.skillLoads)) {
    agg.skillLoads[k] = (agg.skillLoads[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(history.skillApplied)) {
    agg.skillApplied[k] = (agg.skillApplied[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(history.fileExtensions)) {
    agg.fileExtensions[k] = (agg.fileExtensions[k] ?? 0) + v;
  }

  const totals: AnalysisTotals = {
    sessions: Object.keys(cache.sessions).length,
    toolCalls: agg.totalToolCalls,
    agentRuns: agg.totalAgentRuns,
    skillLoads: agg.totalSkillLoads,
    ...(agg.skippedTranscriptLines > 0 ? { skippedTranscriptLines: agg.skippedTranscriptLines } : {}),
  };

  const languages = computeLanguages(agg.fileExtensions);

  const agentDefs = loadDefinitionFiles(claudeRoot, "agents", pluginRoot);
  const agents = agentDefs.map((def) => {
    const invocations = agg.agentInvocations[def.id] ?? 0;
    const usedTools = [...(agg.agentUsedTools[def.id] ?? new Set())];
    const mistakePatterns = aggregateMistakePatterns(cache.sessions, pluginRoot, def.id, "agent");
    const profile = scoreTarget(
      {
        id: def.id,
        path: def.relativePath,
        invocations,
        declaredTools: def.declaredTools,
        usedTools,
        sections: def.sections,
        rawContent: def.rawContent,
        loads: 0,
        applied: 0,
        mistakePatterns,
      },
      totals,
      config,
      "agent"
    );
    return mistakePatterns.length > 0 ? { ...profile, mistakePatterns } : profile;
  });

  const skillDefs = loadDefinitionFiles(claudeRoot, "skills", pluginRoot);
  const skills = skillDefs.map((def) => {
    const loads = agg.skillLoads[def.id] ?? 0;
    const applied = agg.skillApplied[def.id] ?? 0;
    const mistakePatterns = aggregateMistakePatterns(cache.sessions, pluginRoot, def.id, "skill");
    const profile = scoreTarget(
      {
        id: def.id,
        path: def.relativePath,
        invocations: loads,
        declaredTools: def.declaredTools,
        usedTools: [],
        sections: def.sections,
        rawContent: def.rawContent,
        loads,
        applied,
        mistakePatterns,
      },
      totals,
      config,
      "skill"
    );
    return mistakePatterns.length > 0 ? { ...profile, mistakePatterns } : profile;
  });

  const result: AnalysisResult = {
    generatedAt: new Date().toISOString(),
    sessionCount,
    readMode: config.read.transcripts,
    totals,
    languages,
    agents,
    skills,
    feedback,
  };

  const analysisPath = path.join(pluginRoot, "data", "analysis.json");
  fs.mkdirSync(path.dirname(analysisPath), { recursive: true });
  const tmp = analysisPath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(result, null, 2), "utf8");
  fs.renameSync(tmp, analysisPath);

  return result;
}
