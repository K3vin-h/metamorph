import type { Config, PermissionResult } from "./types.js";
declare function matchGlob(pattern: string, filePath: string): boolean;
export declare function resolveProjectRoot(): string | null;
export declare function localClaudeMdPath(projectRoot: string): string;
export declare function checkWritePermission(resolvedPath: string, config: Config, claudeRoot: string, projectRoot?: string | null): PermissionResult;
export declare function checkReadPermission(filePath: string, denyGlobs: string[], claudeRoot: string): boolean;
export { matchGlob };
//# sourceMappingURL=permissions.d.ts.map