import type { Config } from "./types.js";
declare const DEFAULTS: Config;
declare function mergeWithDefaults(raw: unknown): Config;
export declare function loadConfig(pluginRoot: string): Config;
export declare function writeConfig(pluginRoot: string, config: Config): void;
export declare function setConfigValue(pluginRoot: string, keyPath: string, rawValue: string): void;
export { DEFAULTS, mergeWithDefaults };
//# sourceMappingURL=config.d.ts.map