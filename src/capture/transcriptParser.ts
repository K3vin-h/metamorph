import * as fs from "fs";
import * as readline from "readline";
import type { SessionProfile, PrivacyMode, RawTranscriptLine } from "../types.js";
import { filterTranscriptEvent } from "../privacy.js";
import { normalizeTranscriptLine, contentBlocks } from "./transcriptLine.js";
import { parseMistakesFromTranscript } from "./mistakeParser.js";
import { loadConfig } from "../config.js";

export async function parseTranscript(
  transcriptPath: string,
  sessionId: string,
  mode: PrivacyMode,
  denyGlobs: string[],
  claudeRoot: string,
  pluginRoot?: string
): Promise<SessionProfile> {
  const profile: SessionProfile = {
    sessionId,
    capturedAt: new Date().toISOString(),
    readMode: mode,
    toolCalls: [],
    agentInvocations: {},
    agentCallMappings: {},
    skillLoads: {},
    skillApplied: {},
    fileExtensions: {},
    skippedLines: 0,
    mistakeEvents: [],
  };

  if (!fs.existsSync(transcriptPath)) return profile;

  const config = pluginRoot ? loadConfig(pluginRoot) : null;
  const mistakeTracking = config?.read.mistakeTracking !== false && mode !== "off";

  const stream = fs.createReadStream(transcriptPath, "utf8");
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      profile.skippedLines++;
      continue;
    }

    const normalized = normalizeTranscriptLine(raw);
    if (!normalized) continue;

    if (normalized.lineType === "assistant" || normalized.role === "assistant") {
      for (const block of contentBlocks(normalized.content)) {
        if (
          block.type === "tool_use" &&
          (block.name === "Agent" || block.name === "Task") &&
          typeof block.id === "string"
        ) {
          const input = (block.input ?? {}) as Record<string, unknown>;
          const agentType = input.subagent_type;
          if (typeof agentType === "string") {
            profile.agentCallMappings[block.id] = agentType;
          }
        }
      }

      const legacyLine: RawTranscriptLine = {
        type: "assistant",
        role: "assistant",
        content: normalized.content as RawTranscriptLine["content"],
        sessionId,
        timestamp: normalized.timestamp,
      };

      const events = filterTranscriptEvent(legacyLine, sessionId, mode, denyGlobs, claudeRoot);
      for (const ev of events) {
        profile.toolCalls.push(ev);

        if (ev.agentId) {
          profile.agentInvocations[ev.agentId] = (profile.agentInvocations[ev.agentId] ?? 0) + 1;
        }

        if (ev.skillId) {
          profile.skillLoads[ev.skillId] = (profile.skillLoads[ev.skillId] ?? 0) + 1;
          profile.skillApplied[ev.skillId] = profile.skillApplied[ev.skillId] ?? 0;
        }

        for (const ext of ev.fileExtensions ?? []) {
          profile.fileExtensions[ext] = (profile.fileExtensions[ext] ?? 0) + 1;
        }
      }
    }
  }

  if (mistakeTracking && pluginRoot) {
    profile.mistakeEvents = await parseMistakesFromTranscript(
      transcriptPath,
      sessionId,
      mode,
      denyGlobs,
      claudeRoot,
      true
    );
  }

  return profile;
}
