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
const targetTable_js_1 = require("./targetTable.js");
function generateReportMd(pluginRoot, analysis) {
    const config = (0, config_js_1.loadConfig)(pluginRoot);
    const { sessionCount, totals, agents, skills, languages } = analysis;
    const warmupMet = sessionCount >= config.warmupSessions;
    const lines = [];
    lines.push(warmupMet
        ? `# metamorph · ready`
        : `# metamorph · warm-up ${sessionCount}/${config.warmupSessions}`);
    lines.push(`${totals.sessions} sessions · ${totals.toolCalls} tools · ${totals.agentRuns} agent runs · ${totals.skillLoads} skill loads · ${analysis.readMode}`);
    const langEntries = Object.entries(languages)
        .filter(([l]) => l.length <= 12 && !l.includes("\n"))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    if (langEntries.length > 0) {
        lines.push(langEntries.map(([l, p]) => `${l} ${(p * 100).toFixed(0)}%`).join(" · "));
    }
    lines.push("", "_flag: — ok · never · rare · hot · tool · dead · mistake_", "");
    lines.push(...(0, targetTable_js_1.formatAsciiTargetTable)("Agents", agents));
    lines.push(...(0, targetTable_js_1.formatAsciiTargetTable)("Skills", skills));
    lines.push(warmupMet
        ? "/metamorph · /metamorph --target <id> · /metamorph-report"
        : "Warm-up — /metamorph-report to view · suggestions after warm-up");
    const reportPath = path.join(pluginRoot, "report.md");
    fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
}
//# sourceMappingURL=reportMd.js.map