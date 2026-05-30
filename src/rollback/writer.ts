import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { BackupManifest, BackupManifestEntry, CommandResult, Config } from "../types.js";
import { confinePath, sha256 } from "../security.js";
import { checkWritePermission, resolveProjectRoot } from "../permissions.js";
import { parseFrontmatter } from "../utils.js";
import { logHookError } from "../hookErrors.js";

function manifestRelPath(confined: string, claudeRoot: string, projectRoot: string | null): string {
  const relFromClaude = path.relative(claudeRoot, confined);
  if (!relFromClaude.startsWith("..")) return relFromClaude;
  if (projectRoot) {
    const relFromProject = path.relative(projectRoot, confined);
    if (!relFromProject.startsWith("..")) return relFromProject;
  }
  return confined;
}

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

function validateContent(content: string): CommandResult {
  const hasFrontmatter = /^---\s*\n[\s\S]*?\n---/.test(content);
  if (hasFrontmatter) {
    const fm = parseFrontmatter(content);
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

export async function writeWithBackup(
  targetPath: string,
  proposedContent: string,
  runId: string,
  config: Config,
  pluginRoot: string
): Promise<CommandResult> {
  const claudeRoot = path.join(os.homedir(), ".claude");
  const projectRoot = resolveProjectRoot();
  const allowedRoots = [claudeRoot];
  if (projectRoot) allowedRoots.push(projectRoot);

  const confined = confinePath(targetPath, allowedRoots);
  if (!confined) {
    return { ok: false, error: `Path rejected: ${targetPath} is outside allowed roots or uses path traversal` };
  }

  const perm = checkWritePermission(confined, config, claudeRoot, projectRoot);
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
  } catch (err) {
    return { ok: false, error: `Failed to write temp file: ${err}` };
  }

  const manifest = readManifest(pluginRoot);
  const relPath = manifestRelPath(confined, claudeRoot, projectRoot);
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
    }
  }

  let backupPath: string | null = null;

  if (currentContent) {
    const backupDir = path.join(pluginRoot, "backups", path.dirname(relPath));
    fs.mkdirSync(backupDir, { recursive: true });
    backupPath = path.join(pluginRoot, "backups", relPath + ".metamorph-bak");
    const backupTmp = backupPath + ".tmp";
    try {
      fs.writeFileSync(backupTmp, currentContent, "utf8");
      fs.renameSync(backupTmp, backupPath);
    } catch (err) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      return { ok: false, error: `Failed to write backup: ${err}` };
    }
  }

  const entry: BackupManifestEntry = {
    originalPath: confined,
    backupPath,
    runId,
    timestamp: new Date().toISOString(),
    writtenChecksum: sha256(proposedContent),
  };

  try {
    fs.renameSync(tmpPath, confined);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    return { ok: false, error: `Failed to write file: ${err}` };
  }

  manifest.entries[relPath] = entry;
  try {
    writeManifest(pluginRoot, manifest);
  } catch (err) {
    logHookError(pluginRoot, "write-manifest", err);
    return {
      ok: true,
      message: `Written: ${relPath} (warning: manifest update failed — rollback list may be incomplete)`,
    };
  }

  return { ok: true, message: `Written: ${relPath}` };
}
