"use strict";
/** Normalize Claude Code transcript JSONL lines (legacy + nested message format). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTranscriptLine = normalizeTranscriptLine;
exports.contentBlocks = contentBlocks;
function isRecord(v) {
    return typeof v === "object" && v !== null;
}
function normalizeTranscriptLine(raw) {
    if (!isRecord(raw))
        return null;
    const timestamp = typeof raw.timestamp === "string" ? raw.timestamp : new Date().toISOString();
    if (raw.type === "user" && isRecord(raw.message)) {
        const msg = raw.message;
        return {
            lineType: "user",
            role: typeof msg.role === "string" ? msg.role : "user",
            content: msg.content,
            timestamp,
        };
    }
    if (raw.type === "assistant" && isRecord(raw.message)) {
        const msg = raw.message;
        return {
            lineType: "assistant",
            role: typeof msg.role === "string" ? msg.role : "assistant",
            content: msg.content,
            timestamp,
        };
    }
    if (typeof raw.role === "string") {
        return {
            lineType: raw.role,
            role: raw.role,
            content: raw.content,
            timestamp,
        };
    }
    return null;
}
function contentBlocks(content) {
    if (!Array.isArray(content))
        return [];
    return content.filter(isRecord);
}
//# sourceMappingURL=transcriptLine.js.map