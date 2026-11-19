import { describe, expect, it } from "vitest";
import { buildGeminiPrompt, Lifestyle } from "../lib/recommendations";
import { AqiReading, categorizeUsAqi } from "../lib/aqi";

const lifestyle: Lifestyle = {
  city: "Delhi",
  commute: "two-wheeler",
  outdoorExercise: true,
  sensitiveHousehold: true,
  ventilation: "mixed",
};

const aqi: AqiReading = {
  usAqi: 165,
  pm25: 56.6,
  pm10: 57.3,
  nitrogenDioxide: 10.5,
  ozone: 187,
  time: "2026-11-19T13:30",
  utcOffsetSeconds: 19800,
};

describe("buildGeminiPrompt", () => {
  const prompt = buildGeminiPrompt(lifestyle, aqi, categorizeUsAqi(165), [
    { time: "2026-11-19T14:00", usAqi: 170 },
  ]);

  it("constrains the AI to selecting action IDs, not writing advice", () => {
    expect(prompt).toMatch(/only select and order action IDs/i);
    expect(prompt).toMatch(/check-aqi/);
    expect(prompt).toMatch(/n95-not-gases/);
    expect(prompt).toMatch(/do not assume certain times of day/i);
  });

  it("never sends household health details to the model", () => {
    expect(prompt).not.toMatch(/sensitive/i);
  });
});
