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
exports.collectSessionMistakeEvents = collectSessionMistakeEvents;
exports.parseMistakesFromTranscript = parseMistakesFromTranscript;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
const transcriptLine_js_1 = require("./transcriptLine.js");
const mistakeSignals_js_1 = require("./mistakeSignals.js");
const privacy_js_1 = require("../privacy.js");
const skillPath_js_1 = require("../skillPath.js");
const MAX_EVENTS_PER_SESSION = 20;
const MAX_SUMMARY_CHARS = 80;
function resolveTarget(state, ctx) {
    const agentId = ctx?.agentId ?? state.lastAgentId;
    const skillId = ctx?.skillId ?? state.lastSkillId;
    if (agentId)
        return { targetKind: "agent", targetId: agentId };
    if (skillId)
        return { targetKind: "skill", targetId: skillId };
    return { targetKind: "main", targetId: "main" };
}
function trimSummary(text) {
    const t = text.replace(/\s+/g, " ").trim();
    return t.length <= MAX_SUMMARY_CHARS ? t : t.slice(0, MAX_SUMMARY_CHARS - 3) + "...";
}
function pushEvent(state, event) {
    if (state.events.length >= MAX_EVENTS_PER_SESSION)
        return;
    state.events.push(event);
}
function registerToolUse(state, toolUseId, toolName, input) {
    let agentId;
    let skillId;
    if ((0, skillPath_js_1.isAgentTool)(toolName) && typeof input.subagent_type === "string") {
        agentId = input.subagent_type;
        state.lastAgentId = agentId;
    }
    if (toolName === "Skill" && typeof input.skill === "string") {
        skillId = input.skill;
        state.lastSkillId = skillId;
    }
    if (toolName === "Read") {
        const readPath = input.file_path ?? input.path;
        if (typeof readPath === "string") {
            const fromPath = (0, skillPath_js_1.extractSkillIdFromPath)(readPath);
            if (fromPath) {
                skillId = fromPath;
                state.lastSkillId = skillId;
            }
        }
    }
    state.toolUses[toolUseId] = { toolName, agentId, skillId };
}
function toolContextFor(state, toolUseId) {
    return (state.toolUses[toolUseId] ?? {
        toolName: "unknown",
        agentId: state.lastAgentId ?? undefined,
        skillId: state.lastSkillId ?? undefined,
    });
}
function markToolCompleted(state, toolUseId, timestamp) {
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
function recordUserFixAfterCompletedTool(state, sessionId, timestamp, text, mode) {
    if (!state.awaitingFix)
        return;
    const classified = (0, mistakeSignals_js_1.classifyUserFixMessage)(text, mode);
    if (!classified)
        return;
    const completed = state.awaitingFix;
    state.awaitingFix = null;
    pushEvent(state, {
        sessionId,
        timestamp,
        targetKind: completed.targetKind,
        targetId: completed.targetId,
        toolName: completed.toolName,
        kind: classified.correctionSummary ? "user-correction" : "user-rejection",
        mistakeSummary: trimSummary(mode === "redacted"
            ? `After ${completed.toolName}: user fix`
            : `After ${completed.toolName}: ${classified.mistakeSummary}`),
        correctionSummary: classified.correctionSummary
            ? trimSummary(classified.correctionSummary)
            : undefined,
        confidence: classified.confidence,
    });
}
function processAssistantLine(state, content, sessionId, timestamp, mode, denyGlobs, claudeRoot) {
    let sawToolUse = false;
    for (const block of (0, transcriptLine_js_1.contentBlocks)(content)) {
        if (block.type === "tool_use" && typeof block.name === "string" && typeof block.id === "string") {
            sawToolUse = true;
            registerToolUse(state, block.id, block.name, (block.input ?? {}));
        }
    }
    if (sawToolUse) {
        state.awaitingFix = null;
    }
    const legacyLine = {
        type: "assistant",
        role: "assistant",
        content: content,
        sessionId,
        timestamp,
    };
    const events = (0, privacy_js_1.filterTranscriptEvent)(legacyLine, sessionId, mode, denyGlobs, claudeRoot);
    for (const ev of events) {
        if (ev.agentId)
            state.lastAgentId = ev.agentId;
        if (ev.skillId)
            state.lastSkillId = ev.skillId;
    }
}
function processUserLine(state, content, sessionId, timestamp, mode) {
    for (const result of (0, mistakeSignals_js_1.extractToolResults)(content)) {
        if (result.isError)
            continue;
        if ((0, mistakeSignals_js_1.isRejectedToolResult)(result.summary))
            continue;
        markToolCompleted(state, result.toolUseId, timestamp);
    }
    const text = (0, mistakeSignals_js_1.extractUserText)(content);
    if (text) {
        recordUserFixAfterCompletedTool(state, sessionId, timestamp, text, mode);
    }
}
async function parseMistakesFromFile(transcriptPath, sessionId, mode, denyGlobs, claudeRoot) {
    if (!fs.existsSync(transcriptPath))
        return [];
    const state = {
        lastAgentId: null,
        lastSkillId: null,
        toolUses: {},
        awaitingFix: null,
        events: [],
    };
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
            continue;
        }
        const normalized = (0, transcriptLine_js_1.normalizeTranscriptLine)(raw);
        if (!normalized)
            continue;
        if (normalized.lineType === "assistant" || normalized.role === "assistant") {
            processAssistantLine(state, normalized.content, sessionId, normalized.timestamp, mode, denyGlobs, claudeRoot);
        }
        else if (normalized.lineType === "user" || normalized.role === "user") {
            processUserLine(state, normalized.content, sessionId, normalized.timestamp, mode);
        }
    }
    return state.events;
}
/** Main session + subagent transcripts (all tools in each). */
async function collectSessionMistakeEvents(transcriptPath, sessionId, mode, denyGlobs, claudeRoot) {
    const all = [];
    all.push(...(await parseMistakesFromFile(transcriptPath, sessionId, mode, denyGlobs, claudeRoot)));
    const subagentDir = path.join(path.dirname(transcriptPath), "subagents");
    if (fs.existsSync(subagentDir)) {
        for (const file of fs.readdirSync(subagentDir)) {
            if (!file.endsWith(".jsonl"))
                continue;
            const subId = `sub-${file.replace(/^agent-/, "").replace(".jsonl", "")}`;
            all.push(...(await parseMistakesFromFile(path.join(subagentDir, file), subId, mode, denyGlobs, claudeRoot)));
        }
    }
    return all.slice(0, MAX_EVENTS_PER_SESSION);
}
async function parseMistakesFromTranscript(transcriptPath, sessionId, mode, denyGlobs, claudeRoot, trackingEnabled) {
    if (!trackingEnabled || mode === "off")
        return [];
    return collectSessionMistakeEvents(transcriptPath, sessionId, mode, denyGlobs, claudeRoot);
}
//# sourceMappingURL=mistakeParser.js.map