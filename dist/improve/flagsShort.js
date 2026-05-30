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
            return "never";
        case "rarely-used-agent":
            return "rare";
        case "hot-path":
            return "hot";
        case "recurring-mistakes":
            return "mistake";
        case "unused-tool":
            return "tool";
        case "dead-section":
            return "dead";
        case "low-confidence-dead-section":
            return "dead?";
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