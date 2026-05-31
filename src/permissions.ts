import * as fs from "fs";
import * as path from "path";
import type { Config, PermissionResult } from "./types.js";

function globToRegex(pattern: string): string {
  const escapeRegex = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  let regex = "";
  for (let i = 0; i < pattern.length; ) {
    if (pattern.slice(i, i + 2) === "**") {
      regex += "(?:[^/]+/)*";
      i += 2;
    } else if (pattern[i] === "*") {
      regex += "[^/]*";
      i += 1;
    } else {
      regex += escapeRegex(pattern[i]);
      i += 1;
    }
  }
  return `^${regex}$`;
}

function matchGlob(pattern: string, filePath: string): boolean {
  if (filePath.includes("..") || path.isAbsolute(filePath)) return false;
  const regex = new RegExp(globToRegex(pattern));
  return regex.test(filePath);
}

export function resolveProjectRoot(): string | null {
  const candidates = [
    process.env.CLAUDE_PROJECT_DIR,
    process.env.CURSOR_PROJECT_DIR,
    process.env.CLAUDE_CODE_PROJECT_DIR,
    process.cwd(),
  ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    try {
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        return resolved;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function localClaudeMdPath(projectRoot: string): string {
  return path.join(projectRoot, ".claude", "CLAUDE.md");
}

function getCategory(resolvedPath: string, claudeRoot: string): "agents" | "skills" | "claudeMd" | null {
  const rel = path.relative(claudeRoot, resolvedPath);
  if (rel.startsWith("agents" + path.sep) || rel === "agents") return "agents";
  if (rel.startsWith("skills" + path.sep)) return "skills";
  if (rel === "CLAUDE.md") return "claudeMd";
  return null;
}

function claudeMdScopeAllowed(
  resolvedPath: string,
  config: Config,
  claudeRoot: string,
  projectRoot: string | null
): PermissionResult | null {
  const scope = config.write.targets.claudeMd;
  if (!scope) return null;

  const globalPath = path.join(claudeRoot, "CLAUDE.md");
  if (path.resolve(resolvedPath) === path.resolve(globalPath)) {
    if (scope === "global" || scope === "both") return { allowed: true, reason: "ok" };
    return { allowed: false, reason: "category-disabled" };
  }

  if (projectRoot) {
    const localPath = localClaudeMdPath(projectRoot);
    if (path.resolve(resolvedPath) === path.resolve(localPath)) {
      if (scope === "local" || scope === "both") return { allowed: true, reason: "ok" };
      return { allowed: false, reason: "category-disabled" };
    }
  }

  return null;
}

export function checkWritePermission(
  resolvedPath: string,
  config: Config,
  claudeRoot: string,
  projectRoot: string | null = resolveProjectRoot()
): PermissionResult {
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
    } else if (!config.write.targets[category]) {
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

export function checkReadPermission(
  filePath: string,
  denyGlobs: string[],
  claudeRoot: string
): boolean {
  const rel = path.relative(claudeRoot, filePath);
  if (rel.startsWith("..")) return false;
  return !denyGlobs.some((glob) => matchGlob(glob, rel));
}

export { matchGlob };
