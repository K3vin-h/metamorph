import type { MistakePattern } from "../types.js";
export interface MistakeContextEntry {
    kind: string;
    tool: string;
    n: number;
    ex: Array<{
        m: string;
        c?: string;
    }>;
}
/** Ultra-compact mistake slice for improve-context files (LLM reads only this). */
export declare function mistakePatternsForContext(patterns: MistakePattern[] | undefined): MistakeContextEntry[] | undefined;
//# sourceMappingURL=mistakeCompact.d.ts.map