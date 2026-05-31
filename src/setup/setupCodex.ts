import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { symlinkPlugin } from "./symlinkPlugin.js";

interface CodexMarketplace {
  name: string;
  interface?: { displayName?: string };
  plugins: Array<Record<string, unknown>>;
}

function upsertCodexMarketplace(marketplaceDir: string): void {
  const marketplacePath = path.join(marketplaceDir, "marketplace.json");

  let marketplace: CodexMarketplace = {
    name: "personal",
    interface: { displayName: "Personal Plugins" },
    plugins: [],
  };

  if (fs.existsSync(marketplacePath)) {
    try {
      marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8")) as CodexMarketplace;
      if (!Array.isArray(marketplace.plugins)) marketplace.plugins = [];
    } catch {
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
  } else {
    marketplace.plugins.push(entry);
  }

  fs.writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`, "utf8");
}

export function runSetupCodex(pluginRoot: string): void {
  const marketplaceDir = path.join(os.homedir(), ".agents", "plugins");
  const pluginDir = path.join(marketplaceDir, "metamorph");
  fs.mkdirSync(marketplaceDir, { recursive: true });
  symlinkPlugin(pluginRoot, pluginDir);
  upsertCodexMarketplace(marketplaceDir);

  console.log(`metamorph installed for Codex:`);
  console.log(`  Plugin: ~/.agents/plugins/metamorph/`);
  console.log(`  Marketplace: ~/.agents/plugins/marketplace.json`);
  console.log(`  Restart Codex, then enable metamorph from the plugin directory.`);
  console.log(`  Skill: /metamorph — hooks run on SessionStart/SessionEnd automatically.`);
}
