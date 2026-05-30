import * as fs from "fs";
import * as path from "path";
import type { StyleProfile, AnalysisResult } from "./types.js";
import { loadConfig } from "./config.js";
import { logHookError } from "./hookErrors.js";

const styleProfilePath = (pluginRoot: string) =>
  path.join(pluginRoot, "data", "style-profile.json");

function detectBulletStyle(content: string): "-" | "*" | "+" {
  const dashCount = (content.match(/^- /gm) ?? []).length;
  const starCount = (content.match(/^\* /gm) ?? []).length;
  const plusCount = (content.match(/^\+ /gm) ?? []).length;
  if (starCount > dashCount && starCount > plusCount) return "*";
  if (plusCount > dashCount && plusCount > starCount) return "+";
  return "-";
}

function detectHeadingStyle(content: string): "atx" | "setext" {
  const setextUnderlines = (content.match(/^[=\-]{2,}\s*$/gm) ?? []).length;
  return setextUnderlines > 2 ? "setext" : "atx";
}

function extractFrontmatterKeys(content: string): string[] {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((l) => l.split(":")[0].trim())
    .filter(Boolean);
}

function extractToneKeywords(content: string): string[] {
  const modals = ["should", "must", "always", "never", "prefer", "avoid", "use", "ensure"];
  const found = new Set<string>();
  const lower = content.toLowerCase();
  for (const w of modals) {
    if (lower.includes(w)) found.add(w);
  }
  return [...found];
}

function avgSectionWordCount(content: string): number {
  const sections = content.split(/^#{1,6} /m).slice(1);
  if (sections.length === 0) return 0;
  const total = sections.reduce((sum, s) => sum + s.split(/\s+/).length, 0);
  return Math.round(total / sections.length);
}

function mergeFrontmatterKeyOrders(orders: string[][]): string[] {
  const freq: Record<string, Record<number, number>> = {};
  for (const order of orders) {
    for (let i = 0; i < order.length; i++) {
      if (!freq[order[i]]) freq[order[i]] = {};
      freq[order[i]][i] = (freq[order[i]][i] ?? 0) + 1;
    }
  }
  const keys = Object.keys(freq);
  keys.sort((a, b) => {
    const bestPos = (key: string) =>
      Object.entries(freq[key]).reduce(
        (best, [pos, cnt]) => (cnt > (freq[key][Number(best)] ?? 0) ? pos : best),
        "0"
      );
    return Number(bestPos(a)) - Number(bestPos(b));
  });
  return keys;
}

export async function deriveStyleProfile(
  pluginRoot: string,
  claudeRoot: string,
  _analysis: AnalysisResult
): Promise<StyleProfile> {
  const config = loadConfig(pluginRoot);

  const filesToScan: string[] = [];

  const agentsDir = path.join(claudeRoot, "agents");
  if (config.write.targets.agents && fs.existsSync(agentsDir)) {
    for (const f of fs.readdirSync(agentsDir)) {
      if (f.endsWith(".md")) filesToScan.push(path.join(agentsDir, f));
    }
  }

  const skillsDir = path.join(claudeRoot, "skills");
  if (config.write.targets.skills && fs.existsSync(skillsDir)) {
    for (const skillDir of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!skillDir.isDirectory()) continue;
      const skillMd = path.join(skillsDir, skillDir.name, "SKILL.md");
      if (fs.existsSync(skillMd)) filesToScan.push(skillMd);
    }
  }

  const bulletCounts: Record<"-" | "*" | "+", number> = { "-": 0, "*": 0, "+": 0 };
  const headingCounts: Record<"atx" | "setext", number> = { atx: 0, setext: 0 };
  const frontmatterOrders: string[][] = [];
  let hasNumberedLists = false;
  const toneKeywords = new Set<string>();
  const wordCounts: number[] = [];
  let filesRead = 0;

  for (const filePath of filesToScan) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      filesRead++;
      bulletCounts[detectBulletStyle(content)]++;
      headingCounts[detectHeadingStyle(content)]++;
      frontmatterOrders.push(extractFrontmatterKeys(content));
      if (/^\d+\. /m.test(content)) hasNumberedLists = true;
      for (const kw of extractToneKeywords(content)) toneKeywords.add(kw);
      wordCounts.push(avgSectionWordCount(content));
    } catch (err) {
      logHookError(pluginRoot, `style-scan:${filePath}`, err);
    }
  }

  const profile: StyleProfile = {
    frontmatterKeyOrder: mergeFrontmatterKeyOrders(frontmatterOrders),
    headingStyle: headingCounts.setext > headingCounts.atx ? "setext" : "atx",
    bulletStyle: (Object.entries(bulletCounts).sort((a, b) => b[1] - a[1])[0][0]) as "-" | "*" | "+",
    numberedLists: hasNumberedLists,
    toneKeywords: [...toneKeywords],
    avgSectionLength: wordCounts.length > 0 ? Math.round(wordCounts.reduce((s, n) => s + n, 0) / wordCounts.length) : 0,
    derivedFromFiles: filesRead,
  };

  const p = styleProfilePath(pluginRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  try {
    fs.writeFileSync(tmp, JSON.stringify(profile, null, 2), "utf8");
    fs.renameSync(tmp, p);
  } catch (err) {
    logHookError(pluginRoot, "write-style-profile", err);
    throw err;
  }

  return profile;
}

export function loadStyleProfile(pluginRoot: string): StyleProfile | null {
  const p = styleProfilePath(pluginRoot);
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}
