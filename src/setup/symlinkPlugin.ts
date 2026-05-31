import * as fs from "fs";
import * as path from "path";

export function symlinkPlugin(pluginRoot: string, targetDir: string): void {
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });

  if (fs.existsSync(targetDir)) {
    const stat = fs.lstatSync(targetDir);
    if (stat.isSymbolicLink() || stat.isDirectory()) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  }

  const linkType = process.platform === "win32" ? "junction" : "dir";
  fs.symlinkSync(path.resolve(pluginRoot), targetDir, linkType);
}
