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
exports.rollbackList = rollbackList;
exports.rollbackFile = rollbackFile;
exports.rollbackRun = rollbackRun;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const security_js_1 = require("../security.js");
const permissions_js_1 = require("../permissions.js");
const writer_js_1 = require("./writer.js");
const config_js_1 = require("../config.js");
const hookErrors_js_1 = require("../hookErrors.js");
function validateBackupContent(content) {
    const fenceMatches = content.match(/^```/gm) ?? [];
    return fenceMatches.length % 2 === 0;
}
function rollbackList(pluginRoot) {
    const manifest = (0, writer_js_1.readManifest)(pluginRoot);
    const entries = Object.entries(manifest.entries);
    if (entries.length === 0)
        return "No backups available.";
    const lines = ["Restorable backups:", ""];
    for (const [relPath, entry] of entries) {
        if (!entry.backupPath) {
            lines.push(`  ${relPath} [NEW FILE — no prior version to restore] · Run: ${entry.runId}`);
            continue;
        }
        const confinedOriginal = (0, security_js_1.confinePath)(entry.originalPath, [path.join(os.homedir(), ".claude")]);
        let currentChecksum = "";
        try {
            if (!confinedOriginal)
                throw new Error("outside roots");
            const currentContent = fs.readFileSync(confinedOriginal, "utf8");
            currentChecksum = (0, security_js_1.sha256)(currentContent);
        }
        catch {
            lines.push(`  ${relPath} [ORIGINAL NOT FOUND] — Run ID: ${entry.runId} @ ${entry.timestamp}`);
            continue;
        }
        const status = currentChecksum === entry.writtenChecksum
            ? "clean (no manual edits)"
            : "DIVERGED (manual edits detected since metamorph write)";
        lines.push(`  ${relPath}`);
        lines.push(`    Run: ${entry.runId} · ${entry.timestamp}`);
        lines.push(`    Status: ${status}`);
    }
    return lines.join("\n");
}
async function rollbackFile(pluginRoot, filePath) {
    const claudeRoot = path.join(os.homedir(), ".claude");
    const manifest = (0, writer_js_1.readManifest)(pluginRoot);
    const config = (0, config_js_1.loadConfig)(pluginRoot);
    let relPath = filePath;
    let entry = manifest.entries[relPath];
    if (!entry) {
        for (const [k, v] of Object.entries(manifest.entries)) {
            if (v.originalPath === filePath || path.basename(k) === path.basename(filePath)) {
                relPath = k;
                entry = v;
                break;
            }
        }
    }
    if (!entry) {
        return { ok: false, error: `No backup found for: ${filePath}` };
    }
    if (!entry.backupPath) {
        return { ok: false, error: `No backup for ${relPath} — metamorph created this file; delete it manually if needed.` };
    }
    const projectRoot = (0, permissions_js_1.resolveProjectRoot)();
    const allowedRoots = [claudeRoot];
    if (projectRoot)
        allowedRoots.push(projectRoot);
    const confinedTarget = (0, security_js_1.confinePath)(entry.originalPath, allowedRoots);
    if (!confinedTarget) {
        return { ok: false, error: `Restore rejected: target path is outside allowed roots: ${entry.originalPath}` };
    }
    const perm = (0, permissions_js_1.checkWritePermission)(confinedTarget, config, claudeRoot, projectRoot);
    if (!perm.allowed) {
        return { ok: false, error: `Restore rejected: write permission denied (${perm.reason}) for ${relPath}` };
    }
    const confinedBackup = (0, security_js_1.confinePath)(entry.backupPath, [pluginRoot]);
    if (!confinedBackup) {
        return { ok: false, error: `Restore rejected: backup path is outside plugin root: ${entry.backupPath}` };
    }
    if (!fs.existsSync(confinedBackup)) {
        return { ok: false, error: `Backup file not found: ${entry.backupPath}. It may have been deleted externally.` };
    }
    const backupContent = fs.readFileSync(confinedBackup, "utf8");
    if (!validateBackupContent(backupContent)) {
        return { ok: false, error: `Backup file appears corrupted. Cannot restore safely.` };
    }
    try {
        const currentContent = fs.readFileSync(confinedTarget, "utf8");
        const currentChecksum = (0, security_js_1.sha256)(currentContent);
        if (currentChecksum !== entry.writtenChecksum) {
            console.warn(`[metamorph] Warning: ${relPath} has manual edits since metamorph's last write. ` +
                `Restoring backup will overwrite your manual changes.`);
        }
    }
    catch (err) {
        if (!(0, hookErrors_js_1.isNodeError)(err, "ENOENT")) {
            return { ok: false, error: `Cannot read current file before restore: ${err instanceof Error ? err.message : err}` };
        }
    }
    const tmpPath = confinedTarget + ".metamorph-restore-tmp";
    try {
        fs.writeFileSync(tmpPath, backupContent, "utf8");
        fs.renameSync(tmpPath, confinedTarget);
    }
    catch (err) {
        try {
            fs.unlinkSync(tmpPath);
        }
        catch { /* ignore */ }
        return { ok: false, error: `Failed to restore: ${err}` };
    }
    delete manifest.entries[relPath];
    const manifestPath = path.join(pluginRoot, "backups", "manifest.json");
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    const tmp = manifestPath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2), "utf8");
    fs.renameSync(tmp, manifestPath);
    return { ok: true, message: `Restored: ${relPath} from backup (run ${entry.runId})` };
}
async function rollbackRun(pluginRoot, runId) {
    const manifest = (0, writer_js_1.readManifest)(pluginRoot);
    const lines = [`Rollback for run: ${runId}`, ""];
    const runEntries = Object.entries(manifest.entries).filter(([, e]) => e.runId === runId);
    if (runEntries.length === 0) {
        return `No backups found for run: ${runId}`;
    }
    for (const [relPath, entry] of runEntries) {
        const confinedBackup = entry.backupPath ? (0, security_js_1.confinePath)(entry.backupPath, [pluginRoot]) : null;
        if (!confinedBackup || !fs.existsSync(confinedBackup)) {
            lines.push(`  SKIP ${relPath} — backup not found (may have been superseded)`);
            continue;
        }
        const result = await rollbackFile(pluginRoot, relPath);
        if (result.ok) {
            lines.push(`  OK   ${relPath} — restored`);
        }
        else {
            lines.push(`  FAIL ${relPath} — ${result.error}`);
        }
    }
    return lines.join("\n");
}
//# sourceMappingURL=rollback.js.map