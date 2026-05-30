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
exports.checkWritePermission = checkWritePermission;
exports.checkReadPermission = checkReadPermission;
exports.matchGlob = matchGlob;
const path = __importStar(require("path"));
function matchGlob(pattern, filePath) {
    // Simple glob matching: supports * (any segment chars) and ** (any path segments)
    const escapeRegex = (s) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    const regexStr = pattern
        .split("**")
        .map((part) => part
        .split("*")
        .map(escapeRegex)
        .join("[^/]*"))
        .join(".*");
    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(filePath);
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
function checkWritePermission(resolvedPath, config, claudeRoot) {
    // 1. Path safety: must not contain traversal (already resolved, but double-check)
    if (resolvedPath.includes("..")) {
        return { allowed: false, reason: "path-traversal" };
    }
    // 2. Must be inside claudeRoot
    const rel = path.relative(claudeRoot, resolvedPath);
    if (rel.startsWith("..")) {
        return { allowed: false, reason: "outside-root" };
    }
    // 3. Category toggle check
    const category = getCategory(resolvedPath, claudeRoot);
    if (category !== null) {
        if (!config.write.targets[category]) {
            return { allowed: false, reason: "category-disabled" };
        }
    }
    // 4. Deny glob list — any match wins
    for (const denyGlob of config.write.deny) {
        if (matchGlob(denyGlob, rel)) {
            return { allowed: false, reason: "deny-glob" };
        }
    }
    // 5. Allow glob list — must match at least one
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
    return !denyGlobs.some((glob) => matchGlob(glob, rel));
}
//# sourceMappingURL=permissions.js.map