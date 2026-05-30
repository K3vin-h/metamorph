import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { CommandResult } from "../types.js";
import { sha256, confinePath } from "../security.js";
import { checkWritePermission, resolveProjectRoot } from "../permissions.js";
import { readManifest } from "./writer.js";
import { loadConfig } from "../config.js";
import { isNodeError } from "../hookErrors.js";

function validateBackupContent(content: string): boolean {
  const fenceMatches = content.match(/^```/gm) ?? [];
  return fenceMatches.length % 2 === 0;
}

export function rollbackList(pluginRoot: string): string {
  const manifest = readManifest(pluginRoot);
  const entries = Object.entries(manifest.entries);
  if (entries.length === 0) return "No backups available.";

  const lines = ["Restorable backups:", ""];
  for (const [relPath, entry] of entries) {
    if (!entry.backupPath) {
      lines.push(`  ${relPath} [NEW FILE — no prior version to restore] · Run: ${entry.runId}`);
      continue;
    }

    const confinedOriginal = confinePath(entry.originalPath, [path.join(os.homedir(), ".claude")]);
    let currentChecksum = "";
    try {
      if (!confinedOriginal) throw new Error("outside roots");
      const currentContent = fs.readFileSync(confinedOriginal, "utf8");
      currentChecksum = sha256(currentContent);
    } catch {
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

export async function rollbackFile(pluginRoot: string, filePath: string): Promise<CommandResult> {
  const claudeRoot = path.join(os.homedir(), ".claude");
  const manifest = readManifest(pluginRoot);
  const config = loadConfig(pluginRoot);

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

  const projectRoot = resolveProjectRoot();
  const allowedRoots = [claudeRoot];
  if (projectRoot) allowedRoots.push(projectRoot);

  const confinedTarget = confinePath(entry.originalPath, allowedRoots);
  if (!confinedTarget) {
    return { ok: false, error: `Restore rejected: target path is outside allowed roots: ${entry.originalPath}` };
  }
  const perm = checkWritePermission(confinedTarget, config, claudeRoot, projectRoot);
  if (!perm.allowed) {
    return { ok: false, error: `Restore rejected: write permission denied (${perm.reason}) for ${relPath}` };
  }

  const confinedBackup = confinePath(entry.backupPath, [pluginRoot]);
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
    const currentChecksum = sha256(currentContent);
    if (currentChecksum !== entry.writtenChecksum) {
      console.warn(
        `[metamorph] Warning: ${relPath} has manual edits since metamorph's last write. ` +
        `Restoring backup will overwrite your manual changes.`
      );
    }
  } catch (err) {
    if (!isNodeError(err, "ENOENT")) {
      return { ok: false, error: `Cannot read current file before restore: ${err instanceof Error ? err.message : err}` };
    }
  }

  const tmpPath = confinedTarget + ".metamorph-restore-tmp";
  try {
    fs.writeFileSync(tmpPath, backupContent, "utf8");
    fs.renameSync(tmpPath, confinedTarget);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
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

export async function rollbackRun(pluginRoot: string, runId: string): Promise<string> {
  const manifest = readManifest(pluginRoot);
  const lines: string[] = [`Rollback for run: ${runId}`, ""];

  const runEntries = Object.entries(manifest.entries).filter(([, e]) => e.runId === runId);

  if (runEntries.length === 0) {
    return `No backups found for run: ${runId}`;
  }

  for (const [relPath, entry] of runEntries) {
    const confinedBackup = entry.backupPath ? confinePath(entry.backupPath, [pluginRoot]) : null;
    if (!confinedBackup || !fs.existsSync(confinedBackup)) {
      lines.push(`  SKIP ${relPath} — backup not found (may have been superseded)`);
      continue;
    }

    const result = await rollbackFile(pluginRoot, relPath);
    if (result.ok) {
      lines.push(`  OK   ${relPath} — restored`);
    } else {
      lines.push(`  FAIL ${relPath} — ${result.error}`);
    }
  }

  return lines.join("\n");
}
