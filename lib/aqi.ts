export interface CityGeo {
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
}

export interface AqiReading {
  usAqi: number;
  pm25: number;
  pm10: number;
  nitrogenDioxide: number;
  ozone: number;
  time: string;
  utcOffsetSeconds: number;
}

export interface HourlyAqi {
  time: string;
  usAqi: number;
}

export interface OutdoorWindow {
  start: string;
  end: string;
  avgAqi: number;
}

export interface AqiCategory {
  band: string;
  label: string;
  color: string;
  advice: string;
}

export function categorizeUsAqi(aqi: number): AqiCategory {
  if (aqi <= 50) {
    return {
      band: "good",
      label: "Good",
      color: "#00a651",
      advice: "Air quality is satisfactory per the US EPA scale. Outdoor activity is fine for everyone.",
    };
  }
  if (aqi <= 100) {
    return {
      band: "moderate",
      label: "Moderate",
      color: "#b7950b",
      advice: "Acceptable per the US EPA scale. Unusually sensitive people should watch for symptoms.",
    };
  }
  if (aqi <= 150) {
    return {
      band: "usg",
      label: "Unhealthy for Sensitive Groups",
      color: "#e67e22",
      advice: "Per the US EPA scale, sensitive groups should reduce prolonged or heavy outdoor exertion.",
    };
  }
  if (aqi <= 200) {
    return {
      band: "unhealthy",
      label: "Unhealthy",
      color: "#c0392b",
      advice: "Per the US EPA scale, everyone should reduce prolonged or heavy outdoor exertion; sensitive groups should avoid it.",
    };
  }
  if (aqi <= 300) {
    return {
      band: "very-unhealthy",
      label: "Very Unhealthy",
      color: "#8e44ad",
      advice: "Per the US EPA scale, avoid outdoor exertion. Keep windows closed and filter indoor air if possible.",
    };
  }
  return {
    band: "hazardous",
    label: "Hazardous",
    color: "#7e0023",
    advice: "Per the US EPA scale, stay indoors with windows closed and follow local health advisories.",
  };
}

export async function geocodeCity(city: string): Promise<CityGeo | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    city
  )}&count=1&language=en&format=json`;
  const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = await res.json();
  const hit = data?.results?.[0];
  if (!hit) return null;
  return {
    name: hit.name,
    country: hit.country,
    latitude: hit.latitude,
    longitude: hit.longitude,
  };
}

export async function fetchAirQuality(
  latitude: number,
  longitude: number
): Promise<AqiReading | null> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone&timezone=auto`;
  const res = await fetch(url, { next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = await res.json();
  const c = data?.current;
  if (!c || typeof c.us_aqi !== "number") return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
  return {
    usAqi: Math.round(c.us_aqi),
    pm25: num(c.pm2_5),
    pm10: num(c.pm10),
    nitrogenDioxide: num(c.nitrogen_dioxide),
    ozone: num(c.ozone),
    time: c.time,
    utcOffsetSeconds:
      typeof data?.utc_offset_seconds === "number"
        ? data.utc_offset_seconds
        : 0,
  };
}

export async function fetchHourlyAqi(
  latitude: number,
  longitude: number
): Promise<HourlyAqi[]> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&hourly=us_aqi&forecast_days=2&timezone=auto`;
  const res = await fetch(url, { next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = await res.json();
  const times: string[] = data?.hourly?.time ?? [];
  const values: (number | null)[] = data?.hourly?.us_aqi ?? [];
  return times
    .map((time, i) => ({ time, usAqi: Math.round(values[i] ?? NaN) }))
    .filter((h) => Number.isFinite(h.usAqi));
}

// Lowest-AQI 3-hour window in the next 24 forecast hours, starting from
// `fromTime` (same ISO-local format the API returns). Data-driven: it never
// assumes a clock time is cleaner, it reads the model forecast.
export function bestOutdoorWindow(
  hours: HourlyAqi[],
  fromTime: string
): OutdoorWindow | null {
  const startIdx = hours.findIndex((h) => h.time >= fromTime);
  const future =
    startIdx >= 0 ? hours.slice(startIdx, startIdx + 24) : hours.slice(0, 24);
  if (future.length < 3) return null;
  let best: OutdoorWindow = {
    start: future[0].time,
    end: future[2].time,
    avgAqi: Infinity,
  };
  for (let i = 0; i + 2 < future.length; i++) {
    const avg = (future[i].usAqi + future[i + 1].usAqi + future[i + 2].usAqi) / 3;
    if (avg < best.avgAqi) {
      best = { start: future[i].time, end: future[i + 2].time, avgAqi: avg };
    }
  }
  return { ...best, avgAqi: Math.round(best.avgAqi) };
}

// Age in minutes of a model reading ("YYYY-MM-DDTHH:mm" local) relative to
// the caller's clock shifted into the same local time. Negative means the
// reading claims to be in the future (clock skew or bad data).
export function readingAgeMinutes(nowLocal: string, readingTime: string): number {
  const fmt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (!fmt.test(nowLocal) || !fmt.test(readingTime)) return 0;
  const now = Date.parse(nowLocal + ":00Z");
  const then = Date.parse(readingTime + ":00Z");
  if (!Number.isFinite(now) || !Number.isFinite(then)) return 0;
  return Math.round((now - then) / 60000);
}
