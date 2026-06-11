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
exports.runSetupCodex = runSetupCodex;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const symlinkPlugin_js_1 = require("./symlinkPlugin.js");
function upsertCodexMarketplace(marketplaceDir) {
    const marketplacePath = path.join(marketplaceDir, "marketplace.json");
    let marketplace = {
        name: "personal",
        interface: { displayName: "Personal Plugins" },
        plugins: [],
    };
    if (fs.existsSync(marketplacePath)) {
        try {
            marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));
            if (!Array.isArray(marketplace.plugins))
                marketplace.plugins = [];
        }
        catch {
            // Overwrite corrupt marketplace below.
        }
    }
    const entry = {
        name: "metamorph",
        source: {
            source: "local",
            path: "./metamorph",
        },
        policy: {
            installation: "AVAILABLE",
            authentication: "ON_INSTALL",
        },
        category: "Productivity",
    };
    const existing = marketplace.plugins.findIndex((p) => p.name === "metamorph");
    if (existing >= 0) {
        marketplace.plugins[existing] = entry;
    }
    else {
        marketplace.plugins.push(entry);
    }
    const tmp = marketplacePath + ".tmp";
    fs.writeFileSync(tmp, `${JSON.stringify(marketplace, null, 2)}\n`, "utf8");
    fs.renameSync(tmp, marketplacePath);
}
function runSetupCodex(pluginRoot) {
    const marketplaceDir = path.join(os.homedir(), ".agents", "plugins");
    const pluginDir = path.join(marketplaceDir, "metamorph");
    fs.mkdirSync(marketplaceDir, { recursive: true });
    (0, symlinkPlugin_js_1.symlinkPlugin)(pluginRoot, pluginDir);
    upsertCodexMarketplace(marketplaceDir);
    console.log(`metamorph installed for Codex:`);
    console.log(`  Plugin: ~/.agents/plugins/metamorph/`);
    console.log(`  Marketplace: ~/.agents/plugins/marketplace.json`);
    console.log(`  Restart Codex, then enable metamorph from the plugin directory.`);
    console.log(`  Skill: /metamorph — hooks run on SessionStart/SessionEnd automatically.`);
}
//# sourceMappingURL=setupCodex.js.map