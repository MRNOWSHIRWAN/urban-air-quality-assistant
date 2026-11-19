import { NextRequest, NextResponse } from "next/server";
import {
  bestOutdoorWindow,
  categorizeUsAqi,
  fetchAirQuality,
  fetchHourlyAqi,
  geocodeCity,
  readingAgeMinutes,
} from "@/lib/aqi";
import { buildGeminiPrompt, Lifestyle } from "@/lib/recommendations";
import {
  ActionContext,
  defaultPlan,
  resolveAiSelection,
  ResolvedPlan,
} from "@/lib/actions";
import { generatePlanWithGemini } from "@/lib/gemini";
import { rateLimitOk } from "@/lib/rateLimit";

const COMMUTES = ["walk", "cycle", "two-wheeler", "car", "public-transport"];
const VENTILATION = ["open-windows", "closed-ac", "mixed"];
const STALE_AFTER_MINUTES = 90;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimitOk(ip, 10, 60_000)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 }
    );
  }

  let body: Partial<Lifestyle>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Strip control characters, then allow letters (any script), spaces and
  // common name punctuation only, so legitimate international city names
  // still pass.
  const rawCity = (body.city || "").replace(/\p{C}/gu, "").trim();
  const city = rawCity.slice(0, 80);
  if (!/^[\p{L}\p{M} .,'()-]{1,80}$/u.test(city)) {
    return NextResponse.json(
      { error: "Enter a valid city name (letters, spaces, - . ' only)." },
      { status: 400 }
    );
  }
  const lifestyle: Lifestyle = {
    city,
    commute: COMMUTES.includes(body.commute as string)
      ? (body.commute as Lifestyle["commute"])
      : "public-transport",
    outdoorExercise: Boolean(body.outdoorExercise),
    sensitiveHousehold: Boolean(body.sensitiveHousehold),
    ventilation: VENTILATION.includes(body.ventilation as string)
      ? (body.ventilation as Lifestyle["ventilation"])
      : "mixed",
  };

  const geo = await geocodeCity(city);
  if (!geo) {
    return NextResponse.json(
      { error: `Could not find "${city}". Try a nearby larger city.` },
      { status: 404 }
    );
  }

  const [aqi, forecast] = await Promise.all([
    fetchAirQuality(geo.latitude, geo.longitude),
    fetchHourlyAqi(geo.latitude, geo.longitude),
  ]);
  if (!aqi) {
    return NextResponse.json(
      { error: "Air quality data unavailable right now. Try again shortly." },
      { status: 502 }
    );
  }

  const category = categorizeUsAqi(aqi.usAqi);
  // Filter by the actual clock, shifted into the location's local time, so a
  // stale API response can never present past hours as upcoming.
  const nowLocal = new Date(Date.now() + aqi.utcOffsetSeconds * 1000)
    .toISOString()
    .slice(0, 16);
  const next24h = forecast.filter((h) => h.time >= nowLocal).slice(0, 24);
  const window = bestOutdoorWindow(next24h, nowLocal);
  const ageMin = readingAgeMinutes(nowLocal, aqi.time);
  const staleData = ageMin > STALE_AFTER_MINUTES || ageMin < -60;

  const ctx: ActionContext = {
    category,
    usAqi: aqi.usAqi,
    outdoorExercise: lifestyle.outdoorExercise,
    sensitiveHousehold: lifestyle.sensitiveHousehold,
    commute: lifestyle.commute,
    ventilation: lifestyle.ventilation,
  };

  let plan: ResolvedPlan | null = null;
  let source: "gemini" | "rules" = "rules";
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    // The model sees the same future-only forecast the UI displays.
    const prompt = buildGeminiPrompt(lifestyle, aqi, category, next24h);
    const ai = await generatePlanWithGemini(prompt, apiKey);
    if (ai) {
      const resolved = resolveAiSelection(ai, ctx);
      if (resolved) {
        plan = resolved;
        source = "gemini";
      } else {
        console.warn("AI selection rejected by validation; using rules plan. Raw:", JSON.stringify(ai).slice(0, 1200));
      }
    } else {
      console.warn("AI call failed; using rules plan");
    }
  }
  if (!plan) {
    plan = defaultPlan(ctx);
  }

  return NextResponse.json({
    location: geo,
    aqi,
    category,
    forecast: next24h,
    window,
    staleData,
    plan: { ...plan, source },
  });
}
