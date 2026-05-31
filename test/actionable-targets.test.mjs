import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  countNeverUsed,
  filterActionableTargets,
  isActionableTarget,
  shouldSkipImproveTarget,
} from "../dist/improve/actionableTargets.js";
import { displayFlag, shortFlag } from "../dist/improve/flagsShort.js";

const config = {
  improve: {
    skipNeverInvoked: true,
    minScore: 30,
    minInvocations: 1,
  },
};

function target(overrides = {}) {
  return {
    id: "code-reviewer",
    path: "agents/code-reviewer.md",
    score: 58,
    invocations: 5,
    declaredTools: [],
    usedTools: [],
    flags: [{ type: "unused-tool", target: "Bash", confidence: "low" }],
    ...overrides,
  };
}

describe("actionable target filtering", () => {
  it("accepts used targets at or above the configured score floor", () => {
    assert.equal(isActionableTarget(target({ score: 30 }), config), true);
  });

  it("rejects never-invoked targets even when the score is above the floor", () => {
    assert.equal(
      isActionableTarget(
        target({
          score: 50,
          invocations: 0,
          flags: [{ type: "never-invoked-agent", confidence: "high" }],
        }),
        config
      ),
      false
    );
  });

  it("rejects low-score targets and sorts accepted targets by lowest score first", () => {
    const result = filterActionableTargets(
      [
        target({ id: "healthy", score: 80 }),
        target({ id: "too-low", score: 29 }),
        target({ id: "middle", score: 55 }),
      ],
      config
    );

    assert.deepEqual(result.map((t) => t.id), ["middle", "healthy"]);
  });

  it("counts never-used targets from either flags or zero invocations", () => {
    assert.equal(
      countNeverUsed([
        target({ invocations: 0 }),
        target({ flags: [{ type: "never-invoked-agent", confidence: "high" }] }),
        target({ invocations: 3 }),
      ]),
      2
    );
  });

  it("skips never-invoked improve targets unless forced", () => {
    const never = target({
      invocations: 0,
      flags: [{ type: "never-invoked-agent", confidence: "high" }],
    });

    assert.match(shouldSkipImproveTarget(never, config, false), /never invoked/);
    assert.equal(shouldSkipImproveTarget(never, config, true), null);
  });
});

describe("flag display labels", () => {
  it("uses professional labels for public reports and commands", () => {
    assert.equal(shortFlag([{ type: "never-invoked-agent", confidence: "high" }]), "inactive");
    assert.equal(shortFlag([{ type: "never-applied-skill", confidence: "high" }]), "inactive");
    assert.equal(shortFlag([{ type: "rarely-used-agent", confidence: "low" }]), "underused");
    assert.equal(shortFlag([{ type: "hot-path", confidence: "high" }]), "healthy");
    assert.equal(shortFlag([{ type: "unused-tool", confidence: "low" }]), "tool-gap");
    assert.equal(shortFlag([{ type: "dead-section", confidence: "high" }]), "stale-doc");
    assert.equal(shortFlag([{ type: "low-confidence-dead-section", confidence: "low" }]), "stale-doc?");
    assert.equal(shortFlag([{ type: "recurring-mistakes", confidence: "high" }]), "correction");
    assert.equal(displayFlag([]), "—");
  });
});
