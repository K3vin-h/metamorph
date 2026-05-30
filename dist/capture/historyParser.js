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
exports.parseHistory = parseHistory;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const permissions_js_1 = require("../permissions.js");
function parseHistory(claudeRoot, denyGlobs) {
    const summary = {
        skillLoads: {},
        skillApplied: {},
        fileExtensions: {},
    };
    // Parse history.jsonl
    const historyPath = path.join(claudeRoot, "history.jsonl");
    if (fs.existsSync(historyPath)) {
        const lines = fs.readFileSync(historyPath, "utf8").split("\n");
        for (const line of lines) {
            if (!line.trim())
                continue;
            try {
                const entry = JSON.parse(line);
                if (entry.skillId) {
                    summary.skillLoads[entry.skillId] = (summary.skillLoads[entry.skillId] ?? 0) + 1;
                    if (entry.type === "apply") {
                        summary.skillApplied[entry.skillId] = (summary.skillApplied[entry.skillId] ?? 0) + 1;
                    }
                }
            }
            catch {
                // skip malformed lines
            }
        }
    }
    // Parse file-history/ for language distribution
    const fileHistoryDir = path.join(claudeRoot, "file-history");
    if (fs.existsSync(fileHistoryDir)) {
        const entries = fs.readdirSync(fileHistoryDir);
        for (const entry of entries) {
            const fullPath = path.join(fileHistoryDir, entry);
            if (!(0, permissions_js_1.checkReadPermission)(fullPath, denyGlobs, claudeRoot))
                continue;
            const ext = path.extname(entry).toLowerCase();
            if (ext) {
                summary.fileExtensions[ext] = (summary.fileExtensions[ext] ?? 0) + 1;
            }
        }
    }
    return summary;
}
//# sourceMappingURL=historyParser.js.map