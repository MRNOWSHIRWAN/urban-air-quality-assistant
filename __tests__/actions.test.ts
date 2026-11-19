import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  ActionContext,
  defaultPlan,
  resolveAiSelection,
} from "../lib/actions";
import { categorizeUsAqi } from "../lib/aqi";

function ctx(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    category: categorizeUsAqi(165), // Unhealthy
    usAqi: 165,
    outdoorExercise: false,
    sensitiveHousehold: false,
    commute: "car",
    ventilation: "mixed",
    ...overrides,
  };
}

const ids = (items: { id?: string }[]) => items.map((i) => i.id);

describe("defaultPlan", () => {
  it("fills every section with source-backed items", () => {
    const plan = defaultPlan(ctx());
    for (const s of ["routines", "indoorHacks", "alternatives", "impacts"] as const) {
      expect(plan[s].length).toBeGreaterThan(0);
      for (const item of plan[s]) {
        expect(item.sources.length).toBeGreaterThan(0);
        expect(item.text).not.toMatch(/\{aqi\}|\{label\}/);
      }
    }
  });

  it("never suggests walking short trips at Unhealthy AQI", () => {
    const plan = defaultPlan(ctx({ commute: "car" }));
    expect(ids(plan.alternatives)).not.toContain("walk-short");
  });

  it("suggests walking short trips at Moderate AQI", () => {
    const plan = defaultPlan(ctx({ category: categorizeUsAqi(80), usAqi: 80 }));
    expect(ids(plan.alternatives)).toContain("walk-short");
  });

  it("pairs N95 advice with the particles-not-gases clarification", () => {
    const plan = defaultPlan(ctx());
    const r = ids(plan.routines);
    if (r.includes("n95-particles")) {
      expect(r).toContain("n95-not-gases");
    }
  });

  it("adds the sensitive-group line only for sensitive households", () => {
    expect(ids(defaultPlan(ctx({ sensitiveHousehold: true })).routines)).toContain("sensitive-avoid");
    expect(ids(defaultPlan(ctx({ sensitiveHousehold: false })).routines)).not.toContain("sensitive-avoid");
  });

  it("never lets the section cap cut the sensitive line or the N95 clarification", () => {
    const plan = resolveAiSelection(
      {
        routines: ["check-aqi", "forecast-timing", "reduce-exertion", "n95-particles"],
        indoorHacks: ["windows-closed"],
        alternatives: ["wfh"],
        impacts: ["impact-exertion"],
      },
      ctx({ sensitiveHousehold: true })
    );
    const r = ids(plan!.routines);
    expect(r).toContain("sensitive-avoid");
    expect(r).toContain("n95-particles");
    expect(r).toContain("n95-not-gases");
    expect(r.indexOf("n95-not-gases")).toBe(r.indexOf("n95-particles") + 1);
  });
});

describe("resolveAiSelection", () => {
  it("rejects unknown IDs entirely", () => {
    expect(
      resolveAiSelection(
        {
          routines: ["check-aqi", "fake-action"],
          indoorHacks: ["hepa"],
          alternatives: ["wfh"],
          impacts: ["impact-exertion"],
        },
        ctx()
      )
    ).toBeNull();
  });

  it("relocates misplaced known IDs to their library section", () => {
    const plan = resolveAiSelection(
      {
        routines: ["hepa", "check-aqi"],
        indoorHacks: ["windows-closed"],
        alternatives: ["wfh"],
        impacts: ["impact-exertion"],
      },
      ctx()
    );
    expect(plan).not.toBeNull();
    expect(ids(plan!.routines)).not.toContain("hepa");
    expect(ids(plan!.indoorHacks)).toContain("hepa");
    expect(ids(plan!.routines)).toContain("check-aqi");
  });

  it("drops AQI-incompatible picks and backfills the section", () => {
    const plan = resolveAiSelection(
      {
        routines: ["check-aqi", "n95-particles"],
        indoorHacks: ["windows-closed", "hepa"],
        alternatives: ["walk-short"],
        impacts: ["impact-exertion"],
      },
      ctx()
    );
    expect(plan).not.toBeNull();
    expect(ids(plan!.alternatives)).not.toContain("walk-short");
    expect(plan!.alternatives.length).toBeGreaterThan(0);
    expect(ids(plan!.routines)).toContain("n95-not-gases");
  });

  it("has no free-text AI note in any plan", () => {
    const plan = resolveAiSelection(
      {
        routines: ["check-aqi"],
        indoorHacks: ["hepa"],
        alternatives: ["wfh"],
        impacts: ["impact-exertion"],
      },
      ctx()
    );
    expect(plan).not.toBeNull();
    expect("note" in plan!).toBe(false);
    expect("note" in defaultPlan(ctx())).toBe(false);
  });

  it("impact text never recommends walking/cycling at Unhealthy or worse AQI", () => {
    const high = defaultPlan(ctx());
    const allImpact = high.impacts.map((i) => i.text).join(" ");
    expect(allImpact).not.toMatch(/walking or cycling/i);
    const low = defaultPlan(ctx({ category: categorizeUsAqi(80), usAqi: 80 }));
    expect(low.impacts.map((i) => i.id)).toContain("impact-active-travel");
  });
});

describe("action library integrity", () => {
  it("every action has an ID, a template, and at least one source URL", () => {
    const seen = new Set<string>();
    for (const a of ACTIONS) {
      expect(seen.has(a.id)).toBe(false);
      seen.add(a.id);
      expect(a.template.length).toBeGreaterThan(10);
      expect(a.sources.length).toBeGreaterThan(0);
      for (const s of a.sources) {
        expect(s.url).toMatch(/^https:\/\//);
      }
    }
  });

  it("respirator guidance separates particle filtration from gases", () => {
    const n95 = ACTIONS.find((a) => a.id === "n95-not-gases");
    expect(n95).toBeDefined();
    expect(n95!.template).toMatch(/ozone/i);
    expect(n95!.template).toMatch(/particles only/i);
  });
});
