import type { AgentProfile } from "../types.js";
/** Short flag for tables and improve context (one primary flag). */
export declare function shortFlag(flags: AgentProfile["flags"]): string;
/** Table display: ok → em dash */
export declare function displayFlag(flags: AgentProfile["flags"]): string;
export declare function isNeverInvoked(flags: AgentProfile["flags"]): boolean;
//# sourceMappingURL=flagsShort.d.ts.map