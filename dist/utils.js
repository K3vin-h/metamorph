"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAFE_ID_RE = void 0;
exports.parseFrontmatter = parseFrontmatter;
exports.assertSafeId = assertSafeId;
/** Safe identifier for suggestion ids, target ids, and config key segments. */
exports.SAFE_ID_RE = /^[\w\-]+$/;
function parseFrontmatter(content) {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match)
        return {};
    const result = {};
    for (const line of match[1].split("\n")) {
        const sep = line.indexOf(":");
        if (sep < 0)
            continue;
        result[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
    }
    return result;
}
function assertSafeId(id, label) {
    if (!exports.SAFE_ID_RE.test(id)) {
        throw new Error(`Invalid ${label}: ${id}`);
    }
}
//# sourceMappingURL=utils.js.map