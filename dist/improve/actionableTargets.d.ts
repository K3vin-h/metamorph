import type { AgentProfile, Config } from "../types.js";
/** Target has real usage and meets minimum score for improvement suggestions. */
export declare function isActionableTarget(profile: AgentProfile, config: Config): boolean;
export declare function filterActionableTargets(targets: AgentProfile[], config: Config): AgentProfile[];
export declare function countNeverUsed(targets: AgentProfile[]): number;
export declare function shouldSkipImproveTarget(profile: AgentProfile | null, config: Config, force: boolean): string | null;
//# sourceMappingURL=actionableTargets.d.ts.map