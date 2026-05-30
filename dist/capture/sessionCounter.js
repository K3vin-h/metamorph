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
exports.increment = increment;
exports.getCount = getCount;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const counterPath = (pluginRoot) => path.join(pluginRoot, "data", "session-counter.json");
function read(pluginRoot) {
    const p = counterPath(pluginRoot);
    try {
        return JSON.parse(fs.readFileSync(p, "utf8"));
    }
    catch {
        return { count: 0, seenIds: [] };
    }
}
function write(pluginRoot, counter) {
    const p = counterPath(pluginRoot);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(counter, null, 2), "utf8");
}
const MAX_SEEN_IDS = 2000;
// Idempotent: returns current count (increments only if sessionId not already seen)
function increment(pluginRoot, sessionId) {
    const counter = read(pluginRoot);
    if (!counter.seenIds.includes(sessionId)) {
        counter.seenIds.push(sessionId);
        counter.count++;
        // Cap seenIds to prevent unbounded growth — older IDs are safe to drop since they
        // are already in the profile cache and cannot be double-counted
        if (counter.seenIds.length > MAX_SEEN_IDS) {
            counter.seenIds = counter.seenIds.slice(-MAX_SEEN_IDS);
        }
        write(pluginRoot, counter);
    }
    return counter.count;
}
function getCount(pluginRoot) {
    return read(pluginRoot).count;
}
//# sourceMappingURL=sessionCounter.js.map