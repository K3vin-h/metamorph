import * as path from "path";
import * as os from "os";
import { symlinkPlugin } from "./symlinkPlugin.js";

export function runSetupCursor(pluginRoot: string): void {
  const localPluginDir = path.join(os.homedir(), ".cursor", "plugins", "local", "metamorph");
  symlinkPlugin(pluginRoot, localPluginDir);

  console.log(`metamorph installed for Cursor:`);
  console.log(`  Plugin: ~/.cursor/plugins/local/metamorph/`);
  console.log(`  Restart Cursor (or Developer: Reload Window) to load the plugin.`);
  console.log(`  Commands: /metamorph, /metamorph-setup, /metamorph-report, etc.`);
  console.log(`  Hooks: sessionStart/sessionEnd run automatically.`);
}
