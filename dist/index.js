"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT ?? path.dirname(__dirname);
const CLAUDE_ROOT = path.join(os.homedir(), ".claude");
const DATA_DIR = path.join(PLUGIN_ROOT, "data");
const ERROR_LOG = path.join(DATA_DIR, "hook-errors.log");
function logError(context, err) {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        const msg = `[${new Date().toISOString()}] ${context}: ${err instanceof Error ? err.message : String(err)}\n`;
        fs.appendFileSync(ERROR_LOG, msg, "utf8");
    }
    catch {
        // Cannot log — fail silently so hooks never block sessions
    }
}
async function runSessionStart() {
    const { sessionStart } = await Promise.resolve().then(() => __importStar(require("./hooks/sessionStart")));
    await sessionStart(PLUGIN_ROOT, CLAUDE_ROOT);
}
async function runSessionEnd() {
    const { sessionEnd } = await Promise.resolve().then(() => __importStar(require("./hooks/sessionEnd")));
    await sessionEnd(PLUGIN_ROOT, CLAUDE_ROOT);
}
async function runConfigSet(key, value) {
    const { setConfigValue } = await Promise.resolve().then(() => __importStar(require("./config")));
    setConfigValue(PLUGIN_ROOT, key, value);
    console.log(`Set ${key} = ${value}`);
}
async function runConfigWrite(json) {
    const { writeConfig, mergeWithDefaults } = await Promise.resolve().then(() => __importStar(require("./config")));
    // Validate through mergeWithDefaults to enforce all bounds and types (H-3)
    const validated = mergeWithDefaults(JSON.parse(json));
    writeConfig(PLUGIN_ROOT, validated);
    console.log("Config saved.");
}
async function runFeedbackAdd(text) {
    const { addFeedback } = await Promise.resolve().then(() => __importStar(require("./feedback")));
    addFeedback(PLUGIN_ROOT, text);
    console.log("Feedback logged.");
}
async function runFeedbackList() {
    const { listFeedback } = await Promise.resolve().then(() => __importStar(require("./feedback")));
    console.log(listFeedback(PLUGIN_ROOT));
}
async function runFeedbackClear() {
    const { clearFeedback } = await Promise.resolve().then(() => __importStar(require("./feedback")));
    clearFeedback(PLUGIN_ROOT);
    console.log("Feedback log cleared.");
}
async function runPrepareImprove(targetId) {
    const { prepareImprove } = await Promise.resolve().then(() => __importStar(require("./improve/improver")));
    await prepareImprove(PLUGIN_ROOT, CLAUDE_ROOT, targetId);
}
async function runImproveApprove(id) {
    const { approveImprovement } = await Promise.resolve().then(() => __importStar(require("./improve/improver")));
    await approveImprovement(PLUGIN_ROOT, CLAUDE_ROOT, id);
}
async function runImproveReject(id) {
    const { rejectImprovement } = await Promise.resolve().then(() => __importStar(require("./improve/improver")));
    await rejectImprovement(PLUGIN_ROOT, id);
}
async function runImproveList() {
    const { listImprovements } = await Promise.resolve().then(() => __importStar(require("./improve/improver")));
    console.log(listImprovements(PLUGIN_ROOT));
}
async function runRollbackList() {
    const { rollbackList } = await Promise.resolve().then(() => __importStar(require("./rollback/rollback")));
    console.log(rollbackList(PLUGIN_ROOT));
}
async function runRollbackFile(filePath) {
    const { rollbackFile } = await Promise.resolve().then(() => __importStar(require("./rollback/rollback")));
    const result = await rollbackFile(PLUGIN_ROOT, filePath);
    console.log(result.ok ? `Restored: ${filePath}` : `Error: ${result.error}`);
}
async function runRollbackRun(runId) {
    const { rollbackRun } = await Promise.resolve().then(() => __importStar(require("./rollback/rollback")));
    console.log(await rollbackRun(PLUGIN_ROOT, runId));
}
async function main() {
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
    }
    catch (err) {
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
//# sourceMappingURL=index.js.map