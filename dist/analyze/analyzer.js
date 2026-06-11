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
exports.runAnalysis = runAnalysis;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const incrementalCache_js_1 = require("../capture/incrementalCache.js");
const historyParser_js_1 = require("../capture/historyParser.js");
const config_js_1 = require("../config.js");
const security_js_1 = require("../security.js");
const scorer_js_1 = require("../score/scorer.js");
const mistakeAggregator_js_1 = require("./mistakeAggregator.js");
const sessionCounter_js_1 = require("../capture/sessionCounter.js");
const utils_js_1 = require("../utils.js");
const hookErrors_js_1 = require("../hookErrors.js");
const feedback_js_1 = require("../feedback.js");
function extractSections(content) {
    return content
        .split("\n")
        .filter((l) => l.startsWith("#"))
        .map((l) => l.trim());
}
function extractDeclaredTools(content) {
    const fm = (0, utils_js_1.parseFrontmatter)(content);
    if (fm.tools) {
        return fm.tools
            .replace(/[\[\]]/g, "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
    }
    const toolMatch = content.match(/\*\*Tools[:\s]+\*\*(.*?)(?:\n|$)/);
    if (toolMatch) {
        return toolMatch[1].split(/[,;]/).map((t) => t.trim()).filter(Boolean);
    }
    const parenMatch = content.match(/\(Tools?:\s*([^)]+)\)/i);
    if (parenMatch) {
        return parenMatch[1].split(",").map((t) => t.trim()).filter(Boolean);
    }
    return [];
}
function loadSkillsFromDirectory(skillsDir, relativePrefix, allowedRoot, pluginRoot, seen) {
    const defs = [];
    if (!fs.existsSync(skillsDir))
        return defs;
    for (const skillDir of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (!skillDir.isDirectory())
            continue;
        const skillMd = path.join(skillsDir, skillDir.name, "SKILL.md");
        if (!fs.existsSync(skillMd))
            continue;
        const confined = (0, security_js_1.confinePath)(skillMd, [allowedRoot]);
        if (!confined) {
            (0, hookErrors_js_1.logHookError)(pluginRoot, `load-skill-def:${skillDir.name}`, "path outside allowed roots");
            continue;
        }
        try {
            const content = fs.readFileSync(confined, "utf8");
            const fm = (0, utils_js_1.parseFrontmatter)(content);
            const id = fm.name ?? skillDir.name;
            if (seen.has(id))
                continue;
            seen.add(id);
            defs.push({
                id,
                filePath: confined,
                relativePath: path.join(relativePrefix, skillDir.name, "SKILL.md"),
                declaredTools: extractDeclaredTools(content),
                sections: extractSections(content),
                rawContent: content,
            });
        }
        catch (err) {
            (0, hookErrors_js_1.logHookError)(pluginRoot, `load-skill-def:${skillDir.name}`, err);
        }
    }
    return defs;
}
function loadDefinitionFiles(claudeRoot, category, pluginRoot, seen) {
    const defs = [];
    const baseDir = path.join(claudeRoot, category === "agents" ? "agents" : "skills");
    if (!fs.existsSync(baseDir))
        return defs;
    if (category === "agents") {
        for (const file of fs.readdirSync(baseDir)) {
            if (!file.endsWith(".md"))
                continue;
            const filePath = path.join(baseDir, file);
            const confined = (0, security_js_1.confinePath)(filePath, [claudeRoot]);
            if (!confined) {
                (0, hookErrors_js_1.logHookError)(pluginRoot, `load-agent-def:${file}`, "path outside allowed roots");
                continue;
            }
            try {
                const content = fs.readFileSync(confined, "utf8");
                const fm = (0, utils_js_1.parseFrontmatter)(content);
                const id = fm.name ?? file.replace(".md", "");
                defs.push({
                    id,
                    filePath: confined,
                    relativePath: path.join("agents", file),
                    declaredTools: extractDeclaredTools(content),
                    sections: extractSections(content),
                    rawContent: content,
                });
            }
            catch (err) {
                (0, hookErrors_js_1.logHookError)(pluginRoot, `load-agent-def:${file}`, err);
            }
        }
    }
    else {
        return loadSkillsFromDirectory(baseDir, "skills", claudeRoot, pluginRoot, seen ?? new Set());
    }
    return defs;
}
function aggregateProfiles(sessions) {
    const agentInvocations = {};
    const agentUsedTools = {};
    const skillLoads = {};
    const skillApplied = {};
    const fileExtensions = {};
    let totalToolCalls = 0;
    let totalAgentRuns = 0;
    let totalSkillLoads = 0;
    let skippedTranscriptLines = 0;
    const isCountRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
    const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    for (const session of Object.values(sessions)) {
        // Skip malformed cache entries instead of crashing the whole analysis
        if (!Array.isArray(session?.toolCalls) ||
            !isCountRecord(session.agentInvocations) ||
            !isCountRecord(session.skillLoads) ||
            !isCountRecord(session.skillApplied) ||
            !isCountRecord(session.fileExtensions))
            continue;
        totalToolCalls += session.toolCalls.length;
        skippedTranscriptLines += num(session.skippedLines);
        for (const [agentId, count] of Object.entries(session.agentInvocations)) {
            agentInvocations[agentId] = (agentInvocations[agentId] ?? 0) + num(count);
            totalAgentRuns += num(count);
        }
        for (const ev of session.toolCalls) {
            if (ev.agentId) {
                if (!agentUsedTools[ev.agentId])
                    agentUsedTools[ev.agentId] = new Set();
                agentUsedTools[ev.agentId].add(ev.toolName);
            }
        }
        for (const [skillId, count] of Object.entries(session.skillLoads)) {
            skillLoads[skillId] = (skillLoads[skillId] ?? 0) + num(count);
            totalSkillLoads += num(count);
        }
        for (const [skillId, count] of Object.entries(session.skillApplied)) {
            skillApplied[skillId] = (skillApplied[skillId] ?? 0) + num(count);
        }
        for (const [ext, count] of Object.entries(session.fileExtensions)) {
            fileExtensions[ext] = (fileExtensions[ext] ?? 0) + num(count);
        }
    }
    return {
        agentInvocations,
        agentUsedTools,
        skillLoads,
        skillApplied,
        fileExtensions,
        totalToolCalls,
        totalAgentRuns,
        totalSkillLoads,
        skippedTranscriptLines,
    };
}
function computeLanguages(fileExtensions) {
    const total = Object.values(fileExtensions).reduce((s, n) => s + n, 0);
    if (total === 0)
        return {};
    const langs = {};
    for (const [ext, count] of Object.entries(fileExtensions)) {
        langs[ext.replace(/^\./, "")] = Math.round((count / total) * 100) / 100;
    }
    return langs;
}
async function runAnalysis(pluginRoot, claudeRoot) {
    const config = (0, config_js_1.loadConfig)(pluginRoot);
    const cache = (0, incrementalCache_js_1.readProfileCache)(pluginRoot);
    const history = await (0, historyParser_js_1.parseHistory)(claudeRoot, config.read.denyGlobs);
    const feedback = (0, feedback_js_1.readFeedbackEntries)(pluginRoot);
    const sessionCount = (0, sessionCounter_js_1.getCount)(pluginRoot);
    const agg = aggregateProfiles(cache.sessions);
    for (const [k, v] of Object.entries(history.skillLoads)) {
        agg.skillLoads[k] = (agg.skillLoads[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(history.skillApplied)) {
        agg.skillApplied[k] = (agg.skillApplied[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(history.fileExtensions)) {
        agg.fileExtensions[k] = (agg.fileExtensions[k] ?? 0) + v;
    }
    const sessionIds = Object.keys(cache.sessions);
    const sessionsByTool = {
        claudeCode: sessionIds.filter(id => !id.startsWith("cursor-") && !id.startsWith("codex-")).length,
        cursor: sessionIds.filter(id => id.startsWith("cursor-")).length,
        codex: sessionIds.filter(id => id.startsWith("codex-")).length,
    };
    const totals = {
        sessions: sessionIds.length,
        toolCalls: agg.totalToolCalls,
        agentRuns: agg.totalAgentRuns,
        skillLoads: agg.totalSkillLoads,
        ...(agg.skippedTranscriptLines > 0 ? { skippedTranscriptLines: agg.skippedTranscriptLines } : {}),
        sessionsByTool,
    };
    const languages = computeLanguages(agg.fileExtensions);
    const agentDefs = loadDefinitionFiles(claudeRoot, "agents", pluginRoot);
    const agents = agentDefs.map((def) => {
        const invocations = agg.agentInvocations[def.id] ?? 0;
        const usedTools = [...(agg.agentUsedTools[def.id] ?? new Set())];
        const mistakePatterns = (0, mistakeAggregator_js_1.aggregateMistakePatterns)(cache.sessions, pluginRoot, def.id, "agent");
        const profile = (0, scorer_js_1.scoreTarget)({
            id: def.id,
            path: def.relativePath,
            invocations,
            declaredTools: def.declaredTools,
            usedTools,
            sections: def.sections,
            rawContent: def.rawContent,
            loads: 0,
            applied: 0,
            mistakePatterns,
        }, totals, config, "agent");
        return mistakePatterns.length > 0 ? { ...profile, mistakePatterns } : profile;
    });
    // Load skills from all tools — de-duplicate by ID (Claude Code wins)
    const seenSkillIds = new Set();
    const skillDefs = loadDefinitionFiles(claudeRoot, "skills", pluginRoot, seenSkillIds);
    if (config.read.trackCursor) {
        const cursorRoot = config.read.cursorRoot ?? path.join(os.homedir(), ".cursor");
        const cursorSkillsDir = path.join(cursorRoot, "skills-cursor");
        skillDefs.push(...loadSkillsFromDirectory(cursorSkillsDir, "skills-cursor", cursorRoot, pluginRoot, seenSkillIds));
    }
    if (config.read.trackCodex) {
        const codexRoot = config.read.codexRoot ?? path.join(os.homedir(), ".codex");
        const codexSkillsDir = path.join(codexRoot, "skills");
        skillDefs.push(...loadSkillsFromDirectory(codexSkillsDir, "codex-skills", codexRoot, pluginRoot, seenSkillIds));
    }
    const skills = skillDefs.map((def) => {
        const loads = agg.skillLoads[def.id] ?? 0;
        const applied = agg.skillApplied[def.id] ?? 0;
        const mistakePatterns = (0, mistakeAggregator_js_1.aggregateMistakePatterns)(cache.sessions, pluginRoot, def.id, "skill");
        const profile = (0, scorer_js_1.scoreTarget)({
            id: def.id,
            path: def.relativePath,
            invocations: loads,
            declaredTools: def.declaredTools,
            usedTools: [],
            sections: def.sections,
            rawContent: def.rawContent,
            loads,
            applied,
            mistakePatterns,
        }, totals, config, "skill");
        return mistakePatterns.length > 0 ? { ...profile, mistakePatterns } : profile;
    });
    const result = {
        generatedAt: new Date().toISOString(),
        sessionCount,
        readMode: config.read.transcripts,
        totals,
        languages,
        agents,
        skills,
        feedback,
    };
    const analysisPath = path.join(pluginRoot, "data", "analysis.json");
    fs.mkdirSync(path.dirname(analysisPath), { recursive: true });
    const tmp = analysisPath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(result, null, 2), "utf8");
    fs.renameSync(tmp, analysisPath);
    return result;
}
//# sourceMappingURL=analyzer.js.map