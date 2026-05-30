import type { Config, PermissionResult } from "./types.js";
declare function matchGlob(pattern: string, filePath: string): boolean;
export declare function checkWritePermission(resolvedPath: string, config: Config, claudeRoot: string): PermissionResult;
export declare function checkReadPermission(filePath: string, denyGlobs: string[], claudeRoot: string): boolean;
export { matchGlob };
//# sourceMappingURL=permissions.d.ts.map