/** Normalize Claude Code transcript JSONL lines (legacy + nested message format). */
export interface NormalizedTranscriptLine {
    lineType: string;
    role: string;
    content: unknown;
    timestamp: string;
}
export declare function normalizeTranscriptLine(raw: unknown): NormalizedTranscriptLine | null;
export declare function contentBlocks(content: unknown): Array<Record<string, unknown>>;
//# sourceMappingURL=transcriptLine.d.ts.map