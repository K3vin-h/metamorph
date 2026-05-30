import * as path from "path";
import * as os from "os";
import { ensurePersistentData, resolveDataRoot } from "./runtime.js";
import { logHookError } from "./hookErrors.js";

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT ?? path.dirname(__dirname);
const CLAUDE_ROOT = path.join(os.homedir(), ".claude");
const DATA_ROOT = resolveDataRoot(PLUGIN_ROOT);

ensurePersistentData(PLUGIN_ROOT, DATA_ROOT);

function logError(context: string, err: unknown): void {
  logHookError(DATA_ROOT, context, err);
}

async function runSessionStart(): Promise<void> {
  const { sessionStart } = await import("./hooks/sessionStart.js");
  await sessionStart(DATA_ROOT, CLAUDE_ROOT);
}

async function runSessionEnd(): Promise<void> {
  const { sessionEnd } = await import("./hooks/sessionEnd.js");
  await sessionEnd(DATA_ROOT, CLAUDE_ROOT);
}

async function runConfigSet(key: string, value: string): Promise<void> {
  const { setConfigValue } = await import("./config.js");
  setConfigValue(DATA_ROOT, key, value);
  console.log(`Set ${key} = ${value}`);
}

async function runConfigWrite(json: string): Promise<void> {
  const { writeConfig, mergeWithDefaults } = await import("./config.js");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`Invalid JSON for config-write: ${json.slice(0, 80)}`);
  }
  const validated = mergeWithDefaults(parsed);
  writeConfig(DATA_ROOT, validated);
  console.log("Config saved.");
}

async function runFeedbackAdd(text: string): Promise<void> {
  const { addFeedback } = await import("./feedback.js");
  addFeedback(DATA_ROOT, text);
  console.log("Feedback logged.");
}

async function runFeedbackList(): Promise<void> {
  const { listFeedback } = await import("./feedback.js");
  console.log(listFeedback(DATA_ROOT));
}

async function runFeedbackClear(): Promise<void> {
  const { clearFeedback } = await import("./feedback.js");
  clearFeedback(DATA_ROOT);
  console.log("Feedback log cleared.");
}

async function runPrepareImprove(targetId: string, runId?: string): Promise<void> {
  const { prepareImprove, formatPrepareBatchResult } = await import("./improve/improver.js");
  const result = await prepareImprove(DATA_ROOT, CLAUDE_ROOT, targetId, runId);
  console.log(formatPrepareBatchResult(result));
}

async function runPrepareImproveBatch(targetIds: string[]): Promise<void> {
  const { prepareImproveBatch, formatPrepareBatchResult } = await import("./improve/improver.js");
  const result = await prepareImproveBatch(DATA_ROOT, CLAUDE_ROOT, targetIds);
  console.log(formatPrepareBatchResult(result));
}

async function runImproveApprove(id: string): Promise<void> {
  const { approveImprovement } = await import("./improve/improver.js");
  await approveImprovement(DATA_ROOT, CLAUDE_ROOT, id);
}

async function runImproveReject(id: string): Promise<void> {
  const { rejectImprovement } = await import("./improve/improver.js");
  await rejectImprovement(DATA_ROOT, id);
}

async function runImproveList(): Promise<void> {
  const { listImprovements } = await import("./improve/improver.js");
  console.log(listImprovements(DATA_ROOT));
}

async function runRollbackList(): Promise<void> {
  const { rollbackList } = await import("./rollback/rollback.js");
  console.log(rollbackList(DATA_ROOT));
}

async function runRollbackFile(filePath: string): Promise<void> {
  const { rollbackFile } = await import("./rollback/rollback.js");
  const result = await rollbackFile(DATA_ROOT, filePath);
  console.log(result.ok ? `Restored: ${filePath}` : `Error: ${result.error}`);
}

async function runRollbackRun(runId: string): Promise<void> {
  const { rollbackRun } = await import("./rollback/rollback.js");
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
        await runPrepareImprove(args[0], args[1]);
        break;
      case "prepare-improve-batch":
        await runPrepareImproveBatch(args);
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
    process.exit(0);
  }
  process.exit(1);
});
