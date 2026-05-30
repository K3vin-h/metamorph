export interface HistorySummary {
    skillLoads: Record<string, number>;
    skillApplied: Record<string, number>;
    fileExtensions: Record<string, number>;
}
export declare function parseHistory(claudeRoot: string, denyGlobs: string[]): Promise<HistorySummary>;
//# sourceMappingURL=historyParser.d.ts.map