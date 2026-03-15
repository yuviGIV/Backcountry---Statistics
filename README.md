# 🛡️ מערכת ניתוח היסטורי של התראות פיקוד העורף
### Israel Public Alert Historical Analytics Dashboard

> **Language note:** The user interface is entirely in Hebrew (RTL). This README, code comments, and configuration keys are in English.

---

## Overview

A production-style, single-page **historical analytics dashboard** for Israeli public alert (Tzeva Adom / Color Red) data sourced from Home Front Command (Pikud HaOref) related sources.

**This is a descriptive BI platform, not a prediction tool.** All analytics reflect past recorded events only.

### Pages

| Page | Hebrew | Description |
|------|--------|-------------|
| Dashboard | לוח בקרה ראשי | KPI cards, monthly trend, type distribution, heatmap, auto-insights |
| Operations | השוואת מבצעים | Side-by-side comparison of named military operations |
| Map | מפה אנליטית | Leaflet interactive map with clustering |
| Regional | ניתוח אזורי | Region and city drill-down with charts |
| Trends | מגמות היסטוריות | Time-series with moving average and anomaly detection |
| Risk Index | מדד סיכון היסטורי | Historical frequency metric with transparent formula |

---

## File Structure

```
├── index.html         — Single-page application shell (Hebrew RTL)
├── styles.css         — Dark-mode RTL responsive styles
├── config.js          — USER-MAINTAINED configuration
├── sample-data.json   — ~380 sample records in OREF format
├── data-service.js    — Data loading, normalization, caching
├── analytics.js       — Aggregations, risk index, insights
├── app.js             — UI controller, charts, map, navigation
└── README.md          — This file
```

---

## Quick Start (Local)

No build step required — pure HTML/CSS/JS.

```bash
# Option 1: Python
python3 -m http.server 8080
# then open http://localhost:8080

# Option 2: Node.js
npx serve .

# Option 3: VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

> **Note:** Opening `index.html` directly via `file://` will fail due to the `fetch()` call for `sample-data.json`. Always use a local HTTP server.

---

## Deploy to GitHub Pages

1. Push the project to a GitHub repository.
2. Go to **Settings → Pages → Source: Deploy from branch → main / root**.
3. Your dashboard will be live at `https://<username>.github.io/<repo>/`.

All files are static — no server required.

---

## Data Sources

### Mode 1 — Mock Data (default)

`config.js`:
```javascript
dataSource: 'mock',
mockDataPath: './sample-data.json',
```

`sample-data.json` contains ~380 representative records in the OREF alert format. The data is synthetic but structurally realistic, covering:
- Operation Guardian of the Walls (May 2021)
- Operation Breaking Dawn (August 2022)
- Operation Iron Swords (from October 7, 2023)
- Operation With Cubs / Iranian attack (April 2024)
- Northern Front alerts

### Mode 2 — Live OREF API

The Home Front Command exposes a public JSON endpoint for active alerts. The endpoint requires two specific HTTP headers and **does not** send CORS headers, so direct browser access from GitHub Pages will be blocked unless you route through a CORS proxy.

#### Correct endpoint & headers (verified)

```javascript
fetch("https://www.oref.org.il/WarningMessages/alert/Alerts.json", {
  headers: {
    "Accept":           "application/json",
    "X-Requested-With": "XMLHttpRequest"
  }
})
```

#### Enabling live mode in `config.js`

```javascript
dataSource: 'live',

// The correct endpoint — already set in config.js:
liveApiUrl: 'https://www.oref.org.il/WarningMessages/alert/Alerts.json',

liveApiHeaders: {
  'Accept':           'application/json',
  'X-Requested-With': 'XMLHttpRequest'
},

// Needed when deployed to GitHub Pages (CORS):
corsProxy: 'https://corsproxy.io/?',
// or: 'https://api.allorigins.win/raw?url='
// or deploy your own Cloudflare Worker / Netlify Function
```

When `corsProxy` is set, `data-service.js` automatically prepends it to the target URL:
```
https://corsproxy.io/?https%3A%2F%2Fwww.oref.org.il%2F...
```

Leave `corsProxy` empty when running locally — most browsers allow the request from `localhost` using the `X-Requested-With` header.

**Notes:**
- The `/alert/Alerts.json` endpoint returns **active / real-time** alerts only, not a full historical archive. For longer historical ranges, supplement with the mock data or your own data collection layer.
- The endpoint may return an empty body when there are no active alerts — `data-service.js` handles this gracefully.
- API format and availability may change; always verify the response structure.

---

## Editing Operations

Operations (named military/security events with date ranges) are configured in `config.js`:

```javascript
operations: [
  {
    id: 'iron_swords',
    label: 'חרבות ברזל',        // Hebrew display name
    shortLabel: 'חרבות ברזל',
    startDate: '2023-10-07',    // ISO YYYY-MM-DD
    endDate: null,              // null = ongoing
    color: '#e74c3c',
    description: '...'
  },
  // Add more operations here
]
```

**User-maintained note:** These dates are approximate and should be verified against official sources. The system matches records to operations by comparing each alert's timestamp to the configured date ranges.

---

## Historical Risk Index

The **מדד סיכון היסטורי** (Historical Risk Index) is a purely descriptive metric.

### Formula

```
riskIndex = (matchingAlerts / effectiveObservationSlots) × 100

where:
  matchingAlerts         = count of historical alerts matching (area, dateWindow, hourWindow, alertType)
  effectiveObservationSlots = observedDays × (hoursInWindow / 24)
```

### Example

- Area: אשקלון
- Hour window: 06:00–12:00
- Observed days in dataset: 365
- Matching alerts: 72

```
effectiveSlots = 365 × (6/24) = 91.25
riskIndex = (72 / 91.25) × 100 = 78.9%
```

This means: of all observed morning periods in Ashkelon, 78.9% contained at least one alert.

### Safety Disclaimer (displayed in UI)

> **מדד זה מבוסס על נתוני עבר בלבד ואינו מהווה תחזית או כלי לקבלת החלטות בזמן אמת.**

This warning is hard-coded and always displayed. The application does not model future risk.

---

## Extending the Dashboard

### Add a new operation
Edit the `operations` array in `config.js`.

### Add a new region
Edit the `regions` array in `config.js`, then add matching city entries to `CITY_META` in `data-service.js`.

### Add a new alert type
Edit the `alertTypes` array in `config.js`, specifying OREF `cat` code(s).

### Connect real data
Update `dataSource` in `config.js` and point to a CORS-enabled data endpoint. Ensure the raw format matches the normalization logic in `data-service.js → _normalizeRecord()`.

### Add a new page
1. Add an `<a class="nav-link">` in `index.html` sidebar.
2. Add a `<section id="page-{name}">` in the main content area.
3. Add a `case '{name}':` in `app.js → renderPage()`.
4. Implement a `renderMyPage(records)` function in `app.js`.

---

## Technology Stack

| Library | Version | Purpose |
|---------|---------|---------|
| Leaflet | 1.9.4 | Interactive map |
| Leaflet.markercluster | 1.5.3 | Map clustering |
| Chart.js | 4.4.4 | All charts |
| Heebo (Google Fonts) | — | Hebrew typography |
| Pure HTML/CSS/JS | — | Everything else |

No framework, no bundler, no build step.

---

## Limitations

- **Sample data only:** The bundled `sample-data.json` is synthetic and representative, not a complete historical record.
- **Coordinates:** City coordinates are approximate centroid values. Actual alert sub-areas within cities are not mapped individually.
- **Live API:** The OREF API requires a CORS proxy for browser-based access. The proxy must handle rate limiting and availability.
- **Operation dates:** Configured manually. Dates in `config.js` are user-maintained and may require updating.
- **No real-time alerts:** This system is historical analysis only and does not connect to live alert streams.
- **Hebrew insights:** Auto-generated insights use rule-based templates. They describe statistics, not operational conclusions.

---

## Safety & Ethical Notes

1. This dashboard is an educational and analytical tool.
2. It must **not** be used to guide decisions about personal safety during actual emergencies.
3. For real-time alerts, use the official Pikud HaOref app or approved channels.
4. The risk index is a historical statistic, not a probability model.
5. No claims about future attack likelihood should be derived from this data.

---

## License

MIT — provided for educational and analytical purposes. Use responsibly.
