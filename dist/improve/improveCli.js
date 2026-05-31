"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printImproveStats = printImproveStats;
exports.printImproveTargets = printImproveTargets;
exports.printImproveStatus = printImproveStatus;
const config_js_1 = require("../config.js");
const flagsShort_js_1 = require("./flagsShort.js");
const targetTable_js_1 = require("../report/targetTable.js");
function printImproveStats(pluginRoot, analysis) {
    const config = (0, config_js_1.loadConfig)(pluginRoot);
    const { sessionCount, totals } = analysis;
    const warmupMet = sessionCount >= config.warmupSessions;
    const warmup = warmupMet
        ? `${sessionCount}/${config.warmupSessions} ✓`
        : `${sessionCount}/${config.warmupSessions}`;
    console.log(`metamorph · ${sessionCount} sessions analyzed`);
    console.log(`Tools: ${totals.toolCalls} · Agents: ${totals.agentRuns} runs · Skills: ${totals.skillLoads} loads`);
    console.log(`Warm-up: ${warmup}`);
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
            console.log(`Sources: ${parts.join(" · ")}`);
    }
    if (analysis.generatedAt) {
        console.log(`Last analysis: ${analysis.generatedAt}`);
    }
}
function printImproveTargets(pluginRoot, analysis) {
    const config = (0, config_js_1.loadConfig)(pluginRoot);
    for (const line of (0, targetTable_js_1.formatAsciiTargetTable)("Agents", analysis.agents)) {
        console.log(line);
    }
    for (const line of (0, targetTable_js_1.formatAsciiTargetTable)("Skills", analysis.skills)) {
        console.log(line);
    }
    console.log("Score: 0–30 needs attention · 31–70 moderate usage · 71–100 healthy");
    console.log("Flags: never=not used · rare=low usage · hot=high demand · tool=unused declared tool · dead=inactive section · mistake=recurring correction patterns");
    console.log(`\nMax per run: ${config.maxSuggestionsPerRun} (lowest scores prioritized)`);
}
function printImproveStatus(pluginRoot, analysis) {
    const top = [...analysis.agents, ...analysis.skills]
        .filter((t) => t.flags.length > 0)
        .sort((a, b) => a.score - b.score)
        .slice(0, 3);
    printImproveStats(pluginRoot, analysis);
    if (top.length > 0) {
        console.log("Top flags:");
        for (const t of top) {
            console.log(`  ${t.id} ${t.score}/100 ${(0, flagsShort_js_1.shortFlag)(t.flags)}`);
        }
    }
}
//# sourceMappingURL=improveCli.js.map