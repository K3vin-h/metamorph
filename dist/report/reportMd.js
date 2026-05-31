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
exports.refreshReportFromDisk = refreshReportFromDisk;
exports.generateReportMd = generateReportMd;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_js_1 = require("../config.js");
const targetTable_js_1 = require("./targetTable.js");
/** Regenerate report.md from data/analysis.json (updates format after plugin upgrades). */
function refreshReportFromDisk(pluginRoot) {
    const analysisPath = path.join(pluginRoot, "data", "analysis.json");
    if (!fs.existsSync(analysisPath))
        return false;
    try {
        const reportPath = path.join(pluginRoot, "report.md");
        if (fs.existsSync(reportPath)) {
            const analysisMtime = fs.statSync(analysisPath).mtimeMs;
            const reportMtime = fs.statSync(reportPath).mtimeMs;
            if (reportMtime >= analysisMtime)
                return true;
        }
        const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
        if (typeof analysis.sessionCount !== "number" || !Array.isArray(analysis.agents)) {
            return false;
        }
        generateReportMd(pluginRoot, analysis);
        return true;
    }
    catch {
        return false;
    }
}
function generateReportMd(pluginRoot, analysis) {
    const config = (0, config_js_1.loadConfig)(pluginRoot);
    const { sessionCount, totals, agents, skills, languages } = analysis;
    const warmupMet = sessionCount >= config.warmupSessions;
    const lines = [];
    lines.push("# metamorph report", "");
    lines.push("```text");
    lines.push("╭────────────────────────────────────────────╮");
    lines.push("│              METAMORPH REPORT              │");
    lines.push("╰────────────────────────────────────────────╯");
    lines.push("");
    lines.push(`Status: ${warmupMet ? "ready" : `warm-up ${sessionCount}/${config.warmupSessions}`}`);
    lines.push(`Summary: ${totals.sessions} sessions · ${totals.toolCalls} tools · ${totals.agentRuns} agent runs · ${totals.skillLoads} skill loads`);
    lines.push(`Privacy: ${analysis.readMode}`);
    const languageAllowlist = new Set([
        "bash", "c", "cpp", "cs", "css", "diff", "go", "h", "html", "java", "js", "json", "jsonc", "jsonl",
        "jsx", "kt", "md", "php", "py", "rb", "rs", "scss", "sh", "sql", "swift", "ts", "tsx", "txt", "yaml", "yml", "zsh",
    ]);
    const langEntries = Object.entries(languages)
        .filter(([l]) => languageAllowlist.has(l.toLowerCase()))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    if (langEntries.length > 0) {
        lines.push(`Languages: ${langEntries.map(([l, p]) => `${l} ${(p * 100).toFixed(0)}%`).join(" · ")}`);
    }
    if (analysis.totals.sessionsByTool) {
        const { claudeCode, cursor, codex } = analysis.totals.sessionsByTool;
        const parts = [];
        if (claudeCode > 0)
            parts.push(`claude-code: ${claudeCode}`);
        if (cursor > 0)
            parts.push(`cursor: ${cursor}`);
        if (codex > 0)
            parts.push(`codex: ${codex}`);
        if (parts.length > 1)
            lines.push(`Sources: ${parts.join(" · ")}`);
    }
    lines.push("", "Legend:", "  Scores: 0–30 needs attention · 31–70 moderate · 71–100 healthy", "  Flags: inactive=unused · underused=low score · healthy=active · tool-gap=declared tool unused", "         stale-doc=inactive section · correction=repeated fixes", "");
    lines.push(...(0, targetTable_js_1.formatAsciiTargetTable)("Agents", agents));
    lines.push(...(0, targetTable_js_1.formatAsciiTargetTable)("Skills", skills));
    lines.push("", "Efficient: /metamorph --target <id> · /metamorph-report (zero LLM)", "");
    const remaining = config.warmupSessions - sessionCount;
    lines.push(warmupMet
        ? "/metamorph to improve · /metamorph --target <id> for one target · /metamorph-report to refresh"
        : `Warming up — ${remaining} more session${remaining === 1 ? "" : "s"} until improvement suggestions unlock · /metamorph-report to view`);
    lines.push("```");
    const reportPath = path.join(pluginRoot, "report.md");
    fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
}
//# sourceMappingURL=reportMd.js.map
