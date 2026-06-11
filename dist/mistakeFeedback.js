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
exports.recordSuggestionRejected = recordSuggestionRejected;
exports.readPersistedMistakeEvents = readPersistedMistakeEvents;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const security_js_1 = require("./security.js");
const feedbackPath = (pluginRoot) => path.join(pluginRoot, "data", "mistake-feedback.jsonl");
const MAX_ENTRIES = 100;
function recordSuggestionRejected(pluginRoot, targetKind, targetId, mistakeSummary) {
    const event = {
        sessionId: "metamorph",
        timestamp: new Date().toISOString(),
        targetKind,
        targetId,
        toolName: "metamorph",
        kind: "suggestion-rejected",
        mistakeSummary: (0, security_js_1.scrubSecrets)(mistakeSummary).slice(0, 80),
        confidence: "high",
    };
    const p = feedbackPath(pluginRoot);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, JSON.stringify(event) + "\n", "utf8");
    trimLog(p);
}
function trimLog(logPath) {
    try {
        const lines = fs.readFileSync(logPath, "utf8").split("\n").filter((l) => l.trim());
        if (lines.length <= MAX_ENTRIES)
            return;
        fs.writeFileSync(logPath, lines.slice(-MAX_ENTRIES).join("\n") + "\n", "utf8");
    }
    catch {
        // ignore
    }
}
function readPersistedMistakeEvents(pluginRoot) {
    const p = feedbackPath(pluginRoot);
    if (!fs.existsSync(p))
        return [];
    const events = [];
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
        if (!line.trim())
            continue;
        try {
            events.push(JSON.parse(line));
        }
        catch {
            continue;
        }
    }
    return events;
}
//# sourceMappingURL=mistakeFeedback.js.map