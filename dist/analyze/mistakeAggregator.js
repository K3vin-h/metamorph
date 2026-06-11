"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateMistakePatterns = aggregateMistakePatterns;
const mistakeFeedback_js_1 = require("../mistakeFeedback.js");
const MAX_EXAMPLES_PER_PATTERN = 2;
const MAX_PATTERNS_PER_TARGET = 4;
const MAX_EXAMPLE_CHARS = 80;
function trim(s) {
    const t = s.replace(/\s+/g, " ").trim();
    return t.length <= MAX_EXAMPLE_CHARS ? t : t.slice(0, MAX_EXAMPLE_CHARS - 3) + "...";
}
function exampleKey(tool, mistake, correction) {
    // JSON array form — delimiter-proof (":" inside fields can't collide keys)
    return JSON.stringify([tool, mistake, correction ?? ""]);
}
function collectEvents(sessions, pluginRoot) {
    const fromSessions = [];
    for (const session of Object.values(sessions)) {
        fromSessions.push(...(session.mistakeEvents ?? []));
    }
    return [...fromSessions, ...(0, mistakeFeedback_js_1.readPersistedMistakeEvents)(pluginRoot)];
}
function aggregateMistakePatterns(sessions, pluginRoot, targetId, targetKind) {
    const byKey = new Map();
    for (const ev of collectEvents(sessions, pluginRoot)) {
        if (ev.targetKind !== targetKind || ev.targetId !== targetId)
            continue;
        const tool = ev.toolName || "any";
        const key = `${ev.kind}:${tool}`;
        if (!byKey.has(key)) {
            byKey.set(key, {
                kind: ev.kind,
                tool,
                count: 0,
                examples: [],
                _examples: new Map(),
            });
        }
        const bucket = byKey.get(key);
        bucket.count++;
        const exKey = exampleKey(tool, ev.mistakeSummary, ev.correctionSummary);
        if (!bucket._examples.has(exKey) && bucket._examples.size < MAX_EXAMPLES_PER_PATTERN) {
            bucket._examples.set(exKey, {
                mistake: trim(ev.mistakeSummary),
                ...(ev.correctionSummary ? { correction: trim(ev.correctionSummary) } : {}),
            });
        }
    }
    const patterns = [];
    for (const bucket of byKey.values()) {
        patterns.push({
            kind: bucket.kind,
            tool: bucket.tool,
            count: bucket.count,
            examples: [...bucket._examples.values()],
        });
    }
    patterns.sort((a, b) => b.count - a.count);
    return patterns.slice(0, MAX_PATTERNS_PER_TARGET);
}
//# sourceMappingURL=mistakeAggregator.js.map