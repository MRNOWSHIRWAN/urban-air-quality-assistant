"use client";

import { FormEvent, useState } from "react";

interface AqiCategory {
  band: string;
  label: string;
  color: string;
  advice: string;
}
interface PlanResult {
  location: { name: string; country?: string };
  aqi: {
    usAqi: number;
    pm25: number;
    pm10: number;
    nitrogenDioxide: number;
    ozone: number;
    time: string;
    utcOffsetSeconds: number;
  };
  category: AqiCategory;
  forecast: { time: string; usAqi: number }[];
  window: { start: string; end: string; avgAqi: number } | null;
  plan: {
    routines: PlanItem[];
    indoorHacks: PlanItem[];
    alternatives: PlanItem[];
    impacts: PlanItem[];
    source: "gemini" | "rules";
  };
  staleData: boolean;
}

interface PlanItem {
  id?: string;
  text: string;
  sources: { label: string; url: string }[];
}

function aqiColor(aqi: number): string {
  if (aqi <= 50) return "#00a651";
  if (aqi <= 100) return "#b7950b";
  if (aqi <= 150) return "#e67e22";
  if (aqi <= 200) return "#c0392b";
  if (aqi <= 300) return "#8e44ad";
  return "#7e0023";
}

function fmtOffset(seconds: number): string {
  const sign = seconds >= 0 ? "+" : "-";
  const abs = Math.abs(seconds);
  const h = String(Math.floor(abs / 3600)).padStart(2, "0");
  const m = String(Math.floor((abs % 3600) / 60)).padStart(2, "0");
  return `UTC${sign}${h}:${m}`;
}

function fmtDayTime(isoLocal: string): string {
  const [d, t] = isoLocal.split("T");
  const day = d ? d.slice(8, 10) : "";
  const month = d ? d.slice(5, 7) : "";
  return `${day}/${month} ${fmtHour(isoLocal)}`;
}

function fmtHour(isoLocal: string): string {
  const t = isoLocal.split("T")[1] || "";
  const h = parseInt(t.slice(0, 2), 10);
  const suffix = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${suffix}`;
}

export default function Home() {
  const [city, setCity] = useState("");
  const [commute, setCommute] = useState("public-transport");
  const [outdoorExercise, setOutdoorExercise] = useState(false);
  const [sensitiveHousehold, setSensitiveHousehold] = useState(false);
  const [ventilation, setVentilation] = useState("mixed");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResult | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          commute,
          outdoorExercise,
          sensitiveHousehold,
          ventilation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const maxForecast = result
    ? Math.max(...result.forecast.map((h) => h.usAqi), 1)
    : 1;

  return (
    <main className="mx-auto max-w-2xl p-6 font-sans text-gray-900">
      <h1 className="text-3xl font-bold mb-2">Urban Air Quality Assistant</h1>
      <p className="mb-1 text-gray-700">
        Get a daily low-emission plan built on the latest air quality model
        estimate for your city.
      </p>
      <p className="mb-6 text-sm text-gray-500">
        Air data: CAMS model estimate via Open-Meteo (US EPA AQI scale). Sent
        to Google Gemini: your city, commute and activity choices, and current
        air data. The AI only picks and orders actions from a fixed US
        EPA/AirNow-sourced action library; all guidance text shown is
        pre-written and source-checked, not generated. Household health
        details are used only to add local guidance on our server and are
        never sent to the AI model. This app itself does not save what you
        enter (no account or database); requests are processed by the
        hosting and AI providers under their standard terms.
      </p>

      <form onSubmit={onSubmit} className="space-y-4" aria-label="Air quality plan form">
        <div>
          <label htmlFor="city" className="block font-medium mb-1">
            Your city
          </label>
          <input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
            className="w-full border rounded p-2"
            placeholder="e.g. Delhi"
          />
        </div>

        <div>
          <label htmlFor="commute" className="block font-medium mb-1">
            How do you usually commute?
          </label>
          <select
            id="commute"
            value={commute}
            onChange={(e) => setCommute(e.target.value)}
            className="w-full border rounded p-2"
          >
            <option value="walk">Walk</option>
            <option value="cycle">Cycle</option>
            <option value="two-wheeler">Two-wheeler</option>
            <option value="car">Car</option>
            <option value="public-transport">Public transport</option>
          </select>
        </div>

        <fieldset className="space-y-2">
          <legend className="font-medium">About your day</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={outdoorExercise}
              onChange={(e) => setOutdoorExercise(e.target.checked)}
            />
            I exercise outdoors
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sensitiveHousehold}
              onChange={(e) => setSensitiveHousehold(e.target.checked)}
            />
            Someone at home is sensitive (child, elderly, asthma or heart
            condition)
          </label>
        </fieldset>

        <div>
          <label htmlFor="ventilation" className="block font-medium mb-1">
            Home ventilation
          </label>
          <select
            id="ventilation"
            value={ventilation}
            onChange={(e) => setVentilation(e.target.value)}
            className="w-full border rounded p-2"
          >
            <option value="open-windows">Windows usually open</option>
            <option value="closed-ac">Closed with AC</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Building your plan..." : "Get my plan"}
        </button>
      </form>

      <div aria-live="polite">
        {error && (
          <p role="alert" className="mt-4 rounded bg-red-100 p-3 text-red-800">
            {error}
          </p>
        )}

        {result && (
          <section className="mt-8 space-y-6">
            <div className="rounded-lg border p-4 shadow-sm">
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <h2 className="text-xl font-bold">
                  {result.location.name}
                  {result.location.country
                    ? `, ${result.location.country}`
                    : ""}
                </h2>
                <span
                  className="rounded px-3 py-1 text-white font-semibold"
                  style={{ backgroundColor: result.category.color }}
                >
                  US AQI {result.aqi.usAqi} - {result.category.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                CAMS model estimate via Open-Meteo (US EPA AQI scale) - data
                time {result.aqi.time.replace("T", " ")}{" "}
                {fmtOffset(result.aqi.utcOffsetSeconds)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
                <Pollutant label="PM2.5" value={result.aqi.pm25} />
                <Pollutant label="PM10" value={result.aqi.pm10} />
                <Pollutant label="NO2" value={result.aqi.nitrogenDioxide} />
                <Pollutant label="Ozone" value={result.aqi.ozone} />
              </div>
              <p className="mt-3 text-sm">{result.category.advice}</p>
              {result.staleData && (
                <p className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-900">
                  This model estimate is over 90 minutes old or ahead of the
                  clock; treat it as stale and check again shortly before
                  acting on it.
                </p>
              )}
            </div>

            {result.forecast.length > 0 && (
              <div className="rounded-lg border p-4 shadow-sm">
                <h3 className="mb-1 font-semibold">
                  Hourly US AQI forecast (model)
                </h3>
                <p className="mb-2 text-xs text-gray-500">
                  {fmtDayTime(result.forecast[0].time)} to{" "}
                  {fmtDayTime(result.forecast[result.forecast.length - 1].time)}{" "}
                  {fmtOffset(result.aqi.utcOffsetSeconds)} - lowest{" "}
                  {Math.min(...result.forecast.map((h) => h.usAqi))}, highest{" "}
                  {Math.max(...result.forecast.map((h) => h.usAqi))}
                </p>
                <div className="flex items-end gap-1" role="img"
                  aria-label="Hourly AQI forecast bars">
                  {result.forecast.map((h, i) => (
                    <div key={h.time} className="flex flex-col items-center flex-1">
                      <div
                        title={`${fmtHour(h.time)}: AQI ${h.usAqi}`}
                        style={{
                          height: `${Math.max((h.usAqi / maxForecast) * 96, 4)}px`,
                          backgroundColor: aqiColor(h.usAqi),
                          width: "100%",
                          borderRadius: "2px",
                        }}
                      />
                      <span className="mt-1 text-[9px] text-gray-500 rotate-0">
                        {i % 3 === 0 ? fmtHour(h.time) : ""}
                      </span>
                    </div>
                  ))}
                </div>
                {result.window && (
                  <p className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-900">
                    Lowest-AQI 3-hour spell ahead (model):{" "}
                    {fmtDayTime(result.window.start)} to{" "}
                    {fmtDayTime(addOneHour(result.window.end))}, average AQI{" "}
                    {result.window.avgAqi} (
                    {categorizeLabel(result.window.avgAqi)}). This is the
                    relatively cleanest spell in the forecast, not a safe-air
                    guarantee - follow the category advice above.
                  </p>
                )}
              </div>
            )}

            <p className="text-sm text-gray-600">
              Plan selected and ordered by{" "}
              {result.plan.source === "gemini"
                ? "Google Gemini (GenAI)"
                : "built-in rules (AI unavailable)"}
              ; guidance text is pre-written from the cited US EPA/AirNow
              sources.
            </p>


            <PlanSection title="Low-emission routine for today" items={result.plan.routines} />
            <PlanSection title="Indoor air quality hacks" items={result.plan.indoorHacks} />
            <PlanSection title="Sustainable alternatives" items={result.plan.alternatives} />
            <PlanSection title="Why this matters" items={result.plan.impacts} />
          </section>
        )}
      </div>
    </main>
  );
}

// The window covers three hourly readings; display its exclusive end.
function addOneHour(isoLocal: string): string {
  const t = Date.parse(isoLocal + ":00Z");
  if (!Number.isFinite(t)) return isoLocal;
  return new Date(t + 3600_000).toISOString().slice(0, 16);
}

function categorizeLabel(aqi: number): string {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

function Pollutant({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-gray-100 p-2 text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold">
        {Number.isFinite(value) ? `${value} ug/m3` : "n/a"}
      </div>
    </div>
  );
}

function PlanSection({ title, items }: { title: string; items: PlanItem[] }) {
  const seen = new Set<string>();
  const sources = items
    .flatMap((i) => i.sources)
    .filter((s) => {
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });
  return (
    <section className="rounded-lg border p-4 shadow-sm">
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <ul className="list-disc space-y-1 pl-6">
        {items.map((item, i) => (
          <li key={item.id ?? i}>{item.text}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-gray-500">
        Sources:{" "}
        {sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && " · "}
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {s.label}
            </a>
          </span>
        ))}
      </p>
    </section>
  );
}
