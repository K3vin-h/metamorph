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
exports.sessionEnd = sessionEnd;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const hookErrors_js_1 = require("../hookErrors.js");
async function runStage(pluginRoot, name, fn, failures) {
    try {
        await fn();
    }
    catch (err) {
        (0, hookErrors_js_1.logHookError)(pluginRoot, `session-end:${name}`, err);
        failures.push(name);
    }
}
function loadAnalysisFromDisk(pluginRoot) {
    try {
        return JSON.parse(fs.readFileSync(path.join(pluginRoot, "data", "analysis.json"), "utf8"));
    }
    catch {
        return null;
    }
}
async function sessionEnd(pluginRoot, claudeRoot) {
    const sessionId = process.env.CLAUDE_SESSION_ID ?? `session-${Date.now()}`;
    const failures = [];
    await runStage(pluginRoot, "updateCache", async () => {
        const { updateCache } = await Promise.resolve().then(() => __importStar(require("../capture/incrementalCache.js")));
        await updateCache(pluginRoot, claudeRoot, sessionId);
    }, failures);
    let count = 0;
    await runStage(pluginRoot, "increment", async () => {
        const { increment } = await Promise.resolve().then(() => __importStar(require("../capture/sessionCounter.js")));
        count = increment(pluginRoot, sessionId);
    }, failures);
    let analysis = null;
    await runStage(pluginRoot, "runAnalysis", async () => {
        const { runAnalysis } = await Promise.resolve().then(() => __importStar(require("../analyze/analyzer.js")));
        analysis = await runAnalysis(pluginRoot, claudeRoot);
    }, failures);
    if (!analysis) {
        analysis = loadAnalysisFromDisk(pluginRoot);
    }
    if (analysis) {
        const currentAnalysis = analysis;
        await runStage(pluginRoot, "deriveStyleProfile", async () => {
            const { deriveStyleProfile } = await Promise.resolve().then(() => __importStar(require("../style.js")));
            await deriveStyleProfile(pluginRoot, claudeRoot, currentAnalysis);
        }, failures);
        await runStage(pluginRoot, "generateReportMd", async () => {
            const { generateReportMd } = await Promise.resolve().then(() => __importStar(require("../report/reportMd.js")));
            generateReportMd(pluginRoot, currentAnalysis);
        }, failures);
    }
    const { loadConfig } = await Promise.resolve().then(() => __importStar(require("../config.js")));
    const config = loadConfig(pluginRoot);
    const sessionCount = count || analysis?.sessionCount || 0;
    const warmupMet = sessionCount >= config.warmupSessions;
    const lines = [
        "─".repeat(50),
        `metamorph — session ${sessionCount}${warmupMet ? "" : `/${config.warmupSessions} (warming up)`}`,
    ];
    if (failures.length > 0) {
        lines.push(`  warning: some steps failed (${failures.join(", ")}) — see data/hook-errors.log`);
    }
    if (analysis) {
        lines.push(`  analyzed: ${analysis.totals.sessions} sessions, ${analysis.totals.toolCalls} tool calls`);
        if (analysis.totals.skippedTranscriptLines && analysis.totals.skippedTranscriptLines > 0) {
            lines.push(`  note: ${analysis.totals.skippedTranscriptLines} malformed transcript lines skipped`);
        }
        const topFlags = [...analysis.agents, ...analysis.skills]
            .filter((t) => t.flags.length > 0)
            .sort((a, b) => a.score - b.score)
            .slice(0, 3);
        if (topFlags.length > 0) {
            lines.push("  flagged targets:");
            for (const t of topFlags) {
                lines.push(`    ${t.id} score=${t.score} (${t.flags[0].type})`);
            }
        }
    }
    else {
        lines.push("  analysis unavailable — check data/hook-errors.log");
    }
    if (warmupMet) {
        lines.push("  run /metamorph to see improvement suggestions");
    }
    lines.push(`  report: ${path.join(pluginRoot, "report.md")}`);
    lines.push("─".repeat(50));
    console.log(lines.join("\n"));
}
//# sourceMappingURL=sessionEnd.js.map