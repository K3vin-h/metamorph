import * as fs from "fs";
import * as readline from "readline";
import type { SessionProfile, PrivacyMode, RawTranscriptLine } from "../types.js";
import { filterTranscriptEvent } from "../privacy.js";

export async function parseTranscript(
  transcriptPath: string,
  sessionId: string,
  mode: PrivacyMode,
  denyGlobs: string[],
  claudeRoot: string
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
  };

  if (!fs.existsSync(transcriptPath)) return profile;

  const stream = fs.createReadStream(transcriptPath, "utf8");
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    let raw: RawTranscriptLine;
    try {
      raw = JSON.parse(line);
    } catch {
      profile.skippedLines++;
      continue;
    }

    // Record agent call ID → agent type mapping for subagent transcript cross-reference
    if (raw.role === "assistant" && Array.isArray(raw.content)) {
      for (const block of raw.content) {
        if (block.type === "tool_use" && block.name === "Agent" && block.id) {
          const agentType = (block.input as Record<string, unknown>)?.subagent_type;
          if (typeof agentType === "string" && block.id) {
            profile.agentCallMappings[block.id] = agentType;
          }
        }
      }
    }

    const events = filterTranscriptEvent(raw, sessionId, mode, denyGlobs, claudeRoot);
    for (const ev of events) {
      profile.toolCalls.push(ev);

      // Track agent invocations
      if (ev.agentId) {
        profile.agentInvocations[ev.agentId] = (profile.agentInvocations[ev.agentId] ?? 0) + 1;
      }

      // Track skill loads only — skillApplied comes from historyParser where entry.type === "apply"
      // gives a reliable signal. Unconditionally incrementing applied here would make applied/loads
      // always 1.0, defeating the never-applied-skill flag.
      if (ev.skillId) {
        profile.skillLoads[ev.skillId] = (profile.skillLoads[ev.skillId] ?? 0) + 1;
        profile.skillApplied[ev.skillId] = profile.skillApplied[ev.skillId] ?? 0;
      }

      // Track file extensions
      for (const ext of ev.fileExtensions ?? []) {
        profile.fileExtensions[ext] = (profile.fileExtensions[ext] ?? 0) + 1;
      }
    }
  }

  return profile;
}
