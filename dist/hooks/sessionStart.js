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
exports.sessionStart = sessionStart;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_js_1 = require("../config.js");
function isAnalysisResult(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const v = value;
    return (typeof v.sessionCount === "number" &&
        Array.isArray(v.agents) &&
        Array.isArray(v.skills) &&
        typeof v.totals === "object" &&
        v.totals !== null);
}
async function sessionStart(pluginRoot, _claudeRoot) {
    const analysisPath = path.join(pluginRoot, "data", "analysis.json");
    if (!fs.existsSync(analysisPath)) {
        console.log("metamorph: no data yet — run a session to begin tracking.");
        return;
    }
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
    }
    catch {
        console.log("metamorph: could not read analysis data.");
        return;
    }
    if (!isAnalysisResult(parsed)) {
        console.log("metamorph: analysis data is invalid or from an older version — run a session to refresh.");
        return;
    }
    const analysis = parsed;
    try {
        const { refreshReportFromDisk } = await Promise.resolve().then(() => __importStar(require("../report/reportMd.js")));
        refreshReportFromDisk(pluginRoot);
    }
    catch {
        // Non-fatal — session end will retry report generation
    }
    const config = (0, config_js_1.loadConfig)(pluginRoot);
    const { sessionCount, totals, agents, skills } = analysis;
    const warmupMet = sessionCount >= config.warmupSessions;
    const topFlags = [...agents, ...skills]
        .filter((t) => t.flags.length > 0)
        .sort((a, b) => a.score - b.score)
        .slice(0, 3);
    const lines = ["─".repeat(50), "metamorph"];
    if (!warmupMet) {
        lines.push(`  warming up: ${sessionCount}/${config.warmupSessions} sessions`);
    }
    else {
        lines.push(`  sessions: ${sessionCount} | agents: ${totals.agentRuns} runs | skills: ${totals.skillLoads} loads`);
    }
    if (topFlags.length > 0) {
        lines.push("  top flags:");
        for (const t of topFlags) {
            const flag = t.flags[0];
            lines.push(`    ${t.id} (score ${t.score}) — ${flag.type} [${flag.confidence}]`);
        }
    }
    lines.push(`  report: ${path.join(pluginRoot, "report.md")}`);
    lines.push("─".repeat(50));
    console.log(lines.join("\n"));
}
//# sourceMappingURL=sessionStart.js.map