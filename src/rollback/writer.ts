import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { BackupManifest, BackupManifestEntry, CommandResult, Config } from "../types.js";
import { confinePath, sha256 } from "../security.js";
import { checkWritePermission } from "../permissions.js";

const manifestPath = (pluginRoot: string) =>
  path.join(pluginRoot, "backups", "manifest.json");

export function readManifest(pluginRoot: string): BackupManifest {
  try {
    return JSON.parse(fs.readFileSync(manifestPath(pluginRoot), "utf8"));
  } catch {
    return { entries: {} };
  }
}

function writeManifest(pluginRoot: string, manifest: BackupManifest): void {
  const p = manifestPath(pluginRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2), "utf8");
  fs.renameSync(tmp, p);
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const sep = line.indexOf(":");
    if (sep >= 0) result[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
  }
  return result;
}

function validateContent(content: string): CommandResult {
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

export async function writeWithBackup(
  targetPath: string,
  proposedContent: string,
  runId: string,
  config: Config,
  pluginRoot: string
): Promise<CommandResult> {
  const claudeRoot = path.join(os.homedir(), ".claude");
  const allowedRoots = [claudeRoot];

  // 1. Path confinement
  const confined = confinePath(targetPath, allowedRoots);
  if (!confined) {
    return { ok: false, error: `Path rejected: ${targetPath} is outside allowed roots or uses path traversal` };
  }

  // 2. Write permission check
  const perm = checkWritePermission(confined, config, claudeRoot);
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
  } catch (err) {
    return { ok: false, error: `Failed to write temp file: ${err}` };
  }

  // 5. Manual-edit guard
  const manifest = readManifest(pluginRoot);
  const relPath = path.relative(claudeRoot, confined);
  const existingEntry = manifest.entries[relPath];
  let currentContent = "";
  try {
    currentContent = fs.readFileSync(confined, "utf8");
  } catch {
    // File doesn't exist yet — first write
  }

  if (existingEntry && currentContent) {
    const currentChecksum = sha256(currentContent);
    if (currentChecksum !== existingEntry.writtenChecksum) {
      console.warn(
        `[metamorph] Warning: ${relPath} was manually edited since metamorph's last write. ` +
        `Treating your version as the new backup point.`
      );
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
    } catch (err) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      return { ok: false, error: `Failed to write backup: ${err}` };
    }

    // 7. Update manifest
    const entry: BackupManifestEntry = {
      originalPath: confined,
      backupPath,
      runId,
      timestamp: new Date().toISOString(),
      writtenChecksum: sha256(proposedContent),
    };
    manifest.entries[relPath] = entry;
    writeManifest(pluginRoot, manifest);
  }

  // 8. Atomic write
  try {
    fs.renameSync(tmpPath, confined);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    return { ok: false, error: `Failed to write file: ${err}` };
  }

  return { ok: true, message: `Written: ${relPath}` };
}
