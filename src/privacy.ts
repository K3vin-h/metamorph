import * as crypto from "crypto";
import * as path from "path";
import { scrubSecrets } from "./security.js";
import { checkReadPermission } from "./permissions.js";
import { extractSkillIdFromPath, isAgentTool } from "./skillPath.js";
import type { PrivacyMode, RawTranscriptLine, TranscriptEvent } from "./types.js";

const COMMAND_CATEGORIES = ["git", "test", "build", "npm", "yarn", "pnpm", "docker", "python", "node"] as const;

function detectCommandCategory(command: string): string {
  const lower = command.toLowerCase();
  for (const cat of COMMAND_CATEGORIES) {
    if (lower.startsWith(cat + " ") || lower.startsWith(cat + "\n") || lower === cat) {
      return cat;
    }
  }
  return "other";
}

function extractFileExtensions(input: Record<string, unknown>): string[] {
  const exts = new Set<string>();
  const filePath = input.file_path ?? input.path ?? input.command;
  if (typeof filePath === "string") {
    const ext = path.extname(filePath);
    if (ext) exts.add(ext.toLowerCase());
  }
  return [...exts];
}

function hashPathStem(filePath: string): string {
  const stem = path.basename(filePath, path.extname(filePath));
  return crypto.createHash("sha256").update(stem).digest("hex").slice(0, 12);
}

function extractAgentId(input: Record<string, unknown>): string | undefined {
  if (typeof input.subagent_type === "string") return input.subagent_type;
  return undefined;
}

function extractSkillId(input: Record<string, unknown>): string | undefined {
  if (typeof input.skill === "string") return input.skill;
  return undefined;
}

function attachToolMetadata(
  event: TranscriptEvent,
  toolName: string,
  input: Record<string, unknown>,
  filePath: unknown
): void {
  if (isAgentTool(toolName)) {
    event.agentId = extractAgentId(input);
  }
  if (toolName === "Skill") {
    event.skillId = extractSkillId(input);
  }
  if (toolName === "Read" && typeof filePath === "string") {
    event.skillId = extractSkillIdFromPath(filePath);
  }
}

export function filterTranscriptEvent(
  line: RawTranscriptLine,
  sessionId: string,
  mode: PrivacyMode,
  denyGlobs: string[],
  claudeRoot: string
): TranscriptEvent[] {
  if (mode === "off") return [];
  if (line.role !== "assistant" || !Array.isArray(line.content)) return [];

  const events: TranscriptEvent[] = [];
  const timestamp = line.timestamp ?? new Date().toISOString();

  for (const block of line.content) {
    if (block.type !== "tool_use" || typeof block.name !== "string") continue;

    const toolName = block.name;
    const input = block.input ?? {};
    const filePath = input.file_path ?? input.path;

    if (typeof filePath === "string") {
      const isSkillPathRead = toolName === "Read" && !!extractSkillIdFromPath(filePath);
      if (!isSkillPathRead && !checkReadPermission(filePath as string, denyGlobs, claudeRoot)) {
        continue;
      }
    }

    if (mode === "full") {
      const scrubbedInput: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input)) {
        scrubbedInput[k] = typeof v === "string" ? scrubSecrets(v) : v;
      }
      const event: TranscriptEvent = { sessionId, toolName, timestamp, toolInput: scrubbedInput };
      attachToolMetadata(event, toolName, input, filePath);
      events.push(event);
      continue;
    }

    const event: TranscriptEvent = { sessionId, toolName, timestamp };

    event.fileExtensions = extractFileExtensions(input);

    if (typeof filePath === "string") {
      event.pathStems = [hashPathStem(filePath as string)];
    }

    if (toolName === "Bash" && typeof input.command === "string") {
      event.commandCategory = detectCommandCategory(input.command as string);
    }

    attachToolMetadata(event, toolName, input, filePath);

    events.push(event);
  }

  return events;
}
