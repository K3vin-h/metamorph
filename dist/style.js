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
exports.deriveStyleProfile = deriveStyleProfile;
exports.loadStyleProfile = loadStyleProfile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_js_1 = require("./config.js");
const hookErrors_js_1 = require("./hookErrors.js");
const styleProfilePath = (pluginRoot) => path.join(pluginRoot, "data", "style-profile.json");
function detectBulletStyle(content) {
    const dashCount = (content.match(/^- /gm) ?? []).length;
    const starCount = (content.match(/^\* /gm) ?? []).length;
    const plusCount = (content.match(/^\+ /gm) ?? []).length;
    if (starCount > dashCount && starCount > plusCount)
        return "*";
    if (plusCount > dashCount && plusCount > starCount)
        return "+";
    return "-";
}
function detectHeadingStyle(content) {
    const setextUnderlines = (content.match(/^[=\-]{2,}\s*$/gm) ?? []).length;
    return setextUnderlines > 2 ? "setext" : "atx";
}
function extractFrontmatterKeys(content) {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match)
        return [];
    return match[1]
        .split("\n")
        .map((l) => l.split(":")[0].trim())
        .filter(Boolean);
}
function extractToneKeywords(content) {
    const modals = ["should", "must", "always", "never", "prefer", "avoid", "use", "ensure"];
    const found = new Set();
    const lower = content.toLowerCase();
    for (const w of modals) {
        if (lower.includes(w))
            found.add(w);
    }
    return [...found];
}
function avgSectionWordCount(content) {
    const sections = content.split(/^#{1,6} /m).slice(1);
    if (sections.length === 0)
        return 0;
    const total = sections.reduce((sum, s) => sum + s.split(/\s+/).length, 0);
    return Math.round(total / sections.length);
}
function mergeFrontmatterKeyOrders(orders) {
    const freq = {};
    for (const order of orders) {
        for (let i = 0; i < order.length; i++) {
            if (!freq[order[i]])
                freq[order[i]] = {};
            freq[order[i]][i] = (freq[order[i]][i] ?? 0) + 1;
        }
    }
    const keys = Object.keys(freq);
    keys.sort((a, b) => {
        const bestPos = (key) => Object.entries(freq[key]).reduce((best, [pos, cnt]) => (cnt > (freq[key][Number(best)] ?? 0) ? pos : best), "0");
        return Number(bestPos(a)) - Number(bestPos(b));
    });
    return keys;
}
async function deriveStyleProfile(pluginRoot, claudeRoot, _analysis) {
    const config = (0, config_js_1.loadConfig)(pluginRoot);
    const filesToScan = [];
    const agentsDir = path.join(claudeRoot, "agents");
    if (config.write.targets.agents && fs.existsSync(agentsDir)) {
        for (const f of fs.readdirSync(agentsDir)) {
            if (f.endsWith(".md"))
                filesToScan.push(path.join(agentsDir, f));
        }
    }
    const skillsDir = path.join(claudeRoot, "skills");
    if (config.write.targets.skills && fs.existsSync(skillsDir)) {
        for (const skillDir of fs.readdirSync(skillsDir, { withFileTypes: true })) {
            if (!skillDir.isDirectory())
                continue;
            const skillMd = path.join(skillsDir, skillDir.name, "SKILL.md");
            if (fs.existsSync(skillMd))
                filesToScan.push(skillMd);
        }
    }
    const bulletCounts = { "-": 0, "*": 0, "+": 0 };
    const headingCounts = { atx: 0, setext: 0 };
    const frontmatterOrders = [];
    let hasNumberedLists = false;
    const toneKeywords = new Set();
    const wordCounts = [];
    let filesRead = 0;
    for (const filePath of filesToScan) {
        try {
            const content = fs.readFileSync(filePath, "utf8");
            filesRead++;
            bulletCounts[detectBulletStyle(content)]++;
            headingCounts[detectHeadingStyle(content)]++;
            frontmatterOrders.push(extractFrontmatterKeys(content));
            if (/^\d+\. /m.test(content))
                hasNumberedLists = true;
            for (const kw of extractToneKeywords(content))
                toneKeywords.add(kw);
            wordCounts.push(avgSectionWordCount(content));
        }
        catch (err) {
            (0, hookErrors_js_1.logHookError)(pluginRoot, `style-scan:${filePath}`, err);
        }
    }
    const profile = {
        frontmatterKeyOrder: mergeFrontmatterKeyOrders(frontmatterOrders),
        headingStyle: headingCounts.setext > headingCounts.atx ? "setext" : "atx",
        bulletStyle: (Object.entries(bulletCounts).sort((a, b) => b[1] - a[1])[0][0]),
        numberedLists: hasNumberedLists,
        toneKeywords: [...toneKeywords],
        avgSectionLength: wordCounts.length > 0 ? Math.round(wordCounts.reduce((s, n) => s + n, 0) / wordCounts.length) : 0,
        derivedFromFiles: filesRead,
    };
    const p = styleProfilePath(pluginRoot);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = p + ".tmp";
    try {
        fs.writeFileSync(tmp, JSON.stringify(profile, null, 2), "utf8");
        fs.renameSync(tmp, p);
    }
    catch (err) {
        (0, hookErrors_js_1.logHookError)(pluginRoot, "write-style-profile", err);
        throw err;
    }
    return profile;
}
function loadStyleProfile(pluginRoot) {
    const p = styleProfilePath(pluginRoot);
    try {
        return JSON.parse(fs.readFileSync(p, "utf8"));
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=style.js.map