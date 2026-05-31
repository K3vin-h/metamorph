import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ProfileCache } from "../types.js";
import { loadConfig } from "../config.js";
import { parseTranscript } from "./transcriptParser.js";
import { logHookError } from "../hookErrors.js";

const cachePath = (pluginRoot: string) => path.join(pluginRoot, "data", "profile.json");
const MAX_CACHE_SESSIONS = 500;

function readCache(pluginRoot: string): ProfileCache {
  const p = cachePath(pluginRoot);
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    return {
      sessions: raw.sessions ?? {},
      failedSessions: raw.failedSessions ?? {},
    };
  } catch {
    return { sessions: {}, failedSessions: {} };
  }
}

function trimCache(cache: ProfileCache): void {
  const ids = Object.keys(cache.sessions);
  if (ids.length <= MAX_CACHE_SESSIONS) return;

  const sorted = ids.sort((a, b) => {
    const ta = cache.sessions[a]?.capturedAt ?? "";
    const tb = cache.sessions[b]?.capturedAt ?? "";
    return ta.localeCompare(tb);
  });

  for (const id of sorted.slice(0, ids.length - MAX_CACHE_SESSIONS)) {
    delete cache.sessions[id];
  }
}

function writeCache(pluginRoot: string, cache: ProfileCache): void {
  trimCache(cache);
  const p = cachePath(pluginRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), "utf8");
  fs.renameSync(tmp, p);
}

function recordParseFailure(
  cache: ProfileCache,
  sessionId: string,
  err: unknown,
  pluginRoot: string,
  label: string
): void {
  if (!cache.failedSessions) cache.failedSessions = {};
  cache.failedSessions[sessionId] = {
    error: err instanceof Error ? err.message : String(err),
    skippedAt: new Date().toISOString(),
  };
  logHookError(pluginRoot, label, err);
}

function findTranscriptFiles(
  claudeRoot: string,
  pluginRoot: string
): Array<{ sessionId: string; filePath: string }> {
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
    } catch (err) {
      logHookError(pluginRoot, `transcript-scan:${dir}`, err);
    }
  }

  return results;
}

export async function updateCache(
  pluginRoot: string,
  claudeRoot: string,
  currentSessionId: string
): Promise<number> {
  const config = loadConfig(pluginRoot);
  const cache = readCache(pluginRoot);
  if (!cache.failedSessions) cache.failedSessions = {};

  let newSessions = 0;
  const transcripts = findTranscriptFiles(claudeRoot, pluginRoot);

  for (const { sessionId, filePath } of transcripts) {
    if (cache.sessions[sessionId] || cache.failedSessions[sessionId]) continue;

    try {
      const profile = await parseTranscript(
        filePath,
        sessionId,
        config.read.transcripts,
        config.read.denyGlobs,
        claudeRoot,
        pluginRoot
      );
      cache.sessions[sessionId] = profile;
      newSessions++;
    } catch (err) {
      recordParseFailure(cache, sessionId, err, pluginRoot, `parse-transcript:${sessionId}`);
    }
  }

  const callIdToAgentType: Record<string, string> = {};
  for (const profile of Object.values(cache.sessions)) {
    if (!profile || !("agentCallMappings" in profile)) continue;
    Object.assign(callIdToAgentType, profile.agentCallMappings);
  }

  const projectsDir = path.join(claudeRoot, "projects");
  if (fs.existsSync(projectsDir)) {
    for (const projectDir of fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(projectsDir, d.name))) {
      const subagentDir = path.join(projectDir, "subagents");
      if (!fs.existsSync(subagentDir)) continue;
      for (const file of fs.readdirSync(subagentDir)) {
        if (!file.endsWith(".jsonl")) continue;
        const callId = file.replace(/^agent-/, "").replace(".jsonl", "");
        const subSessionId = `sub-${callId}`;
        if (cache.sessions[subSessionId] || cache.failedSessions[subSessionId]) continue;
        try {
          const profile = await parseTranscript(
            path.join(subagentDir, file),
            subSessionId,
            config.read.transcripts,
            config.read.denyGlobs,
            claudeRoot,
            pluginRoot
          );
          const agentType = callIdToAgentType[callId];
          if (agentType) {
            for (const ev of profile.toolCalls) {
              ev.agentId = agentType;
            }
            profile.agentInvocations[agentType] = (profile.agentInvocations[agentType] ?? 0) + 1;
          }
          cache.sessions[subSessionId] = profile;
          newSessions++;
        } catch (err) {
          recordParseFailure(cache, subSessionId, err, pluginRoot, `parse-subagent:${subSessionId}`);
        }
      }
    }
  }

  if (newSessions > 0 && config.read.mistakeTracking && config.read.transcripts !== "off") {
    await backfillMistakeEvents(pluginRoot, claudeRoot, cache, config.read.transcripts, config.read.denyGlobs);
    writeCache(pluginRoot, cache);
  }

  return newSessions;
}

async function backfillMistakeEvents(
  pluginRoot: string,
  claudeRoot: string,
  cache: ProfileCache,
  mode: import("../types.js").PrivacyMode,
  denyGlobs: string[]
): Promise<void> {
  const { collectSessionMistakeEvents } = await import("./mistakeParser.js");

  for (const { sessionId, filePath } of findTranscriptFiles(claudeRoot, pluginRoot)) {
    const existing = cache.sessions[sessionId];
    if (!existing) continue;
    if (existing.mistakeEvents !== undefined) continue; // already backfilled

    existing.mistakeEvents = await collectSessionMistakeEvents(
      filePath,
      sessionId,
      mode,
      denyGlobs,
      claudeRoot
    );
  }
}

export function readProfileCache(pluginRoot: string): ProfileCache {
  return readCache(pluginRoot);
}
