import type { BackupManifest, CommandResult, Config } from "../types.js";
export declare function readManifest(pluginRoot: string): BackupManifest;
export declare function writeWithBackup(targetPath: string, proposedContent: string, runId: string, config: Config, pluginRoot: string): Promise<CommandResult>;
//# sourceMappingURL=writer.d.ts.map