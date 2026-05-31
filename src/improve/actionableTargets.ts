import type { AgentProfile, Config } from "../types.js";
import { isNeverInvoked } from "./flagsShort.js";

/** Target has real usage and meets minimum score for improvement suggestions. */
export function isActionableTarget(profile: AgentProfile, config: Config): boolean {
  if (isNeverInvoked(profile.flags)) return false;
  if (profile.invocations < config.improve.minInvocations) return false;
  if (profile.score < config.improve.minScore) return false;
  return true;
}

export function filterActionableTargets(
  targets: AgentProfile[],
  config: Config
): AgentProfile[] {
  return targets
    .filter((t) => isActionableTarget(t, config))
    .sort((a, b) => a.score - b.score);
}

export function countNeverUsed(targets: AgentProfile[]): number {
  return targets.filter((t) => isNeverInvoked(t.flags) || t.invocations === 0).length;
}

export function shouldSkipImproveTarget(
  profile: AgentProfile | null,
  config: Config,
  force: boolean
): string | null {
  if (force || !profile) return null;

  if (config.improve.skipNeverInvoked && isNeverInvoked(profile.flags)) {
    return "never invoked — use --target or prepare-improve-batch --force to include";
  }

  if (profile.invocations < config.improve.minInvocations) {
    return "no usage recorded — use --target or prepare-improve-batch --force to include";
  }

  return null;
}
