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
const incrementalCache_js_1 = require("../capture/incrementalCache.js");
const historyParser_js_1 = require("../capture/historyParser.js");
const config_js_1 = require("../config.js");
const feedback_js_1 = require("../feedback.js");
const scorer_js_1 = require("../score/scorer.js");
const sessionCounter_js_1 = require("../capture/sessionCounter.js");
function parseFrontmatter(content) {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match)
        return {};
    const result = {};
    for (const line of match[1].split("\n")) {
        const sep = line.indexOf(":");
        if (sep < 0)
            continue;
        result[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
    }
    return result;
}
function extractSections(content) {
    return content
        .split("\n")
        .filter((l) => l.startsWith("#"))
        .map((l) => l.trim());
}
function extractDeclaredTools(content) {
    // Look for YAML frontmatter tools key or common tool list patterns
    const fm = parseFrontmatter(content);
    if (fm.tools) {
        return fm.tools
            .replace(/[\[\]]/g, "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
    }
    // Try to find tool list in body
    const toolMatch = content.match(/\*\*Tools[:\s]+\*\*(.*?)(?:\n|$)/);
    if (toolMatch) {
        return toolMatch[1].split(/[,;]/).map((t) => t.trim()).filter(Boolean);
    }
    // Look for "(Tools: X, Y, Z)" pattern common in agent files
    const parenMatch = content.match(/\(Tools?:\s*([^)]+)\)/i);
    if (parenMatch) {
        return parenMatch[1].split(",").map((t) => t.trim()).filter(Boolean);
    }
    return [];
}
function loadDefinitionFiles(claudeRoot, category) {
    const defs = [];
    const baseDir = path.join(claudeRoot, category === "agents" ? "agents" : "skills");
    if (!fs.existsSync(baseDir))
        return defs;
    if (category === "agents") {
        for (const file of fs.readdirSync(baseDir)) {
            if (!file.endsWith(".md"))
                continue;
            const filePath = path.join(baseDir, file);
            try {
                const content = fs.readFileSync(filePath, "utf8");
                const fm = parseFrontmatter(content);
                const id = fm.name ?? file.replace(".md", "");
                defs.push({
                    id,
                    filePath,
                    relativePath: path.join("agents", file),
                    declaredTools: extractDeclaredTools(content),
                    sections: extractSections(content),
                    rawContent: content,
                });
            }
            catch {
                // skip unreadable
            }
        }
    }
    else {
        for (const skillDir of fs.readdirSync(baseDir, { withFileTypes: true })) {
            if (!skillDir.isDirectory())
                continue;
            const skillMd = path.join(baseDir, skillDir.name, "SKILL.md");
            if (!fs.existsSync(skillMd))
                continue;
            try {
                const content = fs.readFileSync(skillMd, "utf8");
                const fm = parseFrontmatter(content);
                const id = fm.name ?? skillDir.name;
                defs.push({
                    id,
                    filePath: skillMd,
                    relativePath: path.join("skills", skillDir.name, "SKILL.md"),
                    declaredTools: extractDeclaredTools(content),
                    sections: extractSections(content),
                    rawContent: content,
                });
            }
            catch {
                // skip
            }
        }
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
    for (const session of Object.values(sessions)) {
        totalToolCalls += session.toolCalls.length;
        for (const [agentId, count] of Object.entries(session.agentInvocations)) {
            agentInvocations[agentId] = (agentInvocations[agentId] ?? 0) + count;
            totalAgentRuns += count;
            if (!agentUsedTools[agentId])
                agentUsedTools[agentId] = new Set();
            // Tools used by this agent — we get this from tool calls attributed to agent context
            // For now populate from general tool calls
        }
        for (const ev of session.toolCalls) {
            if (ev.agentId) {
                if (!agentUsedTools[ev.agentId])
                    agentUsedTools[ev.agentId] = new Set();
                agentUsedTools[ev.agentId].add(ev.toolName);
            }
        }
        for (const [skillId, count] of Object.entries(session.skillLoads)) {
            skillLoads[skillId] = (skillLoads[skillId] ?? 0) + count;
            totalSkillLoads += count;
        }
        for (const [skillId, count] of Object.entries(session.skillApplied)) {
            skillApplied[skillId] = (skillApplied[skillId] ?? 0) + count;
        }
        for (const [ext, count] of Object.entries(session.fileExtensions)) {
            fileExtensions[ext] = (fileExtensions[ext] ?? 0) + count;
        }
    }
    return { agentInvocations, agentUsedTools, skillLoads, skillApplied, fileExtensions, totalToolCalls, totalAgentRuns, totalSkillLoads };
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
    const history = (0, historyParser_js_1.parseHistory)(claudeRoot, config.read.denyGlobs);
    const feedback = (0, feedback_js_1.readFeedbackEntries)(pluginRoot);
    const sessionCount = (0, sessionCounter_js_1.getCount)(pluginRoot);
    const agg = aggregateProfiles(cache.sessions);
    // Merge history data
    for (const [k, v] of Object.entries(history.skillLoads)) {
        agg.skillLoads[k] = (agg.skillLoads[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(history.skillApplied)) {
        agg.skillApplied[k] = (agg.skillApplied[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(history.fileExtensions)) {
        agg.fileExtensions[k] = (agg.fileExtensions[k] ?? 0) + v;
    }
    const totals = {
        sessions: Object.keys(cache.sessions).length,
        toolCalls: agg.totalToolCalls,
        agentRuns: agg.totalAgentRuns,
        skillLoads: agg.totalSkillLoads,
    };
    const languages = computeLanguages(agg.fileExtensions);
    // Score agents
    const agentDefs = loadDefinitionFiles(claudeRoot, "agents");
    const agents = agentDefs.map((def) => {
        const invocations = agg.agentInvocations[def.id] ?? 0;
        const usedTools = [...(agg.agentUsedTools[def.id] ?? new Set())];
        return (0, scorer_js_1.scoreTarget)({ id: def.id, path: def.relativePath, invocations, declaredTools: def.declaredTools, usedTools, sections: def.sections, rawContent: def.rawContent, loads: 0, applied: 0 }, totals, config, "agent");
    });
    // Score skills
    const skillDefs = loadDefinitionFiles(claudeRoot, "skills");
    const skills = skillDefs.map((def) => {
        const loads = agg.skillLoads[def.id] ?? 0;
        const applied = agg.skillApplied[def.id] ?? 0;
        return (0, scorer_js_1.scoreTarget)({ id: def.id, path: def.relativePath, invocations: loads, declaredTools: def.declaredTools, usedTools: [], sections: def.sections, rawContent: def.rawContent, loads, applied }, totals, config, "skill");
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
    // Write atomically
    const analysisPath = path.join(pluginRoot, "data", "analysis.json");
    fs.mkdirSync(path.dirname(analysisPath), { recursive: true });
    const tmp = analysisPath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(result, null, 2), "utf8");
    fs.renameSync(tmp, analysisPath);
    return result;
}
//# sourceMappingURL=analyzer.js.map