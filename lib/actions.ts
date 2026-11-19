import { AqiCategory } from "./aqi";

export type Section = "routines" | "indoorHacks" | "alternatives" | "impacts";

export interface SourceRef {
  label: string;
  url: string;
}

export interface ActionContext {
  category: AqiCategory;
  usAqi: number;
  outdoorExercise: boolean;
  sensitiveHousehold: boolean;
  commute: "walk" | "cycle" | "two-wheeler" | "car" | "public-transport";
  ventilation: "open-windows" | "closed-ac" | "mixed";
}

export interface ActionDef {
  id: string;
  section: Section;
  // Short description shown to the AI so it can pick IDs.
  blurb: string;
  // Deterministic user-visible text. {aqi} and {label} are filled at render
  // time from live data; no other text is ever generated for guidance.
  template: string;
  sources: SourceRef[];
  applies: (ctx: ActionContext) => boolean;
}

const BAND_ORDER = ["good", "moderate", "usg", "unhealthy", "very-unhealthy", "hazardous"];

export function bandAtLeast(category: AqiCategory, min: string): boolean {
  return BAND_ORDER.indexOf(category.band) >= BAND_ORDER.indexOf(min);
}

const AQI_BASICS: SourceRef = {
  label: "US EPA AirNow - AQI Basics",
  url: "https://www.airnow.gov/aqi/aqi-basics/",
};
const SMOKE_GUIDE: SourceRef = {
  label: "US EPA AirNow - Wildfire Smoke Guide (respirators filter particles, not gases)",
  url: "https://www.airnow.gov/sites/default/files/2021-09/wildfire-smoke-guide-chapters-1-3.pdf",
};
const SMOKE_PAGE: SourceRef = {
  label: "US EPA AirNow - When Smoke is in the Air",
  url: "https://www.airnow.gov/wildfires/when-smoke-is-in-the-air/",
};
const OZONE_GUIDE: SourceRef = {
  label: "US EPA AirNow - Air Quality Guide for Ozone",
  url: "https://document.airnow.gov/air-quality-guide-for-ozone.pdf",
};
const AIR_CLEANERS: SourceRef = {
  label: "US EPA - Guide to Air Cleaners in the Home",
  url: "https://www.epa.gov/indoor-air-quality-iaq/guide-air-cleaners-home",
};
const HEPA_FILTER: SourceRef = {
  label: "US EPA - What is a HEPA filter?",
  url: "https://www.epa.gov/indoor-air-quality-iaq/what-hepa-filter",
};
const IMPROVING_IAQ: SourceRef = {
  label: "US EPA - Improving Indoor Air Quality",
  url: "https://www.epa.gov/indoor-air-quality-iaq/improving-indoor-air-quality",
};
const OZONE_GENERATORS: SourceRef = {
  label: "US EPA - Ozone Generators Sold as Air Cleaners",
  url: "https://www.epa.gov/indoor-air-quality-iaq/ozone-generators-are-sold-air-cleaners",
};
const TRANSPORT: SourceRef = {
  label: "US EPA - Transportation, Air Pollution and Climate Change",
  url: "https://www.epa.gov/transportation-air-pollution-and-climate-change",
};
const DRIVE_EFFICIENT: SourceRef = {
  label: "US DOE/EPA FuelEconomy.gov - Driving More Efficiently",
  url: "https://www.fueleconomy.gov/feg/driveHabits.jsp",
};

export const ACTIONS: ActionDef[] = [
  // --- routines ---
  {
    id: "check-aqi",
    section: "routines",
    blurb: "Check the current US AQI before heading out.",
    template: "Check the US AQI before heading out; the current model estimate is {aqi} ({label}).",
    sources: [AQI_BASICS],
    applies: () => true,
  },
  {
    id: "forecast-timing",
    section: "routines",
    blurb: "Schedule essential outdoor trips in the forecast's lowest-AQI hours.",
    template:
      "Use the hourly forecast above to schedule essential outdoor trips in the lowest-AQI hours; do not assume a fixed time of day is cleaner.",
    sources: [AQI_BASICS],
    applies: () => true,
  },
  {
    id: "reduce-exertion",
    section: "routines",
    blurb: "Reduce prolonged or heavy outdoor exertion at Unhealthy or worse AQI.",
    template:
      "US EPA guidance for {label} AQI: everyone should reduce prolonged or heavy outdoor exertion.",
    sources: [AQI_BASICS],
    applies: (c) => bandAtLeast(c.category, "unhealthy"),
  },
  {
    id: "sensitive-avoid",
    section: "routines",
    blurb: "Sensitive household members should avoid outdoor exertion at USG or worse AQI.",
    template:
      "US EPA guidance: at {label} AQI, sensitive groups (children, older adults, people with asthma or heart conditions) should avoid outdoor exertion.",
    sources: [AQI_BASICS],
    applies: (c) => bandAtLeast(c.category, "usg") && c.sensitiveHousehold,
  },
  {
    id: "sensitive-watch",
    section: "routines",
    blurb: "Sensitive household members should watch for symptoms at Moderate AQI.",
    template:
      "Because someone at home is sensitive, watch for symptoms at Moderate AQI; the US EPA advises unusually sensitive people to be cautious in this band.",
    sources: [AQI_BASICS],
    applies: (c) => c.category.band === "moderate" && c.sensitiveHousehold,
  },
  {
    id: "n95-particles",
    section: "routines",
    blurb: "Wear a well-fitted NIOSH-approved N95/P100 respirator outdoors on poor-AQI days.",
    template:
      "If you must be outside, a well-fitted NIOSH-approved N95 or P100 respirator filters fine particles such as PM2.5; a tight face seal matters more than the model.",
    sources: [SMOKE_PAGE, SMOKE_GUIDE],
    applies: (c) => bandAtLeast(c.category, "usg"),
  },
  {
    id: "n95-not-gases",
    section: "routines",
    blurb: "Clarify that respirators do not protect against ozone or other gases.",
    template:
      "Respirators remove particles only, not gases or vapors: they do not protect against ozone. On high-ozone days, reduce outdoor time and exertion instead.",
    sources: [SMOKE_GUIDE, OZONE_GUIDE],
    applies: (c) => bandAtLeast(c.category, "usg"),
  },
  {
    id: "exercise-ok",
    section: "routines",
    blurb: "Outdoor exercise is fine for most people at Good/Moderate AQI.",
    template:
      "At {label} AQI, outdoor exercise is fine for most people; unusually sensitive people should watch for symptoms.",
    sources: [AQI_BASICS],
    applies: (c) => !bandAtLeast(c.category, "usg") && c.outdoorExercise,
  },
  {
    id: "exercise-indoors",
    section: "routines",
    blurb: "Move outdoor workouts indoors or to the lowest-AQI hours at USG or worse AQI.",
    template:
      "Move today's outdoor workout indoors, or to the forecast's lowest-AQI hours, while AQI is {label}.",
    sources: [AQI_BASICS],
    applies: (c) => bandAtLeast(c.category, "usg") && c.outdoorExercise,
  },
  {
    id: "avoid-idling",
    section: "routines",
    blurb: "Avoid engine idling on motorized commutes.",
    template:
      "Avoid idling: switch off the engine at stops longer than a minute to cut wasted fuel and local exhaust.",
    sources: [DRIVE_EFFICIENT],
    applies: (c) => c.commute === "car" || c.commute === "two-wheeler",
  },
  {
    id: "combine-trips",
    section: "alternatives",
    blurb: "Combine errands into one trip to cut journeys and cold starts.",
    template:
      "Combine errands into one trip: per US DOE/EPA, several short trips from a cold start can use about twice as much fuel as one longer trip with a warm engine.",
    sources: [DRIVE_EFFICIENT],
    applies: () => true,
  },
  // --- indoorHacks ---
  {
    id: "windows-closed",
    section: "indoorHacks",
    blurb: "Keep windows and doors closed while outdoor AQI is poor.",
    template:
      "Keep windows and doors closed while outdoor AQI is poor; indoor particle levels track outdoor levels.",
    sources: [SMOKE_PAGE],
    applies: (c) => bandAtLeast(c.category, "usg"),
  },
  {
    id: "air-when-clean",
    section: "indoorHacks",
    blurb: "Air out rooms briefly when the forecast shows a cleaner spell.",
    template:
      "If the forecast shows a cleaner spell, air out rooms briefly during those hours; the US EPA advises ventilating with clean outdoor air.",
    sources: [IMPROVING_IAQ],
    applies: (c) => bandAtLeast(c.category, "usg") && c.ventilation !== "closed-ac",
  },
  {
    id: "hepa",
    section: "indoorHacks",
    blurb: "Run a HEPA portable air cleaner sized for the room.",
    template:
      "Run a portable air cleaner with a HEPA filter sized for the room to reduce indoor particle levels.",
    sources: [AIR_CLEANERS, HEPA_FILTER],
    applies: (c) => bandAtLeast(c.category, "usg"),
  },
  {
    id: "no-indoor-smoke",
    section: "indoorHacks",
    blurb: "Avoid smoking and burning incense indoors.",
    template:
      "Avoid smoking and burning incense indoors; removing pollutant sources is the most effective way to protect indoor air.",
    sources: [IMPROVING_IAQ],
    applies: () => true,
  },
  {
    id: "cook-vent",
    section: "indoorHacks",
    blurb: "Use exhaust ventilation while cooking.",
    template:
      "Use exhaust ventilation while cooking; combustion fumes need venting even when outdoor air is poor.",
    sources: [IMPROVING_IAQ],
    applies: () => true,
  },
  {
    id: "no-ozone-gen",
    section: "indoorHacks",
    blurb: "Never use devices that intentionally generate ozone indoors.",
    template:
      "Never use a device that intentionally generates ozone indoors; the US EPA warns these can create a harmful pollutant at levels that risk health.",
    sources: [OZONE_GENERATORS],
    applies: (c) => bandAtLeast(c.category, "usg"),
  },
  // --- alternatives ---
  {
    id: "public-transit",
    section: "alternatives",
    blurb: "Choose public transport over a private vehicle for the commute.",
    template:
      "Choose public transport over a private vehicle for the commute to lower per-person tailpipe emissions.",
    sources: [TRANSPORT],
    applies: (c) => c.commute === "car" || c.commute === "two-wheeler",
  },
  {
    id: "carpool",
    section: "alternatives",
    blurb: "Carpool to split one vehicle's emissions across more people.",
    template: "Carpool to split one vehicle's emissions across more people.",
    sources: [TRANSPORT],
    applies: (c) => c.commute === "car",
  },
  {
    id: "walk-short",
    section: "alternatives",
    blurb: "Walk or cycle short trips instead of driving at Good/Moderate AQI.",
    template:
      "At {label} AQI, US EPA guidance says outdoor activity is fine for most people, so walk or cycle short neighborhood trips instead of driving.",
    sources: [TRANSPORT, AQI_BASICS],
    applies: (c) => !bandAtLeast(c.category, "usg") && c.commute !== "walk" && c.commute !== "cycle",
  },
  {
    id: "wfh",
    section: "alternatives",
    blurb: "Work or study from home on severe smog days, removing the commute.",
    template:
      "Work or study from home when possible on severe smog days, removing the commute's emissions entirely.",
    sources: [TRANSPORT],
    applies: (c) => bandAtLeast(c.category, "unhealthy"),
  },
  // --- impacts ---
  {
    id: "impact-exertion",
    section: "impacts",
    blurb: "Lower exertion at poor AQI lowers inhaled pollution.",
    template: "Cutting outdoor exertion at {label} AQI lowers the amount of polluted air you inhale.",
    sources: [AQI_BASICS],
    applies: (c) => bandAtLeast(c.category, "usg"),
  },
  {
    id: "impact-mask",
    section: "impacts",
    blurb: "A well-sealed N95 filters at least 95% of 0.3-micron particles.",
    template:
      "A NIOSH-approved N95 filters at least 95% of the hardest-to-capture 0.3-micron particles when it seals well to the face; it does not filter gases.",
    sources: [SMOKE_GUIDE],
    applies: (c) => bandAtLeast(c.category, "usg"),
  },
  {
    id: "impact-hepa",
    section: "impacts",
    blurb: "HEPA filters capture at least 99.97% of 0.3-micron particles.",
    template: "HEPA filters capture at least 99.97% of 0.3-micron particles that pass through them.",
    sources: [HEPA_FILTER],
    applies: (c) => bandAtLeast(c.category, "usg"),
  },
  {
    id: "impact-transit",
    section: "impacts",
    blurb: "Every car trip shifted to public transport or carpooling cuts local vehicle emissions.",
    template:
      "Every car trip shifted to public transport or carpooling cuts local vehicle emissions.",
    sources: [TRANSPORT],
    applies: () => true,
  },
  {
    id: "impact-active-travel",
    section: "impacts",
    blurb: "At Good/Moderate AQI, walking or cycling short trips cuts emissions within activity guidance.",
    template:
      "At {label} AQI, US EPA guidance says outdoor activity is fine for most people, so walking or cycling short trips instead of driving cuts emissions within that guidance.",
    sources: [AQI_BASICS, TRANSPORT],
    applies: (c) => !bandAtLeast(c.category, "usg"),
  },
  {
    id: "impact-indoor",
    section: "impacts",
    blurb: "Closing windows and filtering indoor air reduces indoor particle exposure.",
    template:
      "Closing windows and filtering indoor air during polluted spells reduces indoor particle exposure.",
    sources: [SMOKE_PAGE, AIR_CLEANERS],
    applies: (c) => bandAtLeast(c.category, "usg"),
  },
];

const byId = new Map(ACTIONS.map((a) => [a.id, a]));

export interface RenderedItem {
  id: string;
  text: string;
  sources: SourceRef[];
}

export interface ResolvedPlan {
  routines: RenderedItem[];
  indoorHacks: RenderedItem[];
  alternatives: RenderedItem[];
  impacts: RenderedItem[];
}

function renderItem(def: ActionDef, ctx: ActionContext): RenderedItem {
  return {
    id: def.id,
    text: def.template.split("{aqi}").join(String(ctx.usAqi)).split("{label}").join(ctx.category.label),
    sources: def.sources,
  };
}

const DEFAULT_ORDER: Record<Section, string[]> = {
  routines: [
    "check-aqi",
    "reduce-exertion",
    "sensitive-avoid",
    "sensitive-watch",
    "forecast-timing",
    "n95-particles",
    "n95-not-gases",
    "exercise-indoors",
    "exercise-ok",
    "avoid-idling",
  ],
  indoorHacks: ["windows-closed", "hepa", "no-indoor-smoke", "cook-vent", "air-when-clean", "no-ozone-gen"],
  alternatives: ["public-transit", "carpool", "walk-short", "combine-trips", "wfh"],
  impacts: ["impact-exertion", "impact-mask", "impact-hepa", "impact-indoor", "impact-active-travel", "impact-transit"],
};

function fillSection(section: Section, ids: string[], ctx: ActionContext, max: number): RenderedItem[] {
  const seen = new Set<string>();
  const items: RenderedItem[] = [];
  for (const id of ids) {
    const def = byId.get(id);
    if (!def || def.section !== section || seen.has(id)) continue;
    if (!def.applies(ctx)) continue; // deterministic activity/AQI compatibility
    seen.add(id);
    items.push(renderItem(def, ctx));
    if (items.length >= max) break;
  }
  return items;
}

// Deterministic safety pairs: if an action needs a clarification to avoid a
// misleading impression, the pair is always present together.
const REQUIRED_PAIRS: Record<string, string> = {
  "n95-particles": "n95-not-gases",
};

function withRequiredPairs(section: Section, ids: string[], ctx: ActionContext): string[] {
  const out = [...ids];
  // insert the required clarification immediately after its trigger so the
  // per-section cap can never cut it off
  for (const [trigger, required] of Object.entries(REQUIRED_PAIRS)) {
    const trigDef = byId.get(trigger);
    const idx = out.indexOf(trigger);
    if (trigDef && trigDef.section === section && idx >= 0 && !out.includes(required)) {
      out.splice(idx + 1, 0, required);
    }
  }
  // sensitive-household safety line is always merged first when applicable
  if (section === "routines" && ctx.sensitiveHousehold) {
    const sensId = bandAtLeast(ctx.category, "usg")
      ? "sensitive-avoid"
      : ctx.category.band === "moderate"
        ? "sensitive-watch"
        : null;
    if (sensId && !out.includes(sensId)) out.unshift(sensId);
  }
  return out;
}

const SECTIONS: Section[] = ["routines", "indoorHacks", "alternatives", "impacts"];

export function defaultPlan(ctx: ActionContext, maxPerSection = 4): ResolvedPlan {
  const out = {} as Record<Section, RenderedItem[]>;
  for (const s of SECTIONS) {
    out[s] = fillSection(s, withRequiredPairs(s, DEFAULT_ORDER[s], ctx), ctx, maxPerSection + 2);
  }
  return { ...out };
}

export interface AiSelection {
  routines?: unknown;
  indoorHacks?: unknown;
  alternatives?: unknown;
  impacts?: unknown;
}

// The AI only picks action IDs per section. Unknown IDs or malformed shapes
// reject the whole selection (caller falls back to the deterministic default
// plan). Known IDs placed in the wrong section are relocated to their
// library-defined section rather than rejecting the whole plan. Incompatible
// picks for the current AQI band are dropped and the section is backfilled
// from the default order.
export function resolveAiSelection(sel: AiSelection, ctx: ActionContext, maxPerSection = 4): ResolvedPlan | null {
  const perSection: Record<Section, string[]> = { routines: [], indoorHacks: [], alternatives: [], impacts: [] };
  for (const s of SECTIONS) {
    const raw = sel[s];
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > maxPerSection) return null;
    for (const id of raw) {
      if (typeof id !== "string") return null;
      const def = byId.get(id);
      if (!def) return null;
      perSection[def.section].push(id);
    }
  }
  const out = {} as Record<Section, RenderedItem[]>;
  for (const s of SECTIONS) {
    const withPairs = withRequiredPairs(s, perSection[s], ctx);
    let items = fillSection(s, withPairs, ctx, maxPerSection + 2);
    if (items.length === 0) {
      items = fillSection(s, DEFAULT_ORDER[s], ctx, 3);
    }
    out[s] = items;
  }
  return { ...out };
}
