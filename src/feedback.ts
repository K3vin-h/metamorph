import * as fs from "fs";
import * as path from "path";

const FEEDBACK_LOG = (pluginRoot: string) => path.join(pluginRoot, "data", "feedback.log");
const MAX_ENTRIES = 200;

export function addFeedback(pluginRoot: string, text: string): void {
  const logPath = FEEDBACK_LOG(pluginRoot);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const entry = `[${new Date().toISOString()}] ${text.trim()}\n`;
  fs.appendFileSync(logPath, entry, "utf8");
}

export function listFeedback(pluginRoot: string): string {
  const logPath = FEEDBACK_LOG(pluginRoot);
  if (!fs.existsSync(logPath)) return "No feedback logged yet.";
  return fs.readFileSync(logPath, "utf8").trim();
}

export function clearFeedback(pluginRoot: string): void {
  const logPath = FEEDBACK_LOG(pluginRoot);
  if (fs.existsSync(logPath)) fs.writeFileSync(logPath, "", "utf8");
}

export function readFeedbackEntries(pluginRoot: string): string[] {
  const logPath = FEEDBACK_LOG(pluginRoot);
  if (!fs.existsSync(logPath)) return [];
  return fs
    .readFileSync(logPath, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .slice(-MAX_ENTRIES)
    .map((l) => l.replace(/^\[\S+\]\s*/, ""));
}
