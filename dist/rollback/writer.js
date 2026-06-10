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
exports.readManifest = readManifest;
exports.writeWithBackup = writeWithBackup;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const security_js_1 = require("../security.js");
const permissions_js_1 = require("../permissions.js");
const utils_js_1 = require("../utils.js");
const hookErrors_js_1 = require("../hookErrors.js");
function manifestRelPath(confined, claudeRoot, projectRoot) {
    const relFromClaude = path.relative(claudeRoot, confined);
    if (!relFromClaude.startsWith(".."))
        return relFromClaude;
    if (projectRoot) {
        const relFromProject = path.relative(projectRoot, confined);
        if (!relFromProject.startsWith(".."))
            return relFromProject;
    }
    return confined;
}
const manifestPath = (pluginRoot) => path.join(pluginRoot, "backups", "manifest.json");
function readManifest(pluginRoot) {
    const p = manifestPath(pluginRoot);
    if (!fs.existsSync(p)) {
        return { entries: {} };
    }
    try {
        return JSON.parse(fs.readFileSync(p, "utf8"));
    }
    catch (err) {
        // Corrupt manifest = lost rollback history; surface it instead of failing silently
        (0, hookErrors_js_1.logHookError)(pluginRoot, "read-manifest", `manifest.json corrupted — rollback history unavailable: ${err instanceof Error ? err.message : err}`);
        return { entries: {} };
    }
}
function writeManifest(pluginRoot, manifest) {
    const p = manifestPath(pluginRoot);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = p + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2), "utf8");
    fs.renameSync(tmp, p);
}
// Agents/skills/CLAUDE.md are KB-scale; anything near 1 MB is malformed or hostile
const MAX_CONTENT_BYTES = 1024 * 1024;
function validateContent(content) {
    if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) {
        return { ok: false, error: `Proposed content exceeds ${MAX_CONTENT_BYTES} bytes` };
    }
    const hasFrontmatter = /^---\s*\n[\s\S]*?\n---/.test(content);
    if (hasFrontmatter) {
        const fm = (0, utils_js_1.parseFrontmatter)(content);
        if (!fm.name || !fm.description) {
            return { ok: false, error: "Frontmatter missing required keys: name, description" };
        }
    }
    const fenceMatches = content.match(/^```/gm) ?? [];
    if (fenceMatches.length % 2 !== 0) {
        return { ok: false, error: "Unclosed code fence detected in proposed content" };
    }
    return { ok: true };
}
async function writeWithBackup(targetPath, proposedContent, runId, config, pluginRoot) {
    const claudeRoot = path.join(os.homedir(), ".claude");
    const projectRoot = (0, permissions_js_1.resolveProjectRoot)();
    const allowedRoots = [claudeRoot];
    if (projectRoot)
        allowedRoots.push(projectRoot);
    const confined = (0, security_js_1.confinePath)(targetPath, allowedRoots);
    if (!confined) {
        return { ok: false, error: `Path rejected: ${targetPath} is outside allowed roots or uses path traversal` };
    }
    const perm = (0, permissions_js_1.checkWritePermission)(confined, config, claudeRoot, projectRoot);
    if (!perm.allowed) {
        return { ok: false, error: `Write permission denied: ${perm.reason} for ${confined}` };
    }
    const validation = validateContent(proposedContent);
    if (!validation.ok) {
        return { ok: false, error: `Validation failed: ${validation.error}` };
    }
    const tmpPath = confined + ".metamorph-tmp";
    try {
        fs.writeFileSync(tmpPath, proposedContent, "utf8");
    }
    catch (err) {
        return { ok: false, error: `Failed to write temp file: ${err}` };
    }
    const manifest = readManifest(pluginRoot);
    const relPath = manifestRelPath(confined, claudeRoot, projectRoot);
    const existingEntry = manifest.entries[relPath];
    let currentContent = "";
    try {
        currentContent = fs.readFileSync(confined, "utf8");
    }
    catch {
        // File doesn't exist yet — first write
    }
    if (existingEntry && currentContent) {
        const currentChecksum = (0, security_js_1.sha256)(currentContent);
        if (currentChecksum !== existingEntry.writtenChecksum) {
            console.warn(`[metamorph] Warning: ${relPath} was manually edited since metamorph's last write. ` +
                `Treating your version as the new backup point.`);
        }
    }
    let backupPath = null;
    if (currentContent) {
        const backupDir = path.join(pluginRoot, "backups", path.dirname(relPath));
        fs.mkdirSync(backupDir, { recursive: true });
        backupPath = path.join(pluginRoot, "backups", relPath + ".metamorph-bak");
        const backupTmp = backupPath + ".tmp";
        try {
            fs.writeFileSync(backupTmp, currentContent, "utf8");
            fs.renameSync(backupTmp, backupPath);
        }
        catch (err) {
            try {
                fs.unlinkSync(tmpPath);
            }
            catch { /* ignore */ }
            return { ok: false, error: `Failed to write backup: ${err}` };
        }
    }
    const entry = {
        originalPath: confined,
        backupPath,
        runId,
        timestamp: new Date().toISOString(),
        writtenChecksum: (0, security_js_1.sha256)(proposedContent),
    };
    try {
        fs.renameSync(tmpPath, confined);
    }
    catch (err) {
        try {
            fs.unlinkSync(tmpPath);
        }
        catch { /* ignore */ }
        return { ok: false, error: `Failed to write file: ${err}` };
    }
    manifest.entries[relPath] = entry;
    try {
        writeManifest(pluginRoot, manifest);
    }
    catch (err) {
        (0, hookErrors_js_1.logHookError)(pluginRoot, "write-manifest", err);
        return {
            ok: true,
            message: `Written: ${relPath} (warning: manifest update failed — rollback list may be incomplete)`,
        };
    }
    return { ok: true, message: `Written: ${relPath}` };
}
//# sourceMappingURL=writer.js.map