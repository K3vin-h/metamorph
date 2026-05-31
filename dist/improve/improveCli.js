"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printImproveStats = printImproveStats;
exports.printImproveTargets = printImproveTargets;
exports.printImproveTargetsActionable = printImproveTargetsActionable;
exports.printImproveStatus = printImproveStatus;
const config_js_1 = require("../config.js");
const flagsShort_js_1 = require("./flagsShort.js");
const targetTable_js_1 = require("../report/targetTable.js");
const actionableTargets_js_1 = require("./actionableTargets.js");
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
function printImproveTargetsActionable(pluginRoot, analysis) {
    const config = (0, config_js_1.loadConfig)(pluginRoot);
    const actionableAgents = (0, actionableTargets_js_1.filterActionableTargets)(analysis.agents, config);
    const actionableSkills = (0, actionableTargets_js_1.filterActionableTargets)(analysis.skills, config);
    const neverCount = (0, actionableTargets_js_1.countNeverUsed)(analysis.agents) + (0, actionableTargets_js_1.countNeverUsed)(analysis.skills);
    console.log("## Recommended targets (used, score ≥ " + config.improve.minScore + ")\n");
    if (actionableAgents.length === 0 && actionableSkills.length === 0) {
        console.log("No actionable targets yet — use agents/skills in sessions, then re-run session-end.");
    }
    else {
        for (const line of (0, targetTable_js_1.formatAsciiTargetTable)("Agents", actionableAgents)) {
            console.log(line);
        }
        for (const line of (0, targetTable_js_1.formatAsciiTargetTable)("Skills", actionableSkills)) {
            console.log(line);
        }
    }
    console.log(`\nNever used: ${neverCount} — consider pruning from ~/.claude/agents/ or ~/.cursor/skills-cursor/`);
    console.log("Efficient: /metamorph --target <id> · /metamorph-report (zero LLM)");
    console.log(`\nMax per run: ${config.maxSuggestionsPerRun} (pick from recommended, or 'top N')`);
}
function printImproveStatus(pluginRoot, analysis) {
    const config = (0, config_js_1.loadConfig)(pluginRoot);
    const actionable = [
        ...(0, actionableTargets_js_1.filterActionableTargets)(analysis.agents, config),
        ...(0, actionableTargets_js_1.filterActionableTargets)(analysis.skills, config),
    ].slice(0, 3);
    printImproveStats(pluginRoot, analysis);
    if (actionable.length > 0) {
        console.log("Recommended to improve:");
        for (const t of actionable) {
            console.log(`  ${t.id} ${t.score}/100 ${(0, flagsShort_js_1.shortFlag)(t.flags)}`);
        }
        console.log(`  → /metamorph --target ${actionable[0].id}`);
    }
    const top = [...analysis.agents, ...analysis.skills]
        .filter((t) => t.flags.length > 0)
        .sort((a, b) => a.score - b.score)
        .slice(0, 3);
    if (top.length > 0) {
        console.log("Top flags (all targets):");
        for (const t of top) {
            console.log(`  ${t.id} ${t.score}/100 ${(0, flagsShort_js_1.shortFlag)(t.flags)}`);
        }
    }
}
//# sourceMappingURL=improveCli.js.map