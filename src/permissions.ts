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

function getCategory(resolvedPath: string, claudeRoot: string): "agents" | "skills" | "claudeMd" | null {
  const rel = path.relative(claudeRoot, resolvedPath);
  if (rel.startsWith("agents" + path.sep) || rel === "agents") return "agents";
  if (rel.startsWith("skills" + path.sep)) return "skills";
  if (rel === "CLAUDE.md") return "claudeMd";
  return null;
}

export function checkWritePermission(
  resolvedPath: string,
  config: Config,
  claudeRoot: string
): PermissionResult {
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
