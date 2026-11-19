import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const buildGeminiPromptMock = vi.fn(
  (_lifestyle: unknown, _aqi: unknown, _category: unknown, _forecast: unknown) => "PROMPT"
);
const generatePlanWithGeminiMock = vi.fn(async () => null);

function localIso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString().slice(0, 16);
}

vi.mock("@/lib/aqi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/aqi")>();
  return {
    ...actual,
    geocodeCity: async () => ({ name: "Delhi", country: "India", latitude: 28.65, longitude: 77.23 }),
    fetchAirQuality: async () => ({
      usAqi: 165,
      pm25: 56.6,
      pm10: 57.3,
      nitrogenDioxide: 10.5,
      ozone: 187,
      // 30 minutes old in location-local time (UTC+5:30)
      time: localIso(19800_000 - 30 * 60_000),
      utcOffsetSeconds: 19800,
    }),
    fetchHourlyAqi: async () => [
      { time: localIso(19800_000 - 2 * 3600_000), usAqi: 150 }, // stale, past
      { time: localIso(19800_000 - 1 * 3600_000), usAqi: 155 }, // stale, past
      { time: localIso(19800_000 + 1 * 3600_000), usAqi: 160 }, // future
      { time: localIso(19800_000 + 2 * 3600_000), usAqi: 158 }, // future
      { time: localIso(19800_000 + 3 * 3600_000), usAqi: 162 }, // future
      { time: localIso(19800_000 + 4 * 3600_000), usAqi: 165 }, // future
    ],
  };
});

vi.mock("@/lib/recommendations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/recommendations")>();
  return { ...actual, buildGeminiPrompt: (l: unknown, a: unknown, c: unknown, f: unknown) => buildGeminiPromptMock(l, a, c, f) };
});

vi.mock("@/lib/gemini", () => ({
  generatePlanWithGemini: () => generatePlanWithGeminiMock(),
}));

import { POST } from "../app/api/plan/route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/plan", () => {
  beforeEach(() => {
    buildGeminiPromptMock.mockClear();
    generatePlanWithGeminiMock.mockClear();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("passes only future forecast hours to the AI prompt and the UI", async () => {
    const res = await POST(req({ city: "Delhi" }));
    expect(res.status).toBe(200);
    expect(buildGeminiPromptMock).toHaveBeenCalledTimes(1);
    const forecastArg = buildGeminiPromptMock.mock.calls[0][3] as unknown as { time: string }[];
    const nowLocal = localIso(19800_000);
    expect(forecastArg.length).toBe(4);
    for (const h of forecastArg) {
      expect(h.time >= nowLocal).toBe(true);
    }
    const data = await res.json();
    expect(data.forecast.length).toBe(4);
    for (const h of data.forecast as { time: string }[]) {
      expect(h.time >= nowLocal).toBe(true);
    }
  });

  it("does not flag a 30-minute-old reading as stale", async () => {
    const res = await POST(req({ city: "Delhi" }));
    const data = await res.json();
    expect(data.staleData).toBe(false);
  });

  it("rejects city names with disallowed characters", async () => {
    const res = await POST(req({ city: "Delhi<script>" }));
    expect(res.status).toBe(400);
  });

  it("accepts international city names with accents", async () => {
    const res = await POST(req({ city: "São Paulo" }));
    expect(res.status).toBe(200);
  });

  it("falls back to the rules plan when the AI returns nothing usable", async () => {
    const res = await POST(req({ city: "Delhi" }));
    const data = await res.json();
    expect(data.plan.source).toBe("rules");
    expect("note" in data.plan).toBe(false);
  });
});
