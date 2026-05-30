import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import type { MistakeEvent, PrivacyMode } from "../types.js";
import { normalizeTranscriptLine, contentBlocks } from "./transcriptLine.js";
import {
  classifyUserFixMessage,
  extractUserText,
  extractToolResults,
  isRejectedToolResult,
} from "./mistakeSignals.js";
import { filterTranscriptEvent } from "../privacy.js";
import type { RawTranscriptLine } from "../types.js";

const MAX_EVENTS_PER_SESSION = 20;
const MAX_SUMMARY_CHARS = 80;

interface ToolUseContext {
  toolName: string;
  agentId?: string;
  skillId?: string;
}

interface CompletedToolContext {
  toolUseId: string;
  toolName: string;
  targetKind: MistakeEvent["targetKind"];
  targetId: string;
  completedAt: string;
}

interface ParseMistakeState {
  lastAgentId: string | null;
  lastSkillId: string | null;
  toolUses: Record<string, ToolUseContext>;
  awaitingFix: CompletedToolContext | null;
  events: MistakeEvent[];
}

function resolveTarget(
  state: ParseMistakeState,
  ctx?: ToolUseContext
): { targetKind: MistakeEvent["targetKind"]; targetId: string } {
  const agentId = ctx?.agentId ?? state.lastAgentId;
  const skillId = ctx?.skillId ?? state.lastSkillId;
  if (agentId) return { targetKind: "agent", targetId: agentId };
  if (skillId) return { targetKind: "skill", targetId: skillId };
  return { targetKind: "main", targetId: "main" };
}

function trimSummary(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= MAX_SUMMARY_CHARS ? t : t.slice(0, MAX_SUMMARY_CHARS - 3) + "...";
}

function pushEvent(state: ParseMistakeState, event: MistakeEvent): void {
  if (state.events.length >= MAX_EVENTS_PER_SESSION) return;
  state.events.push(event);
}

function registerToolUse(
  state: ParseMistakeState,
  toolUseId: string,
  toolName: string,
  input: Record<string, unknown>
): void {
  let agentId: string | undefined;
  let skillId: string | undefined;

  if (toolName === "Agent" && typeof input.subagent_type === "string") {
    agentId = input.subagent_type;
    state.lastAgentId = agentId;
  }
  if (toolName === "Skill" && typeof input.skill === "string") {
    skillId = input.skill;
    state.lastSkillId = skillId;
  }

  state.toolUses[toolUseId] = { toolName, agentId, skillId };
}

function toolContextFor(
  state: ParseMistakeState,
  toolUseId: string
): ToolUseContext {
  return (
    state.toolUses[toolUseId] ?? {
      toolName: "unknown",
      agentId: state.lastAgentId ?? undefined,
      skillId: state.lastSkillId ?? undefined,
    }
  );
}

function markToolCompleted(
  state: ParseMistakeState,
  toolUseId: string,
  timestamp: string
): void {
  const ctx = toolContextFor(state, toolUseId);
  state.toolUses[toolUseId] = ctx;

  const target = resolveTarget(state, ctx);
  state.awaitingFix = {
    toolUseId,
    toolName: ctx.toolName,
    targetKind: target.targetKind,
    targetId: target.targetId,
    completedAt: timestamp,
  };
}

function recordUserFixAfterCompletedTool(
  state: ParseMistakeState,
  sessionId: string,
  timestamp: string,
  text: string,
  mode: PrivacyMode
): void {
  if (!state.awaitingFix) return;

  const classified = classifyUserFixMessage(text, mode);
  if (!classified) return;

  const completed = state.awaitingFix;
  state.awaitingFix = null;

  pushEvent(state, {
    sessionId,
    timestamp,
    targetKind: completed.targetKind,
    targetId: completed.targetId,
    toolName: completed.toolName,
    kind: classified.correctionSummary ? "user-correction" : "user-rejection",
    mistakeSummary: trimSummary(
      mode === "redacted"
        ? `After ${completed.toolName}: user fix`
        : `After ${completed.toolName}: ${classified.mistakeSummary}`
    ),
    correctionSummary: classified.correctionSummary
      ? trimSummary(classified.correctionSummary)
      : undefined,
    confidence: classified.confidence,
  });
}

function processAssistantLine(
  state: ParseMistakeState,
  content: unknown,
  sessionId: string,
  timestamp: string,
  mode: PrivacyMode,
  denyGlobs: string[],
  claudeRoot: string
): void {
  let sawToolUse = false;

  for (const block of contentBlocks(content)) {
    if (block.type === "tool_use" && typeof block.name === "string" && typeof block.id === "string") {
      sawToolUse = true;
      registerToolUse(state, block.id, block.name, (block.input ?? {}) as Record<string, unknown>);
    }
  }

  if (sawToolUse) {
    state.awaitingFix = null;
  }

  const legacyLine: RawTranscriptLine = {
    type: "assistant",
    role: "assistant",
    content: content as RawTranscriptLine["content"],
    sessionId,
    timestamp,
  };
  const events = filterTranscriptEvent(legacyLine, sessionId, mode, denyGlobs, claudeRoot);
  for (const ev of events) {
    if (ev.agentId) state.lastAgentId = ev.agentId;
    if (ev.skillId) state.lastSkillId = ev.skillId;
  }
}

function processUserLine(
  state: ParseMistakeState,
  content: unknown,
  sessionId: string,
  timestamp: string,
  mode: PrivacyMode
): void {
  for (const result of extractToolResults(content)) {
    if (result.isError) continue;
    if (isRejectedToolResult(result.summary)) continue;
    markToolCompleted(state, result.toolUseId, timestamp);
  }

  const text = extractUserText(content);
  if (text) {
    recordUserFixAfterCompletedTool(state, sessionId, timestamp, text, mode);
  }
}

async function parseMistakesFromFile(
  transcriptPath: string,
  sessionId: string,
  mode: PrivacyMode,
  denyGlobs: string[],
  claudeRoot: string
): Promise<MistakeEvent[]> {
  if (!fs.existsSync(transcriptPath)) return [];

  const state: ParseMistakeState = {
    lastAgentId: null,
    lastSkillId: null,
    toolUses: {},
    awaitingFix: null,
    events: [],
  };

  const stream = fs.createReadStream(transcriptPath, "utf8");
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      continue;
    }

    const normalized = normalizeTranscriptLine(raw);
    if (!normalized) continue;

    if (normalized.lineType === "assistant" || normalized.role === "assistant") {
      processAssistantLine(
        state,
        normalized.content,
        sessionId,
        normalized.timestamp,
        mode,
        denyGlobs,
        claudeRoot
      );
    } else if (normalized.lineType === "user" || normalized.role === "user") {
      processUserLine(state, normalized.content, sessionId, normalized.timestamp, mode);
    }
  }

  return state.events;
}

/** Main session + subagent transcripts (all tools in each). */
export async function collectSessionMistakeEvents(
  transcriptPath: string,
  sessionId: string,
  mode: PrivacyMode,
  denyGlobs: string[],
  claudeRoot: string
): Promise<MistakeEvent[]> {
  const all: MistakeEvent[] = [];

  all.push(...(await parseMistakesFromFile(transcriptPath, sessionId, mode, denyGlobs, claudeRoot)));

  const subagentDir = path.join(path.dirname(transcriptPath), "subagents");
  if (fs.existsSync(subagentDir)) {
    for (const file of fs.readdirSync(subagentDir)) {
      if (!file.endsWith(".jsonl")) continue;
      const subId = `sub-${file.replace(/^agent-/, "").replace(".jsonl", "")}`;
      all.push(
        ...(await parseMistakesFromFile(
          path.join(subagentDir, file),
          subId,
          mode,
          denyGlobs,
          claudeRoot
        ))
      );
    }
  }

  return all.slice(0, MAX_EVENTS_PER_SESSION);
}

export async function parseMistakesFromTranscript(
  transcriptPath: string,
  sessionId: string,
  mode: PrivacyMode,
  denyGlobs: string[],
  claudeRoot: string,
  trackingEnabled: boolean
): Promise<MistakeEvent[]> {
  if (!trackingEnabled || mode === "off") return [];
  return collectSessionMistakeEvents(transcriptPath, sessionId, mode, denyGlobs, claudeRoot);
}
