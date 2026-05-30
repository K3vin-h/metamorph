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
exports.filterTranscriptEvent = filterTranscriptEvent;
const crypto = __importStar(require("crypto"));
const path = __importStar(require("path"));
const security_js_1 = require("./security.js");
const permissions_js_1 = require("./permissions.js");
const COMMAND_CATEGORIES = ["git", "test", "build", "npm", "yarn", "pnpm", "docker", "python", "node"];
function detectCommandCategory(command) {
    const lower = command.toLowerCase();
    for (const cat of COMMAND_CATEGORIES) {
        if (lower.startsWith(cat + " ") || lower.startsWith(cat + "\n") || lower === cat) {
            return cat;
        }
    }
    return "other";
}
function extractFileExtensions(input) {
    const exts = new Set();
    const filePath = input.file_path ?? input.path ?? input.command;
    if (typeof filePath === "string") {
        const ext = path.extname(filePath);
        if (ext)
            exts.add(ext.toLowerCase());
    }
    return [...exts];
}
function hashPathStem(filePath) {
    // Return a hashed, relative-only stem — never an absolute path
    const stem = path.basename(filePath, path.extname(filePath));
    return crypto.createHash("sha256").update(stem).digest("hex").slice(0, 12);
}
function extractAgentId(input) {
    if (typeof input.subagent_type === "string")
        return input.subagent_type;
    if (typeof input.description === "string")
        return undefined; // can't reliably extract
    return undefined;
}
function extractSkillId(input) {
    if (typeof input.skill === "string")
        return input.skill;
    return undefined;
}
function filterTranscriptEvent(line, sessionId, mode, denyGlobs, claudeRoot) {
    if (mode === "off")
        return [];
    if (line.role !== "assistant" || !Array.isArray(line.content))
        return [];
    const events = [];
    const timestamp = line.timestamp ?? new Date().toISOString();
    for (const block of line.content) {
        if (block.type !== "tool_use" || typeof block.name !== "string")
            continue;
        const toolName = block.name;
        const input = block.input ?? {};
        // Check deny-read globs on file paths in the input
        const filePath = input.file_path ?? input.path;
        if (typeof filePath === "string") {
            if (!(0, permissions_js_1.checkReadPermission)(filePath, denyGlobs, claudeRoot))
                continue;
        }
        if (mode === "full") {
            // Scrub secrets from tool inputs before storing
            const scrubbedInput = {};
            for (const [k, v] of Object.entries(input)) {
                scrubbedInput[k] = typeof v === "string" ? (0, security_js_1.scrubSecrets)(v) : v;
            }
            events.push({ sessionId, toolName, timestamp, toolInput: scrubbedInput });
            continue;
        }
        // redacted mode
        const event = { sessionId, toolName, timestamp };
        event.fileExtensions = extractFileExtensions(input);
        if (typeof filePath === "string") {
            event.pathStems = [hashPathStem(filePath)];
        }
        if (toolName === "Bash" && typeof input.command === "string") {
            event.commandCategory = detectCommandCategory(input.command);
        }
        if (toolName === "Agent") {
            event.agentId = extractAgentId(input);
        }
        if (toolName === "Skill") {
            event.skillId = extractSkillId(input);
        }
        events.push(event);
    }
    return events;
}
//# sourceMappingURL=privacy.js.map