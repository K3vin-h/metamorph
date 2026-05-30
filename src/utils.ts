/** Safe identifier for suggestion ids, target ids, and config key segments. */
export const SAFE_ID_RE = /^[\w\-]+$/;

export function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const sep = line.indexOf(":");
    if (sep < 0) continue;
    result[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
  }
  return result;
}

export function assertSafeId(id: string, label: string): void {
  if (!SAFE_ID_RE.test(id)) {
    throw new Error(`Invalid ${label}: ${id}`);
  }
}
