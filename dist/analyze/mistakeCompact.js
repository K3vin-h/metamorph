"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mistakePatternsForContext = mistakePatternsForContext;
const security_js_1 = require("../security.js");
/** Same caps as other compact improve-context fields (flags, feedback, sections). */
const CONTEXT_MAX_PATTERNS = 3;
const CONTEXT_MAX_EXAMPLES = 2;
const CONTEXT_MAX_CHARS = 80;
/** Ultra-compact mistake slice for improve-context files (LLM reads only this). */
function mistakePatternsForContext(patterns) {
    if (!patterns?.length)
        return undefined;
    return patterns.slice(0, CONTEXT_MAX_PATTERNS).map((p) => ({
        kind: p.kind,
        tool: p.tool,
        n: p.count,
        ex: p.examples.slice(0, CONTEXT_MAX_EXAMPLES).map((e) => ({
            m: (0, security_js_1.sanitizeUserSnippet)(e.mistake, CONTEXT_MAX_CHARS),
            ...(e.correction
                ? { c: (0, security_js_1.sanitizeUserSnippet)(e.correction, CONTEXT_MAX_CHARS) }
                : {}),
        })),
    }));
}
//# sourceMappingURL=mistakeCompact.js.map