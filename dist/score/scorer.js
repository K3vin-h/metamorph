"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreTarget = scoreTarget;
const security_js_1 = require("../security.js");
// Keywords that suggest a section's content is being exercised
const SECTION_KEYWORDS = {
    "security": ["security", "auth", "secret", "permission"],
    "testing": ["test", "spec", "coverage", "assert"],
    "review": ["review", "lint", "check", "audit"],
    "rollback": ["rollback", "restore", "undo", "revert"],
    "setup": ["setup", "install", "configure", "init"],
};
function computeSectionScore(sections, _rawContent, usedTools) {
    if (sections.length === 0)
        return { score: 100, deadSections: [] };
    const deadSections = [];
    const usedToolsLower = usedTools.map((t) => t.toLowerCase());
    let hitCount = 0;
    for (const section of sections) {
        const headingText = section.replace(/^#+\s*/, "").toLowerCase();
        let hit = false;
        // Check if any section keyword category matches used tools
        for (const [, keywords] of Object.entries(SECTION_KEYWORDS)) {
            if (keywords.some((kw) => headingText.includes(kw))) {
                if (usedToolsLower.some((t) => keywords.some((kw) => t.includes(kw)))) {
                    hit = true;
                    break;
                }
            }
        }
        if (hit) {
            hitCount++;
        }
        else {
            deadSections.push(section);
        }
    }
    const score = sections.length > 0 ? (hitCount / sections.length) * 100 : 100;
    return { score, deadSections };
}
function scoreTarget(data, totals, config, kind) {
    const { id, path, invocations, declaredTools, usedTools, sections, rawContent, loads, applied } = data;
    const readMode = config.read.transcripts;
    // Invocation score (40%)
    const totalRuns = kind === "agent" ? Math.max(1, totals.agentRuns) : Math.max(1, totals.skillLoads);
    const invocationScore = Math.min(100, (invocations / totalRuns) * 100 * 5); // *5 so ~20% usage = 100
    // Tool usage score (30%)
    const toolScore = declaredTools.length === 0
        ? 100
        : (usedTools.length / declaredTools.length) * 100;
    // Section coverage score (20%)
    const { score: sectionScore, deadSections } = computeSectionScore(sections, rawContent, usedTools);
    // Skill apply score (10%) — only meaningful for skills
    const skillApplyScore = kind === "skill" ? (loads === 0 ? 100 : (applied / loads) * 100) : 100;
    const combined = Math.round(invocationScore * 0.4 +
        toolScore * 0.3 +
        sectionScore * 0.2 +
        skillApplyScore * 0.1);
    // Generate flags
    const flags = [];
    if (invocations === 0) {
        flags.push({ type: "never-invoked-agent", confidence: "high" });
    }
    else if (combined < config.flagThreshold) {
        flags.push({ type: "rarely-used-agent", confidence: "low" });
    }
    else if (combined >= 80) {
        flags.push({ type: "hot-path", confidence: "high" });
    }
    for (const tool of declaredTools) {
        if (!usedTools.includes(tool)) {
            // In redacted/off mode we can't see subagent tool calls, so tool-usage flags are uncertain
            const toolConfidence = readMode === "full" ? "high" : "low";
            flags.push({ type: "unused-tool", target: tool, confidence: toolConfidence });
        }
    }
    for (const section of deadSections) {
        // "dead-section" (high confidence) only in full mode where we can see tool call content.
        // In redacted/off mode, section coverage is a heuristic — always low confidence.
        const type = readMode === "full" ? "dead-section" : "low-confidence-dead-section";
        const confidence = readMode === "full" ? "high" : "low";
        flags.push({ type, section, confidence });
    }
    if (kind === "skill" && loads > 0 && applied === 0) {
        flags.push({ type: "never-applied-skill", confidence: "high" });
    }
    // Build flagged section text (only for flagged sections, to keep analysis.json compact)
    const flaggedSectionText = {};
    for (const flag of flags) {
        if (flag.section) {
            const sectionContent = extractSectionContent(rawContent, flag.section);
            if (sectionContent) {
                flaggedSectionText[flag.section] = (0, security_js_1.scrubSecrets)(sectionContent);
            }
        }
    }
    return {
        id,
        path,
        score: Math.max(0, Math.min(100, combined)),
        invocations,
        declaredTools,
        usedTools,
        flags,
        ...(Object.keys(flaggedSectionText).length > 0 ? { flaggedSectionText } : {}),
    };
}
function extractSectionContent(content, sectionHeading) {
    const lines = content.split("\n");
    const headingLevel = (sectionHeading.match(/^#+/) ?? [""])[0].length;
    let inSection = false;
    const sectionLines = [];
    for (const line of lines) {
        if (line.trim() === sectionHeading.trim()) {
            inSection = true;
            sectionLines.push(line);
            continue;
        }
        if (inSection) {
            const level = (line.match(/^#+/) ?? [""])[0].length;
            if (level > 0 && level <= headingLevel)
                break;
            sectionLines.push(line);
        }
    }
    return sectionLines.join("\n").trim();
}
//# sourceMappingURL=scorer.js.map