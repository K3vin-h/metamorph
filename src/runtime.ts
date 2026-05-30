import * as fs from "fs";
import * as path from "path";

function copyPathIfMissing(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyPathIfMissing(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }

  if (fs.existsSync(dest)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function isMetamorphPluginDir(dir: string): boolean {
  try {
    const manifestPath = path.join(dir, ".claude-plugin", "plugin.json");
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (manifest.name === "metamorph") return true;
    }
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.name === "metamorph") return true;
    }
    return (
      fs.existsSync(path.join(dir, "dist", "index.js")) &&
      fs.existsSync(path.join(dir, "hooks", "hooks.json"))
    );
  } catch {
    return false;
  }
}

function runtimeCandidates(pluginRoot: string): string[] {
  const candidates: string[] = [];
  const parent = path.dirname(pluginRoot);

  try {
    const siblings = fs
      .readdirSync(parent, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(parent, entry.name))
      .filter((dir) => dir !== pluginRoot)
      .filter(isMetamorphPluginDir)
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    candidates.push(...siblings);
  } catch {
    // Ignore; local plugin development may not have versioned cache siblings.
  }

  candidates.push(pluginRoot);
  return candidates;
}

export function resolveDataRoot(pluginRoot: string): string {
  return process.env.CLAUDE_PLUGIN_DATA ?? pluginRoot;
}

export function ensurePersistentData(pluginRoot: string, dataRoot: string): void {
  fs.mkdirSync(dataRoot, { recursive: true });
  if (path.resolve(pluginRoot) === path.resolve(dataRoot)) return;

  for (const candidate of runtimeCandidates(pluginRoot)) {
    copyPathIfMissing(path.join(candidate, "config.jsonc"), path.join(dataRoot, "config.jsonc"));
    copyPathIfMissing(path.join(candidate, "data"), path.join(dataRoot, "data"));
    copyPathIfMissing(path.join(candidate, "suggestions"), path.join(dataRoot, "suggestions"));
    copyPathIfMissing(path.join(candidate, "backups"), path.join(dataRoot, "backups"));
    copyPathIfMissing(path.join(candidate, "report.md"), path.join(dataRoot, "report.md"));
  }
}
