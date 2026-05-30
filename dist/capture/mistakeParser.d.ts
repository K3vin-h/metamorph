import type { MistakeEvent, PrivacyMode } from "../types.js";
/** Main session + subagent transcripts (all tools in each). */
export declare function collectSessionMistakeEvents(transcriptPath: string, sessionId: string, mode: PrivacyMode, denyGlobs: string[], claudeRoot: string): Promise<MistakeEvent[]>;
export declare function parseMistakesFromTranscript(transcriptPath: string, sessionId: string, mode: PrivacyMode, denyGlobs: string[], claudeRoot: string, trackingEnabled: boolean): Promise<MistakeEvent[]>;
//# sourceMappingURL=mistakeParser.d.ts.map