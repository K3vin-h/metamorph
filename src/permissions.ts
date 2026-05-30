import * as path from "path";
import type { Config, PermissionResult } from "./types.js";

function matchGlob(pattern: string, filePath: string): boolean {
  // Simple glob matching: supports * (any segment chars) and ** (any path segments)
  const escapeRegex = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");

  const regexStr = pattern
    .split("**")
    .map((part) =>
      part
        .split("*")
        .map(escapeRegex)
        .join("[^/]*")
    )
    .join(".*");

  const regex = new RegExp(`^${regexStr}$`);
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
  // 1. Path safety: must not contain traversal (already resolved, but double-check)
  if (resolvedPath.includes("..")) {
    return { allowed: false, reason: "path-traversal" };
  }

  // 2. Must be inside claudeRoot
  const rel = path.relative(claudeRoot, resolvedPath);
  if (rel.startsWith("..")) {
    return { allowed: false, reason: "outside-root" };
  }

  // 3. Category toggle check
  const category = getCategory(resolvedPath, claudeRoot);
  if (category !== null) {
    if (!config.write.targets[category]) {
      return { allowed: false, reason: "category-disabled" };
    }
  }

  // 4. Deny glob list — any match wins
  for (const denyGlob of config.write.deny) {
    if (matchGlob(denyGlob, rel)) {
      return { allowed: false, reason: "deny-glob" };
    }
  }

  // 5. Allow glob list — must match at least one
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
  return !denyGlobs.some((glob) => matchGlob(glob, rel));
}

export { matchGlob };
