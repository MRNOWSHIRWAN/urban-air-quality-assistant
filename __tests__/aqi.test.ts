import { describe, expect, it } from "vitest";
import { categorizeUsAqi, fetchAirQuality, fetchHourlyAqi, bestOutdoorWindow, readingAgeMinutes } from "../lib/aqi";
import { vi, afterEach } from "vitest";

describe("categorizeUsAqi", () => {
  it("bands boundary values per US EPA scale", () => {
    expect(categorizeUsAqi(0).band).toBe("good");
    expect(categorizeUsAqi(50).band).toBe("good");
    expect(categorizeUsAqi(51).band).toBe("moderate");
    expect(categorizeUsAqi(100).band).toBe("moderate");
    expect(categorizeUsAqi(101).band).toBe("usg");
    expect(categorizeUsAqi(150).band).toBe("usg");
    expect(categorizeUsAqi(151).band).toBe("unhealthy");
    expect(categorizeUsAqi(200).band).toBe("unhealthy");
    expect(categorizeUsAqi(201).band).toBe("very-unhealthy");
    expect(categorizeUsAqi(301).band).toBe("hazardous");
  });
});

describe("fetch error and edge handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchAirQuality returns null on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await fetchAirQuality(28.6, 77.2)).toBeNull();
  });

  it("fetchAirQuality returns null when current.us_aqi missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ current: {} }) })));
    expect(await fetchAirQuality(28.6, 77.2)).toBeNull();
  });

  it("fetchHourlyAqi drops missing values", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ hourly: { time: ["2026-11-19T13:00", "2026-11-19T14:00"], us_aqi: [150, null] } }),
    })));
    const h = await fetchHourlyAqi(28.6, 77.2);
    expect(h).toEqual([{ time: "2026-11-19T13:00", usAqi: 150 }]);
  });

  it("bestOutdoorWindow falls back to first 24 h when fromTime is beyond data", () => {
    const hours = [
      { time: "2026-11-19T00:00", usAqi: 300 },
      { time: "2026-11-19T01:00", usAqi: 100 },
      { time: "2026-11-19T02:00", usAqi: 100 },
      { time: "2026-11-19T03:00", usAqi: 100 },
    ];
    const w = bestOutdoorWindow(hours, "2026-12-31T23:00");
    expect(w).not.toBeNull();
    expect(w!.avgAqi).toBe(100);
  });
});


describe("readingAgeMinutes (stale/future bounds on the current reading)", () => {
  it("computes the age of a past reading", () => {
    expect(readingAgeMinutes("2026-11-19T13:30", "2026-11-19T12:00")).toBe(90);
  });

  it("returns a negative age for a reading ahead of the clock", () => {
    expect(readingAgeMinutes("2026-11-19T12:00", "2026-11-19T13:00")).toBe(-60);
  });

  it("returns 0 for unparseable input instead of crashing", () => {
    expect(readingAgeMinutes("not-a-date", "2026-11-19T13:00")).toBe(0);
  });
});

describe("forecast stale/future bounds", () => {
  it("all-stale forecast yields no window (no past hours shown as ahead)", () => {
    const stale = [
      { time: "2026-11-18T20:00", usAqi: 100 },
      { time: "2026-11-18T21:00", usAqi: 90 },
      { time: "2026-11-18T22:00", usAqi: 95 },
    ];
    const nowLocal = "2026-11-19T13:30";
    const upcoming = stale.filter((h) => h.time >= nowLocal);
    expect(upcoming).toHaveLength(0);
    expect(bestOutdoorWindow(upcoming, nowLocal)).toBeNull();
  });

  it("mixed stale/future forecast keeps only future hours", () => {
    const hours = [
      { time: "2026-11-19T12:00", usAqi: 100 },
      { time: "2026-11-19T13:00", usAqi: 120 },
      { time: "2026-11-19T14:00", usAqi: 110 },
      { time: "2026-11-19T15:00", usAqi: 90 },
      { time: "2026-11-19T16:00", usAqi: 95 },
      { time: "2026-11-19T17:00", usAqi: 100 },
    ];
    const upcoming = hours.filter((h) => h.time >= "2026-11-19T13:30");
    const w = bestOutdoorWindow(upcoming, "2026-11-19T13:30");
    expect(w).not.toBeNull();
    expect(w!.start).toBe("2026-11-19T15:00");
    expect(w!.avgAqi).toBe(95);
  });
});
