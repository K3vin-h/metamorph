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
exports.resolveDataRoot = resolveDataRoot;
exports.ensurePersistentData = ensurePersistentData;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function copyPathIfMissing(src, dest) {
    if (!fs.existsSync(src))
        return;
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src)) {
            copyPathIfMissing(path.join(src, entry), path.join(dest, entry));
        }
        return;
    }
    if (fs.existsSync(dest))
        return;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}
function runtimeCandidates(pluginRoot) {
    const candidates = [];
    const parent = path.dirname(pluginRoot);
    try {
        const siblings = fs
            .readdirSync(parent, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => path.join(parent, entry.name))
            .filter((dir) => dir !== pluginRoot)
            .filter((dir) => fs.existsSync(path.join(dir, "data")) || fs.existsSync(path.join(dir, "config.jsonc")))
            .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
        candidates.push(...siblings);
    }
    catch {
        // Ignore; local plugin development may not have versioned cache siblings.
    }
    candidates.push(pluginRoot);
    return candidates;
}
function resolveDataRoot(pluginRoot) {
    return process.env.CLAUDE_PLUGIN_DATA ?? pluginRoot;
}
function ensurePersistentData(pluginRoot, dataRoot) {
    fs.mkdirSync(dataRoot, { recursive: true });
    if (path.resolve(pluginRoot) === path.resolve(dataRoot))
        return;
    for (const candidate of runtimeCandidates(pluginRoot)) {
        copyPathIfMissing(path.join(candidate, "config.jsonc"), path.join(dataRoot, "config.jsonc"));
        copyPathIfMissing(path.join(candidate, "data"), path.join(dataRoot, "data"));
        copyPathIfMissing(path.join(candidate, "suggestions"), path.join(dataRoot, "suggestions"));
        copyPathIfMissing(path.join(candidate, "backups"), path.join(dataRoot, "backups"));
        copyPathIfMissing(path.join(candidate, "report.md"), path.join(dataRoot, "report.md"));
        copyPathIfMissing(path.join(candidate, "report.html"), path.join(dataRoot, "report.html"));
    }
}
//# sourceMappingURL=runtime.js.map