"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shortFlag = shortFlag;
exports.displayFlag = displayFlag;
exports.isNeverInvoked = isNeverInvoked;
/** Short flag for tables and improve context (one primary flag). */
function shortFlag(flags) {
    if (flags.length === 0)
        return "ok";
    const f = flags[0];
    switch (f.type) {
        case "never-invoked-agent":
        case "never-applied-skill":
            return "inactive";
        case "rarely-used-agent":
            return "underused";
        case "hot-path":
            return "healthy";
        case "recurring-mistakes":
            return "correction";
        case "unused-tool":
            return "tool-gap";
        case "dead-section":
            return "stale-doc";
        case "low-confidence-dead-section":
            return "stale-doc?";
        default:
            return "ok";
    }
}
/** Table display: ok → em dash */
function displayFlag(flags) {
    const f = shortFlag(flags);
    return f === "ok" ? "—" : f;
}
function isNeverInvoked(flags) {
    const t = flags[0]?.type;
    return t === "never-invoked-agent" || t === "never-applied-skill";
}
//# sourceMappingURL=flagsShort.js.map