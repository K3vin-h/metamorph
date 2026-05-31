"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isActionableTarget = isActionableTarget;
exports.filterActionableTargets = filterActionableTargets;
exports.countNeverUsed = countNeverUsed;
exports.shouldSkipImproveTarget = shouldSkipImproveTarget;
const flagsShort_js_1 = require("./flagsShort.js");
/** Target has real usage and meets minimum score for improvement suggestions. */
function isActionableTarget(profile, config) {
    if ((0, flagsShort_js_1.isNeverInvoked)(profile.flags))
        return false;
    if (profile.invocations < config.improve.minInvocations)
        return false;
    if (profile.score < config.improve.minScore)
        return false;
    return true;
}
function filterActionableTargets(targets, config) {
    return targets
        .filter((t) => isActionableTarget(t, config))
        .sort((a, b) => a.score - b.score);
}
function countNeverUsed(targets) {
    return targets.filter((t) => (0, flagsShort_js_1.isNeverInvoked)(t.flags) || t.invocations === 0).length;
}
function shouldSkipImproveTarget(profile, config, force) {
    if (force || !profile)
        return null;
    if (config.improve.skipNeverInvoked && (0, flagsShort_js_1.isNeverInvoked)(profile.flags)) {
        return "never invoked — use --target or prepare-improve-batch --force to include";
    }
    if (profile.invocations < config.improve.minInvocations) {
        return "no usage recorded — use --target or prepare-improve-batch --force to include";
    }
    return null;
}
//# sourceMappingURL=actionableTargets.js.map