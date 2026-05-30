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
exports.parseTranscript = parseTranscript;
const fs = __importStar(require("fs"));
const readline = __importStar(require("readline"));
const privacy_js_1 = require("../privacy.js");
const transcriptLine_js_1 = require("./transcriptLine.js");
const mistakeParser_js_1 = require("./mistakeParser.js");
const config_js_1 = require("../config.js");
async function parseTranscript(transcriptPath, sessionId, mode, denyGlobs, claudeRoot, pluginRoot) {
    const profile = {
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
    if (!fs.existsSync(transcriptPath))
        return profile;
    const config = pluginRoot ? (0, config_js_1.loadConfig)(pluginRoot) : null;
    const mistakeTracking = config?.read.mistakeTracking !== false && mode !== "off";
    const stream = fs.createReadStream(transcriptPath, "utf8");
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
        if (!line.trim())
            continue;
        let raw;
        try {
            raw = JSON.parse(line);
        }
        catch {
            profile.skippedLines++;
            continue;
        }
        const normalized = (0, transcriptLine_js_1.normalizeTranscriptLine)(raw);
        if (!normalized)
            continue;
        if (normalized.lineType === "assistant" || normalized.role === "assistant") {
            for (const block of (0, transcriptLine_js_1.contentBlocks)(normalized.content)) {
                if (block.type === "tool_use" && block.name === "Agent" && typeof block.id === "string") {
                    const input = (block.input ?? {});
                    const agentType = input.subagent_type;
                    if (typeof agentType === "string") {
                        profile.agentCallMappings[block.id] = agentType;
                    }
                }
            }
            const legacyLine = {
                type: "assistant",
                role: "assistant",
                content: normalized.content,
                sessionId,
                timestamp: normalized.timestamp,
            };
            const events = (0, privacy_js_1.filterTranscriptEvent)(legacyLine, sessionId, mode, denyGlobs, claudeRoot);
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
        profile.mistakeEvents = await (0, mistakeParser_js_1.parseMistakesFromTranscript)(transcriptPath, sessionId, mode, denyGlobs, claudeRoot, true);
    }
    return profile;
}
//# sourceMappingURL=transcriptParser.js.map