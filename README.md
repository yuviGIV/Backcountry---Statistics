# 🛡️ ניתוח היסטורי — נתוני התרעות פיקוד העורף
## Israel Historical Alert Analytics Dashboard

A production-style Hebrew RTL web dashboard for **descriptive historical analysis** of public alert/siren data from Home Front Command-related sources.

---

## ⚠️ Safety & Disclaimer

> **This tool is strictly for historical descriptive analysis.**  
> The "Historical Risk Index" (`מדד סיכון היסטורי`) computes the **historical frequency** of alert events in past records only.  
> **It does not forecast, predict, or indicate operational threat levels.**  
> It must never be used for real-time decision-making or emergency preparedness planning.
>
> מדד זה מבוסס על נתוני עבר בלבד ואינו מהווה תחזית או כלי לקבלת החלטות בזמן אמת.

---

## 📁 File Tree

```
israel-alerts-dashboard/
├── index.html          ← Application shell (RTL Hebrew, single-page)
├── styles.css          ← Dark RTL theme, responsive layout
├── config.js           ← Operations config, alert types, colors  ← EDIT THIS
├── data-service.js     ← Data adapter (live API / mock JSON)
├── analytics.js        ← Statistical engine (KPIs, trends, risk index)
├── app.js              ← Main controller, routing, chart rendering
├── sample-data.json    ← 550 synthetic demo records
└── README.md           ← This file
```

---

## 🚀 Setup & Running

### Option A — GitHub Pages (Recommended)

1. Fork / push this folder to a GitHub repository.
2. Go to **Settings → Pages → Source** → select `main` branch, `/ (root)`.
3. Your dashboard will be live at `https://<username>.github.io/<repo-name>/`.

No build tools, no bundler, no server required.

### Option B — Local Development Server

Because `fetch()` is used to load `sample-data.json`, you need an HTTP server locally (browsers block `fetch` on `file://` URLs).

```bash
# Python 3
cd israel-alerts-dashboard
python3 -m http.server 8000
# Open http://localhost:8000

# Node.js (npx)
npx serve .
```

---

## 🔌 Live API vs. Mock Data

### Mock Mode (default)
```javascript
// config.js
dataMode: 'mock',
sampleDataPath: './sample-data.json',
```
Loads the included 550-record synthetic dataset. Safe for demos and development.

### Live Mode
```javascript
dataMode: 'live',
liveApiUrl: 'https://www.oref.org.il/api/alerts/history',
```
Attempts to fetch from the configured URL. On failure, **automatically falls back to mock data**.

#### Live API Notes
- The Home Front Command (pikud-haoref) public API endpoint may require CORS handling, authentication tokens, or specific parameters — verify the current API contract before enabling.
- The `_normalizeOne()` function in `data-service.js` accepts multiple field-name variants to handle API schema changes gracefully.
- If the live API uses pagination, extend `_fetchLive()` in `data-service.js`.

---

## ✏️ Editing Operation Ranges

Operation date ranges and labels are **user-maintained** in `config.js`.

```javascript
// config.js → operations array
{
  id: 'iron_swords',
  label: 'חרבות ברזל',          // Hebrew display name
  startDate: '2023-10-07',      // ISO date YYYY-MM-DD
  endDate: null,                // null = ongoing
  color: '#e05252',             // chart/badge color
  bgColor: 'rgba(224,82,82,0.15)',
  description: '...',
},
```

To add a new operation, append an object to the `operations` array and assign an `operationId` field in any records you import.

---

## 📊 Dashboard Pages

| Page | Hebrew | Description |
|------|--------|-------------|
| Overview | סקירה כללית | KPIs, trends, heatmap, insights |
| Operations | השוואת מבצעים | Side-by-side operation comparison |
| Map | ניתוח מפה | Interactive Leaflet map with clusters |
| Regional | ניתוח אזורי | Area rankings, distributions |
| Trends | מגמות היסטוריות | Daily/weekly series, anomaly detection |
| Risk Index | מדד סיכון היסטורי | Historical frequency metric (descriptive only) |

---

## 🗂️ Data Schema

Records in `sample-data.json` (and normalized from any source) follow:

```json
{
  "id":          "alert_00001",
  "timestamp":   "2023-10-07T17:31:01",
  "area":        "עוטף עזה",
  "city":        "שדרות",
  "region":      "דרום",
  "alertType":   "ירי רקטות וטילים",
  "operationId": "iron_swords",
  "lat":         31.5242,
  "lng":         34.5966
}
```

Supported `alertType` values (configurable in `config.js`):
- ירי רקטות וטילים
- חדירת כלי טיס עוין
- חדירת מחבלים
- חומרים מסוכנים
- צונאמי
- רעידת אדמה

---

## 🧮 Historical Risk Index — Methodology

**Formula:** `Days with ≥1 matching alert ÷ Total days in range × 100`

**Inputs:** area, date range, hour range (optional), alert type (optional)

**Confidence levels:**
- 🟢 High — ≥50 matching events
- 🟡 Medium — 10–49 events  
- 🔴 Low — <10 events (sparse data warning shown)

**What it is NOT:** A probability model, threat assessment, predictive tool, or real-time indicator.

---

## 🛠️ Technical Stack

| Concern | Technology |
|---------|-----------|
| UI Framework | Vanilla HTML/CSS/JS |
| Charts | Chart.js 4.4 |
| Maps | Leaflet 1.9 + MarkerCluster |
| Fonts | Google Fonts — Heebo (Hebrew) |
| Tile Layer | CARTO Dark Matter |
| Data | Static JSON / fetch API |

No build step. No bundler. No npm required.

---

## 🔧 Extension Ideas

- **Real-time polling**: Add a `setInterval` in `app.js` that calls `svc.load(forceRefresh=true)` every N minutes.
- **Export**: Add a CSV/JSON export button using `Blob` + `URL.createObjectURL`.
- **URL state**: Serialize filters to `window.location.hash` for shareable filter links.
- **Date picker**: Replace `<input type="date">` with a Hebrew-aware calendar widget.
- **Offline PWA**: Add a Service Worker to cache assets for offline use.
- **More alert types**: Extend `config.js → alertTypes` array.
- **City-level drill-down**: Click a row in the regional table to filter the entire dashboard to that city.

---

## ⚖️ Limitations

1. **Sample data is synthetic** — generated for demonstration purposes only. It does not represent any real operational data.
2. **No real-time capability** — the dashboard shows only historical records.
3. **API subject to change** — the Home Front Command API endpoint and schema may change without notice.
4. **Operation dates are estimates** — maintained manually in `config.js`; verify against official sources.
5. **Risk Index is not predictive** — see Safety & Disclaimer above.

---

## 📄 License

For research and educational use. Not for commercial or operational use without explicit authorization.  
Tile data © OpenStreetMap contributors, © CARTO.
