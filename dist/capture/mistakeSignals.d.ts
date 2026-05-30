export interface ClassifiedUserFix {
    confidence: "high" | "low";
    mistakeSummary: string;
    correctionSummary?: string;
}
export declare function isRejectedToolResult(summary: string): boolean;
/** User sent a plain-text message to fix something after a completed tool run. */
export declare function classifyUserFixMessage(text: string, mode: "full" | "redacted" | "off"): ClassifiedUserFix | null;
export declare function extractUserText(content: unknown): string | null;
export interface ToolResultInfo {
    toolUseId: string;
    isError: boolean;
    summary: string;
}
export declare function extractToolResults(content: unknown): ToolResultInfo[];
//# sourceMappingURL=mistakeSignals.d.ts.map