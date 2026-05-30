import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ensurePersistentData, resolveDataRoot } from "./runtime.js";

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT ?? path.dirname(__dirname);
const CLAUDE_ROOT = path.join(os.homedir(), ".claude");
const DATA_ROOT = resolveDataRoot(PLUGIN_ROOT);
const DATA_DIR = path.join(DATA_ROOT, "data");
const ERROR_LOG = path.join(DATA_DIR, "hook-errors.log");

ensurePersistentData(PLUGIN_ROOT, DATA_ROOT);

function logError(context: string, err: unknown): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const msg = `[${new Date().toISOString()}] ${context}: ${err instanceof Error ? err.message : String(err)}\n`;
    fs.appendFileSync(ERROR_LOG, msg, "utf8");
  } catch {
    // Cannot log — fail silently so hooks never block sessions
  }
}

async function runSessionStart(): Promise<void> {
  const { sessionStart } = await import("./hooks/sessionStart");
  await sessionStart(DATA_ROOT, CLAUDE_ROOT);
}

async function runSessionEnd(): Promise<void> {
  const { sessionEnd } = await import("./hooks/sessionEnd");
  await sessionEnd(DATA_ROOT, CLAUDE_ROOT);
}

async function runConfigSet(key: string, value: string): Promise<void> {
  const { setConfigValue } = await import("./config");
  setConfigValue(DATA_ROOT, key, value);
  console.log(`Set ${key} = ${value}`);
}

async function runConfigWrite(json: string): Promise<void> {
  const { writeConfig, mergeWithDefaults } = await import("./config");
  // Validate through mergeWithDefaults to enforce all bounds and types (H-3)
  const validated = mergeWithDefaults(JSON.parse(json));
  writeConfig(DATA_ROOT, validated);
  console.log("Config saved.");
}

async function runFeedbackAdd(text: string): Promise<void> {
  const { addFeedback } = await import("./feedback");
  addFeedback(DATA_ROOT, text);
  console.log("Feedback logged.");
}

async function runFeedbackList(): Promise<void> {
  const { listFeedback } = await import("./feedback");
  console.log(listFeedback(DATA_ROOT));
}

async function runFeedbackClear(): Promise<void> {
  const { clearFeedback } = await import("./feedback");
  clearFeedback(DATA_ROOT);
  console.log("Feedback log cleared.");
}

async function runPrepareImprove(targetId: string): Promise<void> {
  const { prepareImprove } = await import("./improve/improver");
  await prepareImprove(DATA_ROOT, CLAUDE_ROOT, targetId);
}

async function runImproveApprove(id: string): Promise<void> {
  const { approveImprovement } = await import("./improve/improver");
  await approveImprovement(DATA_ROOT, CLAUDE_ROOT, id);
}

async function runImproveReject(id: string): Promise<void> {
  const { rejectImprovement } = await import("./improve/improver");
  await rejectImprovement(DATA_ROOT, id);
}

async function runImproveList(): Promise<void> {
  const { listImprovements } = await import("./improve/improver");
  console.log(listImprovements(DATA_ROOT));
}

async function runRollbackList(): Promise<void> {
  const { rollbackList } = await import("./rollback/rollback");
  console.log(rollbackList(DATA_ROOT));
}

async function runRollbackFile(filePath: string): Promise<void> {
  const { rollbackFile } = await import("./rollback/rollback");
  const result = await rollbackFile(DATA_ROOT, filePath);
  console.log(result.ok ? `Restored: ${filePath}` : `Error: ${result.error}`);
}

async function runRollbackRun(runId: string): Promise<void> {
  const { rollbackRun } = await import("./rollback/rollback");
  console.log(await rollbackRun(DATA_ROOT, runId));
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  try {
    switch (command) {
      case "session-start":
        await runSessionStart();
        break;
      case "session-end":
        await runSessionEnd();
        break;
      case "config-set":
        await runConfigSet(args[0], args[1]);
        break;
      case "config-write":
        await runConfigWrite(args[0]);
        break;
      case "feedback-add":
        await runFeedbackAdd(args.join(" "));
        break;
      case "feedback-list":
        await runFeedbackList();
        break;
      case "feedback-clear":
        await runFeedbackClear();
        break;
      case "prepare-improve":
        await runPrepareImprove(args[0]);
        break;
      case "improve-approve":
        await runImproveApprove(args[0]);
        break;
      case "improve-reject":
        await runImproveReject(args[0]);
        break;
      case "improve-list":
        await runImproveList();
        break;
      case "rollback-list":
        await runRollbackList();
        break;
      case "rollback-file":
        await runRollbackFile(args[0]);
        break;
      case "rollback-run":
        await runRollbackRun(args[0]);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (err) {
    logError(command ?? "unknown", err);
    // Hook commands must never crash the session
    if (command === "session-start" || command === "session-end") {
      process.exit(0);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  logError("main", err);
  const [, , cmd] = process.argv;
  if (cmd === "session-start" || cmd === "session-end") {
    process.exit(0); // Hooks must never block the session
  }
  process.exit(1);
});
