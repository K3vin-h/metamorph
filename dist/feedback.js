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
exports.addFeedback = addFeedback;
exports.listFeedback = listFeedback;
exports.clearFeedback = clearFeedback;
exports.readFeedbackEntries = readFeedbackEntries;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const FEEDBACK_LOG = (pluginRoot) => path.join(pluginRoot, "data", "feedback.log");
const MAX_ENTRIES = 200;
const MAX_FEEDBACK_LENGTH = 2000;
function addFeedback(pluginRoot, text) {
    const logPath = FEEDBACK_LOG(pluginRoot);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const trimmed = text.trim().slice(0, MAX_FEEDBACK_LENGTH);
    const entry = `[${new Date().toISOString()}] ${trimmed}\n`;
    fs.appendFileSync(logPath, entry, "utf8");
}
function listFeedback(pluginRoot) {
    const logPath = FEEDBACK_LOG(pluginRoot);
    if (!fs.existsSync(logPath))
        return "No feedback logged yet.";
    return fs.readFileSync(logPath, "utf8").trim();
}
function clearFeedback(pluginRoot) {
    const logPath = FEEDBACK_LOG(pluginRoot);
    if (fs.existsSync(logPath))
        fs.writeFileSync(logPath, "", "utf8");
}
function readFeedbackEntries(pluginRoot) {
    const logPath = FEEDBACK_LOG(pluginRoot);
    if (!fs.existsSync(logPath))
        return [];
    return fs
        .readFileSync(logPath, "utf8")
        .split("\n")
        .filter((l) => l.trim())
        .slice(-MAX_ENTRIES)
        .map((l) => l.replace(/^\[\S+\]\s*/, ""));
}
//# sourceMappingURL=feedback.js.map