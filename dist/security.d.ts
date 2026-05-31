export declare function scrubSecrets(text: string): string;
export declare function confinePath(rawPath: string, allowedRoots: string[]): string | null;
export declare function wrapUntrusted(data: string): string;
export declare function stripDirectives(text: string): string;
/** Scrub + strip user/transcript snippets before LLM context (no wrapper). */
export declare function sanitizeUserSnippet(text: string, maxLen?: number): string;
/** Same as sanitizeUserSnippet, wrapped for improve-context fields. */
export declare function wrapUserSnippet(text: string, maxLen?: number): string;
export declare function sha256(content: string): string;
//# sourceMappingURL=security.d.ts.map