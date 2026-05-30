export type PrivacyMode = "full" | "redacted" | "off";
export interface Config {
    mode: "suggest";
    warmupSessions: number;
    maxSuggestionsPerRun: number;
    flagThreshold: number;
    read: {
        scope: "global" | "project" | "both";
        transcripts: PrivacyMode;
        mistakeTracking: boolean;
        denyGlobs: string[];
    };
    write: {
        targets: {
            agents: boolean;
            skills: boolean;
            claudeMd: "global" | "local" | "both" | false;
        };
        allow: string[];
        deny: string[];
    };
    style: {
        deriveGuide: boolean;
        preserveSkeleton: boolean;
    };
    trackers: string[];
}
export interface PermissionResult {
    allowed: boolean;
    reason: "category-disabled" | "deny-glob" | "allow-glob-missing" | "path-traversal" | "symlink-escape" | "outside-root" | "ok";
}
export interface RawTranscriptLine {
    type: string;
    role?: string;
    content?: RawContentBlock[];
    sessionId?: string;
    timestamp?: string;
}
export interface RawContentBlock {
    type: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
}
export interface TranscriptEvent {
    sessionId: string;
    toolName: string;
    timestamp: string;
    toolInput?: Record<string, unknown>;
    fileExtensions?: string[];
    pathStems?: string[];
    commandCategory?: string;
    agentId?: string;
    skillId?: string;
}
export interface SessionProfile {
    sessionId: string;
    capturedAt: string;
    readMode: PrivacyMode;
    toolCalls: TranscriptEvent[];
    agentInvocations: Record<string, number>;
    agentCallMappings: Record<string, string>;
    skillLoads: Record<string, number>;
    skillApplied: Record<string, number>;
    fileExtensions: Record<string, number>;
    skippedLines: number;
    mistakeEvents?: MistakeEvent[];
}
export type MistakeKind = "user-rejection" | "user-correction" | "command-failure" | "suggestion-rejected";
export interface MistakeEvent {
    sessionId: string;
    timestamp: string;
    targetKind: "agent" | "skill" | "main";
    targetId: string;
    /** Tool that completed before the user fix message (all tool types). */
    toolName: string;
    kind: MistakeKind;
    mistakeSummary: string;
    correctionSummary?: string;
    confidence: "high" | "low";
}
export interface MistakePattern {
    kind: MistakeKind;
    /** Tool name grouped (Bash, Edit, Read, Agent, Skill, MCP tools, etc.). */
    tool: string;
    count: number;
    examples: Array<{
        mistake: string;
        correction?: string;
    }>;
}
export type FlagType = "dead-section" | "low-confidence-dead-section" | "unused-tool" | "never-applied-skill" | "never-invoked-agent" | "rarely-used-agent" | "recurring-mistakes" | "hot-path";
export interface Flag {
    type: FlagType;
    target?: string;
    section?: string;
    confidence: "high" | "low";
}
export interface AgentProfile {
    id: string;
    path: string;
    score: number;
    invocations: number;
    declaredTools: string[];
    usedTools: string[];
    flags: Flag[];
    flaggedSectionText?: Record<string, string>;
    mistakePatterns?: MistakePattern[];
}
export interface AnalysisTotals {
    sessions: number;
    toolCalls: number;
    agentRuns: number;
    skillLoads: number;
    skippedTranscriptLines?: number;
}
export interface AnalysisResult {
    generatedAt: string;
    sessionCount: number;
    readMode: PrivacyMode;
    totals: AnalysisTotals;
    languages: Record<string, number>;
    agents: AgentProfile[];
    skills: AgentProfile[];
    feedback: string[];
}
export interface StyleProfile {
    frontmatterKeyOrder: string[];
    headingStyle: "atx" | "setext";
    bulletStyle: "-" | "*" | "+";
    numberedLists: boolean;
    toneKeywords: string[];
    avgSectionLength: number;
    derivedFromFiles?: number;
}
export interface BackupManifestEntry {
    originalPath: string;
    backupPath: string | null;
    runId: string;
    timestamp: string;
    writtenChecksum: string;
}
export interface FailedSessionEntry {
    error: string;
    skippedAt: string;
}
export interface BackupManifest {
    entries: Record<string, BackupManifestEntry>;
}
export interface SessionCounter {
    count: number;
    seenIds: string[];
}
export interface ProfileCache {
    sessions: Record<string, SessionProfile>;
    failedSessions?: Record<string, FailedSessionEntry>;
}
export type CommandResult = {
    ok: true;
    message?: string;
} | {
    ok: false;
    error: string;
};
//# sourceMappingURL=types.d.ts.map