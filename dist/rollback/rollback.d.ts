import type { CommandResult } from "../types.js";
export declare function rollbackList(pluginRoot: string): string;
export declare function rollbackFile(pluginRoot: string, filePath: string): Promise<CommandResult>;
export declare function rollbackRun(pluginRoot: string, runId: string): Promise<string>;
//# sourceMappingURL=rollback.d.ts.map