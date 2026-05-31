export interface PreparedTarget {
    id: string;
    contextPath: string;
    suggestionPath: string;
    runId: string;
}
export interface SkippedTarget {
    id: string;
    reason: string;
}
export interface PrepareBatchResult {
    runId: string;
    prepared: PreparedTarget[];
    skipped: SkippedTarget[];
}
export declare function prepareImprove(pluginRoot: string, claudeRoot: string, targetId: string, runId?: string): Promise<PrepareBatchResult>;
export declare function prepareImproveBatch(pluginRoot: string, claudeRoot: string, targetIds: string[], existingRunId?: string, force?: boolean): Promise<PrepareBatchResult>;
export declare function formatPrepareBatchResult(result: PrepareBatchResult): string;
export declare function approveImprovement(pluginRoot: string, claudeRoot: string, id: string): Promise<void>;
export declare function rejectImprovement(pluginRoot: string, id: string): Promise<void>;
export declare function listImprovements(pluginRoot: string): string;
//# sourceMappingURL=improver.d.ts.map