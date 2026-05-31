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
exports.resolveSessionId = resolveSessionId;
const fs = __importStar(require("fs"));
/** Stable session id for warm-up counting across Claude Code, Cursor, and Codex hooks. */
function resolveSessionId() {
    if (process.env.CLAUDE_SESSION_ID) {
        return process.env.CLAUDE_SESSION_ID;
    }
    const transcriptPath = process.env.CURSOR_TRANSCRIPT_PATH;
    if (transcriptPath) {
        const match = transcriptPath.match(/agent-transcripts\/([^/]+)\//);
        if (match)
            return `cursor-${match[1]}`;
    }
    try {
        if (!process.stdin.isTTY) {
            const raw = fs.readFileSync(0, "utf8").trim();
            if (raw) {
                const payload = JSON.parse(raw);
                if (typeof payload.session_id === "string" && payload.session_id.length > 0) {
                    return payload.session_id;
                }
            }
        }
    }
    catch {
        // Hook hosts may not pass stdin JSON — fall through to timestamp id.
    }
    return `session-${Date.now()}`;
}
//# sourceMappingURL=sessionId.js.map