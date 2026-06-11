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
exports.resolveProjectRoot = resolveProjectRoot;
exports.localClaudeMdPath = localClaudeMdPath;
exports.checkWritePermission = checkWritePermission;
exports.checkReadPermission = checkReadPermission;
exports.matchGlob = matchGlob;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function globToRegex(pattern) {
    const escapeRegex = (s) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    let regex = "";
    for (let i = 0; i < pattern.length;) {
        if (pattern.slice(i, i + 3) === "**/") {
            // Unambiguous translation — (?:.+/)* backtracks exponentially on near-misses
            regex += "(?:[^/]+/)*";
            i += 3;
        }
        else if (pattern.slice(i, i + 2) === "**") {
            regex += ".*";
            i += 2;
        }
        else if (pattern[i] === "*") {
            regex += "[^/]*";
            i += 1;
        }
        else {
            regex += escapeRegex(pattern[i]);
            i += 1;
        }
    }
    return `^${regex}$`;
}
function matchGlob(pattern, filePath) {
    if (filePath.includes("..") || path.isAbsolute(filePath))
        return false;
    // Windows: path.relative produces backslash separators; globs are slash-based
    const normalized = filePath.split("\\").join("/");
    const regex = new RegExp(globToRegex(pattern));
    return regex.test(normalized);
}
function resolveProjectRoot() {
    const candidates = [
        process.env.CLAUDE_PROJECT_DIR,
        process.env.CURSOR_PROJECT_DIR,
        process.env.CLAUDE_CODE_PROJECT_DIR,
        process.cwd(),
    ].filter((v) => typeof v === "string" && v.trim().length > 0);
    for (const candidate of candidates) {
        const resolved = path.resolve(candidate);
        try {
            if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
                return resolved;
            }
        }
        catch {
            continue;
        }
    }
    return null;
}
function localClaudeMdPath(projectRoot) {
    return path.join(projectRoot, ".claude", "CLAUDE.md");
}
function getCategory(resolvedPath, claudeRoot) {
    const rel = path.relative(claudeRoot, resolvedPath);
    if (rel.startsWith("agents" + path.sep) || rel === "agents")
        return "agents";
    if (rel.startsWith("skills" + path.sep))
        return "skills";
    if (rel === "CLAUDE.md")
        return "claudeMd";
    return null;
}
function claudeMdScopeAllowed(resolvedPath, config, claudeRoot, projectRoot) {
    const scope = config.write.targets.claudeMd;
    if (!scope)
        return null;
    const globalPath = path.join(claudeRoot, "CLAUDE.md");
    if (path.resolve(resolvedPath) === path.resolve(globalPath)) {
        if (scope === "global" || scope === "both")
            return { allowed: true, reason: "ok" };
        return { allowed: false, reason: "category-disabled" };
    }
    if (projectRoot) {
        const localPath = localClaudeMdPath(projectRoot);
        if (path.resolve(resolvedPath) === path.resolve(localPath)) {
            if (scope === "local" || scope === "both")
                return { allowed: true, reason: "ok" };
            return { allowed: false, reason: "category-disabled" };
        }
    }
    return null;
}
function checkWritePermission(resolvedPath, config, claudeRoot, projectRoot = resolveProjectRoot()) {
    if (resolvedPath.includes("..")) {
        return { allowed: false, reason: "path-traversal" };
    }
    const claudeMdResult = claudeMdScopeAllowed(resolvedPath, config, claudeRoot, projectRoot);
    if (claudeMdResult) {
        for (const denyGlob of config.write.deny) {
            const relFromClaude = path.relative(claudeRoot, resolvedPath);
            if (!relFromClaude.startsWith("..") && matchGlob(denyGlob, relFromClaude)) {
                return { allowed: false, reason: "deny-glob" };
            }
        }
        return claudeMdResult;
    }
    const rel = path.relative(claudeRoot, resolvedPath);
    if (rel.startsWith("..")) {
        return { allowed: false, reason: "outside-root" };
    }
    const category = getCategory(resolvedPath, claudeRoot);
    if (category !== null) {
        if (category === "claudeMd") {
            if (!config.write.targets.claudeMd) {
                return { allowed: false, reason: "category-disabled" };
            }
        }
        else if (!config.write.targets[category]) {
            return { allowed: false, reason: "category-disabled" };
        }
    }
    for (const denyGlob of config.write.deny) {
        if (matchGlob(denyGlob, rel)) {
            return { allowed: false, reason: "deny-glob" };
        }
    }
    if (config.write.allow.length > 0) {
        const allowed = config.write.allow.some((allowGlob) => matchGlob(allowGlob, rel));
        if (!allowed) {
            return { allowed: false, reason: "allow-glob-missing" };
        }
    }
    return { allowed: true, reason: "ok" };
}
function checkReadPermission(filePath, denyGlobs, claudeRoot) {
    const rel = path.relative(claudeRoot, filePath);
    if (rel.startsWith(".."))
        return false;
    return !denyGlobs.some((glob) => matchGlob(glob, rel));
}
//# sourceMappingURL=permissions.js.map