import { AqiReading, AqiCategory } from "./aqi";
import { ACTIONS } from "./actions";

export interface Lifestyle {
  city: string;
  commute: "walk" | "cycle" | "two-wheeler" | "car" | "public-transport";
  outdoorExercise: boolean;
  sensitiveHousehold: boolean;
  ventilation: "open-windows" | "closed-ac" | "mixed";
}

// The AI only ranks and selects action IDs from the validated, source-backed
// action library below. All health and protection text shown to the user is
// the library's fixed template text; household health details are never sent
// to the model.
export function buildGeminiPrompt(
  lifestyle: Lifestyle,
  aqi: AqiReading,
  category: AqiCategory,
  forecast: { time: string; usAqi: number }[]
): string {
  // Sensitive-household actions are merged deterministically on the server
  // and are never shown to the model (household health detail stays local).
  const catalog = ACTIONS.filter(
    (a) => a.id !== "sensitive-avoid" && a.id !== "sensitive-watch"
  )
    .map((a) => `- ${a.id} (${a.section}): ${a.blurb}`)
    .join("\n");
  const forecastLines = forecast
    .slice(0, 24)
    .map((h) => `${h.time}: AQI ${h.usAqi}`)
    .join("; ");
  return [
    "You are an urban air quality assistant for Indian cities during winter smog season.",
    "You do NOT write advice. You only select and order action IDs from the validated action library below.",
    "Respond ONLY with JSON matching this shape:",
    '{"routines": string[], "indoorHacks": string[], "alternatives": string[], "impacts": string[]}',
    "routines/indoorHacks/alternatives/impacts: 3-4 action IDs each, chosen only from the library and placed in the section named in parentheses, ordered most relevant first for this user.",
    "Output only the JSON object with those four arrays - no note, no free text, no commentary.",
    "Unknown IDs or malformed arrays are rejected entirely; extra keys are ignored.",
    "Do not invent AQI numbers beyond the data given. Do not assume certain times of day are cleaner; rely only on the hourly forecast.",
    "",
    "Action library:",
    catalog,
    "",
    `City: ${lifestyle.city}`,
    `US AQI now: ${aqi.usAqi} (${category.label})`,
    `PM2.5: ${aqi.pm25} ug/m3, PM10: ${aqi.pm10} ug/m3, NO2: ${aqi.nitrogenDioxide} ug/m3, Ozone: ${aqi.ozone} ug/m3`,
    `Data time: ${aqi.time} local (CAMS model estimate via Open-Meteo)`,
    `Hourly US AQI forecast (next 24h, model): ${forecastLines}`,
    `Commute mode: ${lifestyle.commute}`,
    `Outdoor exercise habit: ${lifestyle.outdoorExercise ? "yes" : "no"}`,
    `Home ventilation style: ${lifestyle.ventilation}`,
  ].join("\n");
}
