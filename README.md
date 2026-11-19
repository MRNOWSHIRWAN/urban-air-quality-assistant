# Urban Air Quality Assistant

PromptWars Virtual - Challenge 06 submission.

A GenAI-powered assistant that helps families and communities navigate severe
winter smog and urban air pollution. It suggests low-emission daily routines,
indoor air quality hacks, and sustainable alternatives tailored to the user's
location and lifestyle, and explains the direct impact of each choice.

## How it works

1. The user enters their city, commute mode, outdoor exercise habit, household
   sensitivity, and home ventilation style.
2. The app geocodes the city (Open-Meteo Geocoding API) and fetches the current
   US AQI, PM2.5, PM10, NO2 and ozone plus a 24 h hourly AQI forecast
   (Open-Meteo Air Quality API). Values are CAMS model estimates on the US EPA
   AQI scale, shown with the model data time - not personal measurements.
3. Google Gemini (`gemini-3.5-flash-lite`) only selects and orders action IDs
   from a validated, source-backed action library (`lib/actions.ts`), using the
   same future-only forecast shown in the UI. Every health or protection
   sentence shown to the user is the library's fixed, source-checked template
   text - the AI never writes medical or protection advice, and there is no
   free-text AI output. Unknown or misplaced IDs and malformed responses are
   rejected (extra keys ignored) and the deterministic default plan is shown
   instead.
4. Activity/AQI compatibility is enforced deterministically: for example, a
   "walk short trips" action can never appear at Unhealthy or worse AQI, and
   N95 respirator advice always appears with the clarification that
   respirators filter particles, not gases such as ozone.
5. Household health details (the "sensitive household" option) are applied
   locally and are never sent to the AI model. Nothing the user enters is
   stored anywhere.
6. The forecast is filtered by the actual clock in the location's timezone,
   so stale responses can never present past hours as upcoming, and the
   current reading is flagged when it is more than 90 minutes old.
7. If the AI call fails, a deterministic rules-based plan is shown and the UI
   says so.

## Gen AI usage

- Google Gemini (`gemini-3.5-flash-lite`) via the Generative Language API,
  called server-side in `app/api/plan/route.ts` with the prompt built in
  `lib/recommendations.ts`. The API key is read from the `GEMINI_API_KEY`
  environment variable and is never exposed to the browser.

## Data sources

- Air quality and hourly forecast: Open-Meteo Air Quality API (CAMS model
  estimate, US AQI scale).
- Geocoding: Open-Meteo Geocoding API.
- No API key is required for either Open-Meteo endpoint.

## Health and guidance sources

Every action in the library carries its own supporting source, shown under
each plan section in the UI:

- AQI categories and activity/exertion guidance: US EPA AirNow, "AQI Basics" -
  https://www.airnow.gov/aqi/aqi-basics/
- N95/P100 respirators filter particles only, not gases or vapors: US EPA
  AirNow, "Wildfire Smoke: A Guide for Public Health Officials" -
  https://www.airnow.gov/sites/default/files/2021-09/wildfire-smoke-guide-chapters-1-3.pdf
- Staying indoors, closing windows, and choosing an N95 during smoke: US EPA
  AirNow, "When Smoke is in the Air" -
  https://www.airnow.gov/wildfires/when-smoke-is-in-the-air/
- Reducing outdoor time and exertion on high-ozone days: US EPA AirNow,
  "Air Quality Guide for Ozone" - https://document.airnow.gov/air-quality-guide-for-ozone.pdf
- HEPA portable air cleaners and sizing (CADR): US EPA, "Guide to Air Cleaners
  in the Home" - https://www.epa.gov/indoor-air-quality-iaq/guide-air-cleaners-home
- HEPA filtration efficiency (99.97% of 0.3-micron particles): US EPA,
  "What is a HEPA filter?" - https://www.epa.gov/indoor-air-quality-iaq/what-hepa-filter
- Source control and ventilation indoors: US EPA, "Improving Indoor Air
  Quality" - https://www.epa.gov/indoor-air-quality-iaq/improving-indoor-air-quality
- Devices that generate ozone are not air cleaners: US EPA, "Ozone Generators
  that are Sold as Air Cleaners" -
  https://www.epa.gov/indoor-air-quality-iaq/ozone-generators-are-sold-air-cleaners
- Vehicle emissions and lower-emission travel: US EPA, "Transportation, Air
  Pollution and Climate Change" -
  https://www.epa.gov/transportation-air-pollution-and-climate-change
- Combining trips and avoiding idling: US DOE/EPA FuelEconomy.gov, "Driving
  More Efficiently" - https://www.fueleconomy.gov/feg/driveHabits.jsp

The AI produces no free text at all: its output is strictly four arrays of
action IDs. Unknown or misplaced IDs and malformed responses cause a full
fallback to the deterministic plan; extra keys are ignored. The
"lowest-AQI hours" window is relative to the forecast only and carries
the current AQI category warning; it never implies outdoor safety.

## Tech

- Next.js (App Router) + TypeScript + Tailwind CSS
- Vitest unit tests (32) covering AQI categorization, the action library and
  AI-selection validation, deterministic activity/AQI compatibility (including
  impact text), stale/future bounds on forecast and current readings, the
  rate limiter, prompt constraints, and route-level input sanitization
- The API route enforces input validation, an 8 s timeout on upstream fetches
  (10 s on Gemini, which also runs at low temperature with a capped output
  length), and a per-IP rate limit (10 requests/minute). On serverless hosting
  the limiter applies per instance, not globally - it is abuse mitigation,
  not a spending or billing control.

## Run locally

```bash
npm install
GEMINI_API_KEY=your_key npm run dev
```

## Test

```bash
npm run test
```

## Deploy

Any Node/Vercel host. Set `GEMINI_API_KEY` in the environment.

Live demo: hosted on Vercel (free tier). Air data: CAMS model estimates via
the Open-Meteo Air Quality API on the US EPA AQI scale - model estimates, not
personal measurements. AI: Google Gemini (free tier) called server-side; it
only selects action IDs from a pre-written, source-checked action library and
produces no free-text advice. Household health details stay on the server and
are never sent to the AI model; the app stores nothing users enter. Rate
limiting is per serverless instance (abuse mitigation, not a spending cap).
