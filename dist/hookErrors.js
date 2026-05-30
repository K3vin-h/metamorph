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
exports.logHookError = logHookError;
exports.isNodeError = isNodeError;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function logHookError(pluginRoot, context, err) {
    const msg = `[${new Date().toISOString()}] ${context}: ${err instanceof Error ? err.message : String(err)}\n`;
    try {
        const logPath = path.join(pluginRoot, "data", "hook-errors.log");
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        fs.appendFileSync(logPath, msg, "utf8");
    }
    catch {
        try {
            process.stderr.write(`[metamorph] ${msg}`);
        }
        catch {
            // Last resort — hooks must never throw
        }
    }
}
function isNodeError(err, code) {
    return typeof err === "object" && err !== null && "code" in err && err.code === code;
}
//# sourceMappingURL=hookErrors.js.map