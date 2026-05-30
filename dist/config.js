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
exports.DEFAULTS = void 0;
exports.loadConfig = loadConfig;
exports.writeConfig = writeConfig;
exports.setConfigValue = setConfigValue;
exports.mergeWithDefaults = mergeWithDefaults;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const hookErrors_js_1 = require("./hookErrors.js");
const DEFAULTS = {
    mode: "suggest",
    warmupSessions: 5,
    maxSuggestionsPerRun: 3,
    flagThreshold: 40,
    read: {
        scope: "both",
        transcripts: "redacted",
        mistakeTracking: true,
        denyGlobs: ["projects/**/secrets*", "**/*.env*", "**/.env", "**/credentials*"],
    },
    write: {
        targets: { agents: true, skills: true, claudeMd: "both" },
        allow: ["agents/*", "skills/*/SKILL.md"],
        deny: [],
    },
    style: { deriveGuide: true, preserveSkeleton: true },
    trackers: ["agentFreq", "toolMix", "langs", "deadWeight", "timeOfDay", "acceptReject", "modelUse"],
};
exports.DEFAULTS = DEFAULTS;
function stripJsoncComments(text) {
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
            if (text[i] === '"')
                inString = false;
            result += text[i++];
            continue;
        }
        if (text[i] === '"') {
            inString = true;
            result += text[i++];
            continue;
        }
        if (text[i] === "/" && text[i + 1] === "/") {
            while (i < text.length && text[i] !== "\n")
                i++;
            continue;
        }
        if (text[i] === "/" && text[i + 1] === "*") {
            i += 2;
            while (i < text.length && !(text[i] === "*" && text[i + 1] === "/"))
                i++;
            i += 2;
            continue;
        }
        result += text[i++];
    }
    return result;
}
function isValidPrivacyMode(v) {
    return v === "full" || v === "redacted" || v === "off";
}
function parseClaudeMdScope(v) {
    if (v === "global" || v === "local" || v === "both")
        return v;
    if (v === false || v === null || v === undefined)
        return false;
    if (v === true)
        return "both"; // backward-compat
    return DEFAULTS.write.targets.claudeMd;
}
function mergeWithDefaults(raw) {
    if (typeof raw !== "object" || raw === null)
        return { ...DEFAULTS };
    const r = raw;
    const read = (typeof r.read === "object" && r.read !== null ? r.read : {});
    const write = (typeof r.write === "object" && r.write !== null ? r.write : {});
    const targets = (typeof write.targets === "object" && write.targets !== null ? write.targets : {});
    const style = (typeof r.style === "object" && r.style !== null ? r.style : {});
    return {
        mode: "suggest",
        warmupSessions: typeof r.warmupSessions === "number" ? Math.max(1, Math.min(50, r.warmupSessions)) : DEFAULTS.warmupSessions,
        maxSuggestionsPerRun: typeof r.maxSuggestionsPerRun === "number" ? Math.max(1, Math.min(20, r.maxSuggestionsPerRun)) : DEFAULTS.maxSuggestionsPerRun,
        flagThreshold: typeof r.flagThreshold === "number" ? Math.max(0, Math.min(100, r.flagThreshold)) : DEFAULTS.flagThreshold,
        read: {
            scope: (read.scope === "global" || read.scope === "project" || read.scope === "both") ? read.scope : DEFAULTS.read.scope,
            transcripts: isValidPrivacyMode(read.transcripts) ? read.transcripts : DEFAULTS.read.transcripts,
            mistakeTracking: typeof read.mistakeTracking === "boolean"
                ? read.mistakeTracking
                : DEFAULTS.read.mistakeTracking,
            denyGlobs: Array.isArray(read.denyGlobs) ? read.denyGlobs.filter((g) => typeof g === "string") : DEFAULTS.read.denyGlobs,
        },
        write: {
            targets: {
                agents: typeof targets.agents === "boolean" ? targets.agents : DEFAULTS.write.targets.agents,
                skills: typeof targets.skills === "boolean" ? targets.skills : DEFAULTS.write.targets.skills,
                claudeMd: parseClaudeMdScope(targets.claudeMd),
            },
            allow: Array.isArray(write.allow) ? write.allow.filter((g) => typeof g === "string") : DEFAULTS.write.allow,
            deny: Array.isArray(write.deny) ? write.deny.filter((g) => typeof g === "string") : DEFAULTS.write.deny,
        },
        style: {
            deriveGuide: typeof style.deriveGuide === "boolean" ? style.deriveGuide : DEFAULTS.style.deriveGuide,
            preserveSkeleton: typeof style.preserveSkeleton === "boolean" ? style.preserveSkeleton : DEFAULTS.style.preserveSkeleton,
        },
        trackers: Array.isArray(r.trackers) ? r.trackers.filter((t) => typeof t === "string") : DEFAULTS.trackers,
    };
}
function loadConfig(pluginRoot) {
    const configPath = path.join(pluginRoot, "config.jsonc");
    try {
        const raw = fs.readFileSync(configPath, "utf8");
        const stripped = stripJsoncComments(raw);
        const parsed = JSON.parse(stripped);
        return mergeWithDefaults(parsed);
    }
    catch (err) {
        if ((0, hookErrors_js_1.isNodeError)(err, "ENOENT")) {
            return { ...DEFAULTS };
        }
        (0, hookErrors_js_1.logHookError)(pluginRoot, "load-config", err);
        return { ...DEFAULTS };
    }
}
function writeConfig(pluginRoot, config) {
    const configPath = path.join(pluginRoot, "config.jsonc");
    const json = JSON.stringify(config, null, 2);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, json, "utf8");
}
const SAFE_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;
function setConfigValue(pluginRoot, keyPath, rawValue) {
    const config = loadConfig(pluginRoot);
    const keys = keyPath.split(".");
    // Block prototype pollution — every key segment must be a safe identifier (M-6)
    for (const k of keys) {
        if (!SAFE_KEY_RE.test(k)) {
            throw new Error(`Invalid config key segment: "${k}"`);
        }
    }
    // Parse value — guard empty string to avoid Number("") === 0 coercion (MEDIUM)
    let value = rawValue;
    if (rawValue === "true")
        value = true;
    else if (rawValue === "false")
        value = false;
    else if (rawValue.trim() !== "" && !isNaN(Number(rawValue)))
        value = Number(rawValue);
    // Set nested key
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let obj = config;
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
//# sourceMappingURL=config.js.map