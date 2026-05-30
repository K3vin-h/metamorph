"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printImproveStats = printImproveStats;
exports.printImproveTargets = printImproveTargets;
exports.printImproveStatus = printImproveStatus;
const config_js_1 = require("../config.js");
const flagsShort_js_1 = require("./flagsShort.js");
function targetTableMarkdown(title, targets) {
    if (targets.length === 0)
        return "";
    const sorted = [...targets].sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
    const lines = [`## ${title} (${sorted.length})`, "", "| id | score | flag |", "| --- | ---: | :--- |"];
    for (const t of sorted) {
        lines.push(`| ${t.id} | ${t.score}/100 | ${(0, flagsShort_js_1.displayFlag)(t.flags)} |`);
    }
    lines.push("");
    return lines.join("\n");
}
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
    if (analysis.generatedAt) {
        console.log(`Last analysis: ${analysis.generatedAt}`);
    }
}
function printImproveTargets(pluginRoot, analysis) {
    const config = (0, config_js_1.loadConfig)(pluginRoot);
    console.log(targetTableMarkdown("Agents", analysis.agents));
    console.log(targetTableMarkdown("Skills", analysis.skills));
    console.log(`Max per run: ${config.maxSuggestionsPerRun} (lowest scores kept if you pick more)`);
}
function printImproveStatus(pluginRoot, analysis) {
    const config = (0, config_js_1.loadConfig)(pluginRoot);
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