/** Extract skill id from a Read path like .../skills/foo/SKILL.md or .../skills-cursor/foo/SKILL.md */
export function extractSkillIdFromPath(filePath: string): string | undefined {
  const normalized = filePath.replace(/\\/g, "/");
  const match = normalized.match(
    /(?:^|\/)(?:skills-cursor|skills|\.cursor\/skills(?:-cursor)?)\/([^/]+)\/SKILL\.md$/i
  );
  return match?.[1];
}

export function isAgentTool(toolName: string): boolean {
  return toolName === "Agent" || toolName === "Task";
}
