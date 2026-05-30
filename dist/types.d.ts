export type PrivacyMode = "full" | "redacted" | "off";
export interface Config {
    mode: "suggest";
    warmupSessions: number;
    maxSuggestionsPerRun: number;
    flagThreshold: number;
    read: {
        scope: "global" | "project" | "both";
        transcripts: PrivacyMode;
        denyGlobs: string[];
    };
    write: {
        targets: {
            agents: boolean;
            skills: boolean;
            claudeMd: boolean;
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
}
export type FlagType = "dead-section" | "low-confidence-dead-section" | "unused-tool" | "never-applied-skill" | "never-invoked-agent" | "rarely-used-agent" | "hot-path";
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
}
export interface AnalysisTotals {
    sessions: number;
    toolCalls: number;
    agentRuns: number;
    skillLoads: number;
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
}
export interface BackupManifestEntry {
    originalPath: string;
    backupPath: string;
    runId: string;
    timestamp: string;
    writtenChecksum: string;
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
}
export type CommandResult = {
    ok: true;
    message?: string;
} | {
    ok: false;
    error: string;
};
//# sourceMappingURL=types.d.ts.map