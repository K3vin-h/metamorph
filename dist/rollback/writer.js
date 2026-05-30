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
const manifestPath = (pluginRoot) => path.join(pluginRoot, "backups", "manifest.json");
function readManifest(pluginRoot) {
    try {
        return JSON.parse(fs.readFileSync(manifestPath(pluginRoot), "utf8"));
    }
    catch {
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
function parseFrontmatter(content) {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match)
        return {};
    const result = {};
    for (const line of match[1].split("\n")) {
        const sep = line.indexOf(":");
        if (sep >= 0)
            result[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
    }
    return result;
}
function validateContent(content) {
    // Frontmatter must be parseable and contain required keys
    const hasFrontmatter = /^---\s*\n[\s\S]*?\n---/.test(content);
    if (hasFrontmatter) {
        const fm = parseFrontmatter(content);
        if (!fm.name || !fm.description) {
            return { ok: false, error: "Frontmatter missing required keys: name, description" };
        }
    }
    // Check for unclosed code fences
    const fenceMatches = content.match(/^```/gm) ?? [];
    if (fenceMatches.length % 2 !== 0) {
        return { ok: false, error: "Unclosed code fence detected in proposed content" };
    }
    return { ok: true };
}
async function writeWithBackup(targetPath, proposedContent, runId, config, pluginRoot) {
    const claudeRoot = path.join(os.homedir(), ".claude");
    const allowedRoots = [claudeRoot];
    // 1. Path confinement
    const confined = (0, security_js_1.confinePath)(targetPath, allowedRoots);
    if (!confined) {
        return { ok: false, error: `Path rejected: ${targetPath} is outside allowed roots or uses path traversal` };
    }
    // 2. Write permission check
    const perm = (0, permissions_js_1.checkWritePermission)(confined, config, claudeRoot);
    if (!perm.allowed) {
        return { ok: false, error: `Write permission denied: ${perm.reason} for ${confined}` };
    }
    // 3. Validate content before touching the filesystem
    const validation = validateContent(proposedContent);
    if (!validation.ok) {
        return { ok: false, error: `Validation failed: ${validation.error}` };
    }
    // 4. Write to temp file
    const tmpPath = confined + ".metamorph-tmp";
    try {
        fs.writeFileSync(tmpPath, proposedContent, "utf8");
    }
    catch (err) {
        return { ok: false, error: `Failed to write temp file: ${err}` };
    }
    // 5. Manual-edit guard
    const manifest = readManifest(pluginRoot);
    const relPath = path.relative(claudeRoot, confined);
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
            // Proceed — treat current file as the backup source
        }
    }
    // 6. Backup current content
    if (currentContent) {
        const backupDir = path.join(pluginRoot, "backups", path.dirname(relPath));
        fs.mkdirSync(backupDir, { recursive: true });
        const backupPath = path.join(pluginRoot, "backups", relPath + ".metamorph-bak");
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
        // 7. Update manifest
        const entry = {
            originalPath: confined,
            backupPath,
            runId,
            timestamp: new Date().toISOString(),
            writtenChecksum: (0, security_js_1.sha256)(proposedContent),
        };
        manifest.entries[relPath] = entry;
        writeManifest(pluginRoot, manifest);
    }
    // 8. Atomic write
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
    return { ok: true, message: `Written: ${relPath}` };
}
//# sourceMappingURL=writer.js.map