"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSkillIdFromPath = extractSkillIdFromPath;
exports.isAgentTool = isAgentTool;
/** Extract skill id from a Read path like .../skills/foo/SKILL.md or .../skills-cursor/foo/SKILL.md */
function extractSkillIdFromPath(filePath) {
    const normalized = filePath.replace(/\\/g, "/");
    const match = normalized.match(/(?:^|\/)(?:skills-cursor|skills|\.cursor\/skills(?:-cursor)?)\/([^/]+)\/SKILL\.md$/i);
    return match?.[1];
}
function isAgentTool(toolName) {
    return toolName === "Agent" || toolName === "Task";
}
//# sourceMappingURL=skillPath.js.map