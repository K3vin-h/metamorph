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
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const runtime_js_1 = require("./runtime.js");
const hookErrors_js_1 = require("./hookErrors.js");
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT ??
    process.env.PLUGIN_ROOT ??
    process.env.CURSOR_PLUGIN_ROOT ??
    path.dirname(__dirname);
const CLAUDE_ROOT = path.join(os.homedir(), ".claude");
const DATA_ROOT = (0, runtime_js_1.resolveDataRoot)(PLUGIN_ROOT);
(0, runtime_js_1.ensurePersistentData)(PLUGIN_ROOT, DATA_ROOT);
function logError(context, err) {
    (0, hookErrors_js_1.logHookError)(DATA_ROOT, context, err);
}
async function runSessionStart() {
    const { sessionStart } = await Promise.resolve().then(() => __importStar(require("./hooks/sessionStart.js")));
    await sessionStart(DATA_ROOT, CLAUDE_ROOT);
}
async function runSessionEnd() {
    const { sessionEnd } = await Promise.resolve().then(() => __importStar(require("./hooks/sessionEnd.js")));
    await sessionEnd(DATA_ROOT, CLAUDE_ROOT);
}
async function runConfigSet(key, value) {
    const { setConfigValue } = await Promise.resolve().then(() => __importStar(require("./config.js")));
    setConfigValue(DATA_ROOT, key, value);
    console.log(`Set ${key} = ${value}`);
}
async function runConfigWrite(json) {
    if (json.length > 64 * 1024) {
        throw new Error("config-write payload too large (max 64KB)");
    }
    const { writeConfig, mergeWithDefaults } = await Promise.resolve().then(() => __importStar(require("./config.js")));
    let parsed;
    try {
        parsed = JSON.parse(json);
    }
    catch {
        throw new Error(`Invalid JSON for config-write: ${json.slice(0, 80)}`);
    }
    const validated = mergeWithDefaults(parsed);
    writeConfig(DATA_ROOT, validated);
    console.log("Config saved.");
}
async function runFeedbackAdd(text) {
    const { addFeedback } = await Promise.resolve().then(() => __importStar(require("./feedback.js")));
    addFeedback(DATA_ROOT, text);
    console.log("Feedback logged.");
}
async function runFeedbackList() {
    const { listFeedback } = await Promise.resolve().then(() => __importStar(require("./feedback.js")));
    console.log(listFeedback(DATA_ROOT));
}
async function runFeedbackClear() {
    const { clearFeedback } = await Promise.resolve().then(() => __importStar(require("./feedback.js")));
    clearFeedback(DATA_ROOT);
    console.log("Feedback log cleared.");
}
async function runPrepareImprove(targetId, runId) {
    const { prepareImprove, formatPrepareBatchResult } = await Promise.resolve().then(() => __importStar(require("./improve/improver.js")));
    const result = await prepareImprove(DATA_ROOT, CLAUDE_ROOT, targetId, runId);
    console.log(formatPrepareBatchResult(result));
}
async function runPrepareImproveBatch(targetIds, force = false) {
    const { prepareImproveBatch, formatPrepareBatchResult } = await Promise.resolve().then(() => __importStar(require("./improve/improver.js")));
    const result = await prepareImproveBatch(DATA_ROOT, CLAUDE_ROOT, targetIds, undefined, force);
    console.log(formatPrepareBatchResult(result));
}
async function runImproveApprove(id) {
    const { approveImprovement } = await Promise.resolve().then(() => __importStar(require("./improve/improver.js")));
    await approveImprovement(DATA_ROOT, CLAUDE_ROOT, id);
}
async function runImproveReject(id) {
    const { rejectImprovement } = await Promise.resolve().then(() => __importStar(require("./improve/improver.js")));
    await rejectImprovement(DATA_ROOT, id);
}
async function runImproveList() {
    const { listImprovements } = await Promise.resolve().then(() => __importStar(require("./improve/improver.js")));
    console.log(listImprovements(DATA_ROOT));
}
async function runImproveStats() {
    const fs = await Promise.resolve().then(() => __importStar(require("fs")));
    const path = await Promise.resolve().then(() => __importStar(require("path")));
    const analysisPath = path.join(DATA_ROOT, "data", "analysis.json");
    if (!fs.existsSync(analysisPath)) {
        console.log("No session data yet. Run a session to begin.");
        return;
    }
    const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
    const { printImproveStats } = await Promise.resolve().then(() => __importStar(require("./improve/improveCli.js")));
    printImproveStats(DATA_ROOT, analysis);
}
async function runImproveTargets() {
    const fs = await Promise.resolve().then(() => __importStar(require("fs")));
    const path = await Promise.resolve().then(() => __importStar(require("path")));
    const analysisPath = path.join(DATA_ROOT, "data", "analysis.json");
    if (!fs.existsSync(analysisPath)) {
        console.log("No session data yet. Run a session to begin.");
        return;
    }
    const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
    const { printImproveTargets } = await Promise.resolve().then(() => __importStar(require("./improve/improveCli.js")));
    printImproveTargets(DATA_ROOT, analysis);
}
async function runImproveTargetsActionable() {
    const fs = await Promise.resolve().then(() => __importStar(require("fs")));
    const path = await Promise.resolve().then(() => __importStar(require("path")));
    const analysisPath = path.join(DATA_ROOT, "data", "analysis.json");
    if (!fs.existsSync(analysisPath)) {
        console.log("No session data yet. Run a session to begin.");
        return;
    }
    const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
    const { printImproveTargetsActionable } = await Promise.resolve().then(() => __importStar(require("./improve/improveCli.js")));
    printImproveTargetsActionable(DATA_ROOT, analysis);
}
async function runReportRefresh() {
    const { refreshReportFromDisk } = await Promise.resolve().then(() => __importStar(require("./report/reportMd.js")));
    if (refreshReportFromDisk(DATA_ROOT)) {
        console.log(`Report updated: ${path.join(DATA_ROOT, "report.md")}`);
        return;
    }
    console.log("No analysis.json found. Run a session first.");
}
async function runImproveStatus() {
    const fs = await Promise.resolve().then(() => __importStar(require("fs")));
    const path = await Promise.resolve().then(() => __importStar(require("path")));
    const analysisPath = path.join(DATA_ROOT, "data", "analysis.json");
    if (!fs.existsSync(analysisPath)) {
        console.log("No session data yet. Run a session to begin.");
        return;
    }
    const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
    const { printImproveStatus } = await Promise.resolve().then(() => __importStar(require("./improve/improveCli.js")));
    printImproveStatus(DATA_ROOT, analysis);
}
async function runRollbackList() {
    const { rollbackList } = await Promise.resolve().then(() => __importStar(require("./rollback/rollback.js")));
    console.log(rollbackList(DATA_ROOT));
}
async function runRollbackFile(filePath) {
    const { rollbackFile } = await Promise.resolve().then(() => __importStar(require("./rollback/rollback.js")));
    const result = await rollbackFile(DATA_ROOT, filePath);
    console.log(result.ok ? `Restored: ${filePath}` : `Error: ${result.error}`);
}
async function runRollbackRun(runId) {
    const { rollbackRun } = await Promise.resolve().then(() => __importStar(require("./rollback/rollback.js")));
    console.log(await rollbackRun(DATA_ROOT, runId));
}
async function runSetupCursor() {
    const { runSetupCursor } = await Promise.resolve().then(() => __importStar(require("./setup/setupCursor.js")));
    runSetupCursor(PLUGIN_ROOT);
}
async function runSetupCodex() {
    const { runSetupCodex } = await Promise.resolve().then(() => __importStar(require("./setup/setupCodex.js")));
    runSetupCodex(PLUGIN_ROOT);
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
                await runPrepareImprove(args[0], args[1]);
                break;
            case "prepare-improve-batch": {
                const force = args[0] === "--force" || process.env.METAMORPH_FORCE === "1";
                const ids = args[0] === "--force" ? args.slice(1) : args;
                await runPrepareImproveBatch(ids, force);
                break;
            }
            case "improve-approve":
                await runImproveApprove(args[0]);
                break;
            case "improve-reject":
                await runImproveReject(args[0]);
                break;
            case "improve-list":
                await runImproveList();
                break;
            case "improve-stats":
                await runImproveStats();
                break;
            case "improve-targets":
                await runImproveTargets();
                break;
            case "improve-targets-actionable":
                await runImproveTargetsActionable();
                break;
            case "improve-status":
                await runImproveStatus();
                break;
            case "report-refresh":
                await runReportRefresh();
                break;
            case "rollback-list":
                await runRollbackList();
                break;
            case "rollback-file":
                if (!args[0])
                    throw new Error("rollback-file requires a file path argument");
                await runRollbackFile(args[0]);
                break;
            case "rollback-run":
                if (!args[0])
                    throw new Error("rollback-run requires a run ID argument");
                await runRollbackRun(args[0]);
                break;
            case "setup-cursor":
                await runSetupCursor();
                break;
            case "setup-codex":
                await runSetupCodex();
                break;
            default:
                console.error(`Unknown command: ${command}`);
                process.exit(1);
        }
    }
    catch (err) {
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
//# sourceMappingURL=index.js.map