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
const config_js_1 = require("../config.js");
const transcriptParser_js_1 = require("./transcriptParser.js");
const cachePath = (pluginRoot) => path.join(pluginRoot, "data", "profile.json");
function readCache(pluginRoot) {
    const p = cachePath(pluginRoot);
    try {
        return JSON.parse(fs.readFileSync(p, "utf8"));
    }
    catch {
        return { sessions: {} };
    }
}
function writeCache(pluginRoot, cache) {
    const p = cachePath(pluginRoot);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = p + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), "utf8");
    fs.renameSync(tmp, p);
}
function findTranscriptFiles(claudeRoot) {
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
        catch {
            // skip unreadable dirs
        }
    }
    return results;
}
// currentSessionId is passed so the call mapping built below can include the current session's
// Agent calls, ensuring subagent transcripts for this session are attributed correctly.
async function updateCache(pluginRoot, claudeRoot, currentSessionId) {
    const config = (0, config_js_1.loadConfig)(pluginRoot);
    const cache = readCache(pluginRoot);
    const transcripts = findTranscriptFiles(claudeRoot);
    for (const { sessionId, filePath } of transcripts) {
        if (cache.sessions[sessionId])
            continue; // already parsed
        try {
            const profile = await (0, transcriptParser_js_1.parseTranscript)(filePath, sessionId, config.read.transcripts, config.read.denyGlobs, claudeRoot);
            cache.sessions[sessionId] = profile;
        }
        catch {
            // skip unparseable transcripts
        }
    }
    // Build a global map: agentCallId → agentType from all parsed parent sessions
    const callIdToAgentType = {};
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
            if (!fs.existsSync(subagentDir))
                continue;
            for (const file of fs.readdirSync(subagentDir)) {
                if (!file.endsWith(".jsonl"))
                    continue;
                // subagent files are named like "agent-<callId>.jsonl"
                const callId = file.replace(/^agent-/, "").replace(".jsonl", "");
                const subSessionId = `sub-${callId}`;
                if (cache.sessions[subSessionId])
                    continue;
                try {
                    const profile = await (0, transcriptParser_js_1.parseTranscript)(path.join(subagentDir, file), subSessionId, config.read.transcripts, config.read.denyGlobs, claudeRoot);
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
                }
                catch {
                    // skip
                }
            }
        }
    }
    writeCache(pluginRoot, cache);
    return cache;
}
function readProfileCache(pluginRoot) {
    return readCache(pluginRoot);
}
//# sourceMappingURL=incrementalCache.js.map