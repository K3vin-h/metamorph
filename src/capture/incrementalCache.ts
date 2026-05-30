import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ProfileCache, SessionProfile } from "../types.js";
import { loadConfig } from "../config.js";
import { parseTranscript } from "./transcriptParser.js";

const cachePath = (pluginRoot: string) => path.join(pluginRoot, "data", "profile.json");

function readCache(pluginRoot: string): ProfileCache {
  const p = cachePath(pluginRoot);
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return { sessions: {} };
  }
}

function writeCache(pluginRoot: string, cache: ProfileCache): void {
  const p = cachePath(pluginRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), "utf8");
  fs.renameSync(tmp, p);
}

function findTranscriptFiles(claudeRoot: string): Array<{ sessionId: string; filePath: string }> {
  const projectsDir = path.join(claudeRoot, "projects");
  const results: Array<{ sessionId: string; filePath: string }> = [];

  if (!fs.existsSync(projectsDir)) return results;

  const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(projectsDir, d.name));

  for (const dir of projectDirs) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.endsWith(".jsonl") && !file.startsWith("subagent")) {
          results.push({ sessionId: file.replace(".jsonl", ""), filePath: path.join(dir, file) });
        }
      }
    } catch {
      // skip unreadable dirs
    }
  }

  return results;
}

// currentSessionId is passed so the call mapping built below can include the current session's
// Agent calls, ensuring subagent transcripts for this session are attributed correctly.
export async function updateCache(
  pluginRoot: string,
  claudeRoot: string,
  currentSessionId: string
): Promise<ProfileCache> {
  const config = loadConfig(pluginRoot);
  const cache = readCache(pluginRoot);
  const transcripts = findTranscriptFiles(claudeRoot);

  for (const { sessionId, filePath } of transcripts) {
    if (cache.sessions[sessionId]) continue; // already parsed

    try {
      const profile = await parseTranscript(
        filePath,
        sessionId,
        config.read.transcripts,
        config.read.denyGlobs,
        claudeRoot
      );
      cache.sessions[sessionId] = profile;
    } catch {
      // skip unparseable transcripts
    }
  }

  // Build a global map: agentCallId → agentType from all parsed parent sessions
  const callIdToAgentType: Record<string, string> = {};
  for (const profile of Object.values(cache.sessions)) {
    Object.assign(callIdToAgentType, profile.agentCallMappings);
  }

  // Parse subagent transcripts, attributing tool calls to the correct agent type
  const projectsDir = path.join(claudeRoot, "projects");
  if (fs.existsSync(projectsDir)) {
    for (const projectDir of fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(projectsDir, d.name))) {
      const subagentDir = path.join(projectDir, "subagents");
      if (!fs.existsSync(subagentDir)) continue;
      for (const file of fs.readdirSync(subagentDir)) {
        if (!file.endsWith(".jsonl")) continue;
        // subagent files are named like "agent-<callId>.jsonl"
        const callId = file.replace(/^agent-/, "").replace(".jsonl", "");
        const subSessionId = `sub-${callId}`;
        if (cache.sessions[subSessionId]) continue;
        try {
          const profile = await parseTranscript(
            path.join(subagentDir, file),
            subSessionId,
            config.read.transcripts,
            config.read.denyGlobs,
            claudeRoot
          );
          // If we can identify the agent type from the call mapping, annotate all tool calls
          const agentType = callIdToAgentType[callId];
          if (agentType) {
            for (const ev of profile.toolCalls) {
              ev.agentId = agentType;
            }
            // Count this subagent transcript as one invocation of the agent type
            profile.agentInvocations[agentType] = (profile.agentInvocations[agentType] ?? 0) + 1;
          }
          cache.sessions[subSessionId] = profile;
        } catch {
          // skip
        }
      }
    }
  }

  writeCache(pluginRoot, cache);
  return cache;
}

export function readProfileCache(pluginRoot: string): ProfileCache {
  return readCache(pluginRoot);
}
