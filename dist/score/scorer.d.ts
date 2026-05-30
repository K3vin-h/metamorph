import type { AgentProfile, AnalysisTotals, Config } from "../types.js";
interface TargetData {
    id: string;
    path: string;
    invocations: number;
    declaredTools: string[];
    usedTools: string[];
    sections: string[];
    rawContent: string;
    loads: number;
    applied: number;
}
export declare function scoreTarget(data: TargetData, totals: AnalysisTotals, config: Config, kind: "agent" | "skill"): AgentProfile;
export {};
//# sourceMappingURL=scorer.d.ts.map