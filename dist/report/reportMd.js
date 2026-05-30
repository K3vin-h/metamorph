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
exports.generateReportMd = generateReportMd;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_js_1 = require("../config.js");
function statusLabel(flags) {
    if (flags.length === 0)
        return "ok";
    const f = flags[0];
    switch (f.type) {
        case "never-invoked-agent": return "never invoked";
        case "never-applied-skill": return "never invoked";
        case "rarely-used-agent": return "rarely used";
        case "unused-tool": return f.target ? `unused tool: ${f.target}` : "unused tool";
        case "dead-section": return "dead section";
        case "low-confidence-dead-section": return "possible dead section";
        case "hot-path": return "hot path";
    }
}
function targetTable(title, targets) {
    if (targets.length === 0)
        return [];
    const sorted = [...targets].sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
    const idWidth = Math.max("ID".length, ...sorted.map((t) => t.id.length));
    const lines = [`## ${title}`, "", "```", `${"ID".padEnd(idWidth)}  Score  Status`];
    for (const t of sorted) {
        lines.push(`${t.id.padEnd(idWidth)}  ${String(t.score).padStart(5)}  ${statusLabel(t.flags)}`);
    }
    lines.push("```", "");
    return lines;
}
function generateReportMd(pluginRoot, analysis) {
    const config = (0, config_js_1.loadConfig)(pluginRoot);
    const { sessionCount, totals, agents, skills, languages } = analysis;
    const warmupMet = sessionCount >= config.warmupSessions;
    const lines = [];
    const statusLine = warmupMet
        ? `# metamorph · ready`
        : `# metamorph · ${sessionCount}/${config.warmupSessions} warming up`;
    lines.push(statusLine);
    lines.push(`Sessions: ${totals.sessions} · Tools: ${totals.toolCalls} · Agents: ${totals.agentRuns} · Skills: ${totals.skillLoads} · Privacy: ${analysis.readMode}`);
    lines.push("");
    // Language distribution (single line)
    const langEntries = Object.entries(languages).sort((a, b) => b[1] - a[1]);
    if (langEntries.length > 0) {
        const langStr = langEntries.map(([l, p]) => `${l}:${(p * 100).toFixed(0)}%`).join(", ");
        lines.push(`Languages: ${langStr}`);
        lines.push("");
    }
    lines.push(...targetTable("Agents", agents));
    lines.push(...targetTable("Skills", skills));
    const actionLine = warmupMet
        ? "Run /metamorph for suggestions · Target any: /metamorph --target <id> · View: /metamorph-report"
        : "Suggestions unlock after warm-up · Target any: /metamorph --target <id> · View: /metamorph-report";
    lines.push(actionLine);
    const reportPath = path.join(pluginRoot, "report.md");
    fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
}
//# sourceMappingURL=reportMd.js.map