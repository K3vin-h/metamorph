import type { MistakeEvent } from "./types.js";
export declare function recordSuggestionRejected(pluginRoot: string, targetKind: "agent" | "skill", targetId: string, mistakeSummary: string): void;
export declare function readPersistedMistakeEvents(pluginRoot: string): MistakeEvent[];
//# sourceMappingURL=mistakeFeedback.d.ts.map