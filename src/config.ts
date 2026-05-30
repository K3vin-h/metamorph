import * as fs from "fs";
import * as path from "path";
import type { Config, PrivacyMode } from "./types.js";
import { logHookError, isNodeError } from "./hookErrors.js";

const DEFAULTS: Config = {
  mode: "suggest",
  warmupSessions: 5,
  maxSuggestionsPerRun: 3,
  flagThreshold: 40,
  read: {
    scope: "both",
    transcripts: "redacted" as PrivacyMode,
    denyGlobs: ["projects/**/secrets*", "**/*.env*", "**/.env", "**/credentials*"],
  },
  write: {
    targets: { agents: true, skills: true, claudeMd: "both" as const },
    allow: ["agents/*", "skills/*/SKILL.md"],
    deny: [],
  },
  style: { deriveGuide: true, preserveSkeleton: true },
  trackers: ["agentFreq", "toolMix", "langs", "deadWeight", "timeOfDay", "acceptReject", "modelUse"],
};

function stripJsoncComments(text: string): string {
  // Remove // line comments and /* block comments */ while preserving string contents
  let result = "";
  let i = 0;
  let inString = false;

  while (i < text.length) {
    if (inString) {
      if (text[i] === "\\" && i + 1 < text.length) {
        result += text[i] + text[i + 1];
        i += 2;
        continue;
      }
      if (text[i] === '"') inString = false;
      result += text[i++];
      continue;
    }

    if (text[i] === '"') {
      inString = true;
      result += text[i++];
      continue;
    }

    if (text[i] === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }

    if (text[i] === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    result += text[i++];
  }

  return result;
}

function isValidPrivacyMode(v: unknown): v is PrivacyMode {
  return v === "full" || v === "redacted" || v === "off";
}

function parseClaudeMdScope(v: unknown): "global" | "local" | "both" | false {
  if (v === "global" || v === "local" || v === "both") return v;
  if (v === false || v === null || v === undefined) return false;
  if (v === true) return "both"; // backward-compat
  return DEFAULTS.write.targets.claudeMd;
}

function mergeWithDefaults(raw: unknown): Config {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULTS };

  const r = raw as Record<string, unknown>;
  const read = (typeof r.read === "object" && r.read !== null ? r.read : {}) as Record<string, unknown>;
  const write = (typeof r.write === "object" && r.write !== null ? r.write : {}) as Record<string, unknown>;
  const targets = (typeof write.targets === "object" && write.targets !== null ? write.targets : {}) as Record<string, unknown>;
  const style = (typeof r.style === "object" && r.style !== null ? r.style : {}) as Record<string, unknown>;

  return {
    mode: "suggest",
    warmupSessions: typeof r.warmupSessions === "number" ? Math.max(1, Math.min(50, r.warmupSessions)) : DEFAULTS.warmupSessions,
    maxSuggestionsPerRun: typeof r.maxSuggestionsPerRun === "number" ? Math.max(1, Math.min(20, r.maxSuggestionsPerRun)) : DEFAULTS.maxSuggestionsPerRun,
    flagThreshold: typeof r.flagThreshold === "number" ? Math.max(0, Math.min(100, r.flagThreshold)) : DEFAULTS.flagThreshold,
    read: {
      scope: (read.scope === "global" || read.scope === "project" || read.scope === "both") ? read.scope : DEFAULTS.read.scope,
      transcripts: isValidPrivacyMode(read.transcripts) ? read.transcripts : DEFAULTS.read.transcripts,
      denyGlobs: Array.isArray(read.denyGlobs) ? read.denyGlobs.filter((g): g is string => typeof g === "string") : DEFAULTS.read.denyGlobs,
    },
    write: {
      targets: {
        agents: typeof targets.agents === "boolean" ? targets.agents : DEFAULTS.write.targets.agents,
        skills: typeof targets.skills === "boolean" ? targets.skills : DEFAULTS.write.targets.skills,
        claudeMd: parseClaudeMdScope(targets.claudeMd),
      },
      allow: Array.isArray(write.allow) ? write.allow.filter((g): g is string => typeof g === "string") : DEFAULTS.write.allow,
      deny: Array.isArray(write.deny) ? write.deny.filter((g): g is string => typeof g === "string") : DEFAULTS.write.deny,
    },
    style: {
      deriveGuide: typeof style.deriveGuide === "boolean" ? style.deriveGuide : DEFAULTS.style.deriveGuide,
      preserveSkeleton: typeof style.preserveSkeleton === "boolean" ? style.preserveSkeleton : DEFAULTS.style.preserveSkeleton,
    },
    trackers: Array.isArray(r.trackers) ? r.trackers.filter((t): t is string => typeof t === "string") : DEFAULTS.trackers,
  };
}

export function loadConfig(pluginRoot: string): Config {
  const configPath = path.join(pluginRoot, "config.jsonc");
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const stripped = stripJsoncComments(raw);
    const parsed = JSON.parse(stripped);
    return mergeWithDefaults(parsed);
  } catch (err) {
    if (isNodeError(err, "ENOENT")) {
      return { ...DEFAULTS };
    }
    logHookError(pluginRoot, "load-config", err);
    return { ...DEFAULTS };
  }
}

export function writeConfig(pluginRoot: string, config: Config): void {
  const configPath = path.join(pluginRoot, "config.jsonc");
  const json = JSON.stringify(config, null, 2);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, json, "utf8");
}

const SAFE_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export function setConfigValue(pluginRoot: string, keyPath: string, rawValue: string): void {
  const config = loadConfig(pluginRoot);
  const keys = keyPath.split(".");

  // Block prototype pollution — every key segment must be a safe identifier (M-6)
  for (const k of keys) {
    if (!SAFE_KEY_RE.test(k)) {
      throw new Error(`Invalid config key segment: "${k}"`);
    }
  }

  // Parse value — guard empty string to avoid Number("") === 0 coercion (MEDIUM)
  let value: unknown = rawValue;
  if (rawValue === "true") value = true;
  else if (rawValue === "false") value = false;
  else if (rawValue.trim() !== "" && !isNaN(Number(rawValue))) value = Number(rawValue);

  // Set nested key
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = config;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof obj[keys[i]] !== "object" || obj[keys[i]] === null) {
      throw new Error(`Invalid config key path: ${keyPath}`);
    }
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;

  // Re-merge with defaults to validate all bounds
  const validated = mergeWithDefaults(config);
  writeConfig(pluginRoot, validated);
}

export { DEFAULTS, mergeWithDefaults };
