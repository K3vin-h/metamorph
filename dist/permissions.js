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
function globToRegex(pattern) {
    const escapeRegex = (s) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    let regex = "";
    for (let i = 0; i < pattern.length;) {
        if (pattern.slice(i, i + 2) === "**") {
            regex += "(?:[^/]+/)*";
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
    const regex = new RegExp(globToRegex(pattern));
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
    if (resolvedPath.includes("..")) {
        return { allowed: false, reason: "path-traversal" };
    }
    const rel = path.relative(claudeRoot, resolvedPath);
    if (rel.startsWith("..")) {
        return { allowed: false, reason: "outside-root" };
    }
    const category = getCategory(resolvedPath, claudeRoot);
    if (category !== null) {
        if (!config.write.targets[category]) {
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