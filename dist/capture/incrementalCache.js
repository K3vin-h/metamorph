"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCache = updateCache;
exports.readProfileCache = readProfileCache;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const config_js_1 = require("../config.js");
const transcriptParser_js_1 = require("./transcriptParser.js");
const hookErrors_js_1 = require("../hookErrors.js");
const cachePath = (pluginRoot) => path.join(pluginRoot, "data", "profile.json");
const MAX_CACHE_SESSIONS = 500;
function readCache(pluginRoot) {
    const p = cachePath(pluginRoot);
    try {
        const raw = JSON.parse(fs.readFileSync(p, "utf8"));
        return {
            sessions: raw.sessions ?? {},
            failedSessions: raw.failedSessions ?? {},
        };
    }
    catch {
        return { sessions: {}, failedSessions: {} };
    }
}
function trimCache(cache) {
    const ids = Object.keys(cache.sessions);
    if (ids.length <= MAX_CACHE_SESSIONS)
        return;
    const sorted = ids.sort((a, b) => {
        const ta = cache.sessions[a]?.capturedAt ?? "";
        const tb = cache.sessions[b]?.capturedAt ?? "";
        return ta.localeCompare(tb);
    });
    for (const id of sorted.slice(0, ids.length - MAX_CACHE_SESSIONS)) {
        delete cache.sessions[id];
    }
}
function writeCache(pluginRoot, cache) {
    trimCache(cache);
    const p = cachePath(pluginRoot);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = p + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), "utf8");
    fs.renameSync(tmp, p);
}
function recordParseFailure(cache, sessionId, err, pluginRoot, label) {
    if (!cache.failedSessions)
        cache.failedSessions = {};
    cache.failedSessions[sessionId] = {
        error: err instanceof Error ? err.message : String(err),
        skippedAt: new Date().toISOString(),
    };
    (0, hookErrors_js_1.logHookError)(pluginRoot, label, err);
}
function findTranscriptFiles(claudeRoot, pluginRoot) {
    const projectsDir = path.join(claudeRoot, "projects");
    const results = [];
    if (!fs.existsSync(projectsDir))
        return results;
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
        }
        catch (err) {
            (0, hookErrors_js_1.logHookError)(pluginRoot, `transcript-scan:${dir}`, err);
        }
    }
    return results;
}
function findCursorTranscripts(cursorRoot, pluginRoot) {
    const results = [];
    const projectsDir = path.join(cursorRoot, "projects");
    if (!fs.existsSync(projectsDir))
        return results;
    for (const projectEntry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
        if (!projectEntry.isDirectory())
            continue;
        const agentTranscriptsDir = path.join(projectsDir, projectEntry.name, "agent-transcripts");
        if (!fs.existsSync(agentTranscriptsDir))
            continue;
        for (const uuidEntry of fs.readdirSync(agentTranscriptsDir, { withFileTypes: true })) {
            if (!uuidEntry.isDirectory())
                continue;
            const transcriptFile = path.join(agentTranscriptsDir, uuidEntry.name, `${uuidEntry.name}.jsonl`);
            if (fs.existsSync(transcriptFile)) {
                results.push({ sessionId: `cursor-${uuidEntry.name}`, filePath: transcriptFile });
            }
        }
    }
    return results;
}
function findCodexTranscripts(codexRoot, pluginRoot) {
    const results = [];
    const sessionsDir = path.join(codexRoot, "sessions");
    if (!fs.existsSync(sessionsDir))
        return results;
    try {
        for (const yearEntry of fs.readdirSync(sessionsDir, { withFileTypes: true })) {
            if (!yearEntry.isDirectory())
                continue;
            const yearDir = path.join(sessionsDir, yearEntry.name);
            for (const monthEntry of fs.readdirSync(yearDir, { withFileTypes: true })) {
                if (!monthEntry.isDirectory())
                    continue;
                const monthDir = path.join(yearDir, monthEntry.name);
                for (const dayEntry of fs.readdirSync(monthDir, { withFileTypes: true })) {
                    if (!dayEntry.isDirectory())
                        continue;
                    const dayDir = path.join(monthDir, dayEntry.name);
                    for (const file of fs.readdirSync(dayDir)) {
                        if (file.endsWith(".jsonl")) {
                            results.push({
                                sessionId: `codex-${file.replace(".jsonl", "")}`,
                                filePath: path.join(dayDir, file),
                            });
                        }
                    }
                }
            }
        }
    }
    catch (err) {
        (0, hookErrors_js_1.logHookError)(pluginRoot, "codex-transcript-scan", err);
    }
    return results;
}
async function updateCache(pluginRoot, claudeRoot, currentSessionId) {
    const config = (0, config_js_1.loadConfig)(pluginRoot);
    const cache = readCache(pluginRoot);
    if (!cache.failedSessions)
        cache.failedSessions = {};
    let newSessions = 0;
    const transcripts = findTranscriptFiles(claudeRoot, pluginRoot);
    for (const { sessionId, filePath } of transcripts) {
        if (cache.sessions[sessionId] || cache.failedSessions[sessionId])
            continue;
        try {
            const profile = await (0, transcriptParser_js_1.parseTranscript)(filePath, sessionId, config.read.transcripts, config.read.denyGlobs, claudeRoot, pluginRoot);
            cache.sessions[sessionId] = profile;
            newSessions++;
        }
        catch (err) {
            recordParseFailure(cache, sessionId, err, pluginRoot, `parse-transcript:${sessionId}`);
        }
    }
    const callIdToAgentType = {};
    for (const profile of Object.values(cache.sessions)) {
        if (!profile || !("agentCallMappings" in profile))
            continue;
        Object.assign(callIdToAgentType, profile.agentCallMappings);
    }
    const projectsDir = path.join(claudeRoot, "projects");
    if (fs.existsSync(projectsDir)) {
        for (const projectDir of fs.readdirSync(projectsDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => path.join(projectsDir, d.name))) {
            const subagentDir = path.join(projectDir, "subagents");
            if (!fs.existsSync(subagentDir))
                continue;
            for (const file of fs.readdirSync(subagentDir)) {
                if (!file.endsWith(".jsonl"))
                    continue;
                const callId = file.replace(/^agent-/, "").replace(".jsonl", "");
                const subSessionId = `sub-${callId}`;
                if (cache.sessions[subSessionId] || cache.failedSessions[subSessionId])
                    continue;
                try {
                    const profile = await (0, transcriptParser_js_1.parseTranscript)(path.join(subagentDir, file), subSessionId, config.read.transcripts, config.read.denyGlobs, claudeRoot, pluginRoot);
                    const agentType = callIdToAgentType[callId];
                    if (agentType) {
                        for (const ev of profile.toolCalls) {
                            ev.agentId = agentType;
                        }
                        profile.agentInvocations[agentType] = (profile.agentInvocations[agentType] ?? 0) + 1;
                    }
                    cache.sessions[subSessionId] = profile;
                    newSessions++;
                }
                catch (err) {
                    recordParseFailure(cache, subSessionId, err, pluginRoot, `parse-subagent:${subSessionId}`);
                }
            }
        }
    }
    // Cursor transcripts
    if (config.read.trackCursor) {
        const cursorRoot = config.read.cursorRoot ?? path.join(os.homedir(), ".cursor");
        if (fs.existsSync(cursorRoot)) {
            for (const { sessionId, filePath } of findCursorTranscripts(cursorRoot, pluginRoot)) {
                if (cache.sessions[sessionId] || cache.failedSessions?.[sessionId])
                    continue;
                try {
                    const profile = await (0, transcriptParser_js_1.parseTranscript)(filePath, sessionId, config.read.transcripts, config.read.denyGlobs, claudeRoot, pluginRoot);
                    cache.sessions[sessionId] = profile;
                    newSessions++;
                }
                catch (err) {
                    recordParseFailure(cache, sessionId, err, pluginRoot, `parse-cursor:${sessionId}`);
                }
            }
        }
    }
    // Codex transcripts
    if (config.read.trackCodex) {
        const codexRoot = config.read.codexRoot ?? path.join(os.homedir(), ".codex");
        if (fs.existsSync(codexRoot)) {
            for (const { sessionId, filePath } of findCodexTranscripts(codexRoot, pluginRoot)) {
                if (cache.sessions[sessionId] || cache.failedSessions?.[sessionId])
                    continue;
                try {
                    const profile = await (0, transcriptParser_js_1.parseTranscript)(filePath, sessionId, config.read.transcripts, config.read.denyGlobs, claudeRoot, pluginRoot);
                    cache.sessions[sessionId] = profile;
                    newSessions++;
                }
                catch (err) {
                    recordParseFailure(cache, sessionId, err, pluginRoot, `parse-codex:${sessionId}`);
                }
            }
        }
    }
    if (newSessions > 0) {
        if (config.read.mistakeTracking && config.read.transcripts !== "off") {
            await backfillMistakeEvents(pluginRoot, claudeRoot, cache, config.read.transcripts, config.read.denyGlobs);
        }
        writeCache(pluginRoot, cache);
    }
    return newSessions;
}
async function backfillMistakeEvents(pluginRoot, claudeRoot, cache, mode, denyGlobs) {
    const { collectSessionMistakeEvents } = await Promise.resolve().then(() => __importStar(require("./mistakeParser.js")));
    for (const { sessionId, filePath } of findTranscriptFiles(claudeRoot, pluginRoot)) {
        const existing = cache.sessions[sessionId];
        if (!existing)
            continue;
        if (existing.mistakeEvents !== undefined)
            continue; // already backfilled
        existing.mistakeEvents = await collectSessionMistakeEvents(filePath, sessionId, mode, denyGlobs, claudeRoot);
    }
}
function readProfileCache(pluginRoot) {
    return readCache(pluginRoot);
}
//# sourceMappingURL=incrementalCache.js.map