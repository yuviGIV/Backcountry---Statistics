/**
 * config.js — Application configuration
 * USER-MAINTAINED: Operation date ranges, labels, alert types, and regions
 * are intended to be edited directly in this file.
 *
 * All labels visible to the user are in Hebrew.
 * Code keys, IDs, and comments remain in English.
 */

const CONFIG = {

  // ─── DATA SOURCE ─────────────────────────────────────────────────────────
  // Set to 'mock'  → use sample-data.json (works offline / GitHub Pages).
  // Set to 'live'  → fetch from OREF API directly (requires same-origin or
  //                  a CORS proxy, because oref.org.il does not send CORS headers).
  dataSource: 'mock',

  // ── Correct OREF endpoint (verified working) ──
  // Active / recent alerts (real-time, updates frequently):
  liveApiUrl: 'https://www.oref.org.il/WarningMessages/alert/Alerts.json',

  // Required request headers for the OREF API:
  liveApiHeaders: {
    'Accept':           'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  },

  // ── CORS proxy (needed when running from GitHub Pages or any cross-origin host) ──
  // Uncomment and set corsProxy to route the request through a proxy.
  // Example:  'https://corsproxy.io/?'
  //           'https://api.allorigins.win/raw?url='
  corsProxy: '',   // leave empty to call the API directly (works from localhost)

  // Path to local mock data file (relative to index.html)
  mockDataPath: './sample-data.json',


  // ─── OPERATIONS ──────────────────────────────────────────────────────────
  // Edit startDate / endDate (ISO format YYYY-MM-DD) and labels here.
  // Set endDate to null for ongoing operations.
  // USER-MAINTAINED — dates and labels are approximate and should be verified.
  operations: [
    {
      id: 'iron_swords',
      label: 'חרבות ברזל',
      shortLabel: 'חרבות ברזל',
      startDate: '2023-10-07',
      endDate: null,           // ongoing — set to a date string when concluded
      color: '#e74c3c',
      description: 'מלחמת חרבות ברזל — החל מ-7 באוקטובר 2023'
    },
    {
      id: 'lion_cubs',
      label: 'עם כלביא',
      shortLabel: 'עם כלביא',
      startDate: '2024-04-13',
      endDate: '2024-04-14',
      color: '#f39c12',
      description: 'מבצע עם כלביא — תקיפת טילים ומל"טים איראניים, 13–14 באפריל 2024'
    },
    {
      id: 'arrows_north',
      label: 'חיצי הצפון',
      shortLabel: 'חיצי הצפון',
      startDate: '2023-10-08',
      endDate: null,           // ongoing — northern front
      color: '#3498db',
      description: 'מבצע חיצי הצפון — חזית הצפון מול חיזבאללה'
    },
    {
      id: 'guardian_walls',
      label: 'שומר החומות',
      shortLabel: 'שומר החומות',
      startDate: '2021-05-10',
      endDate: '2021-05-21',
      color: '#9b59b6',
      description: 'מבצע שומר החומות — מאי 2021'
    },
    {
      id: 'breaking_dawn',
      label: 'עלות השחר',
      shortLabel: 'עלות השחר',
      startDate: '2022-08-05',
      endDate: '2022-08-07',
      color: '#1abc9c',
      description: 'מבצע עלות השחר — אוגוסט 2022'
    }
  ],


  // ─── ALERT TYPES ─────────────────────────────────────────────────────────
  // Maps OREF category codes to display labels and visual properties.
  alertTypes: [
    { id: 'rockets',       catCodes: [1],      label: 'ירי רקטות וטילים',  color: '#e74c3c', icon: '🚀' },
    { id: 'infiltration',  catCodes: [2],      label: 'חדירת מחבלים',      color: '#e67e22', icon: '⚠️'  },
    { id: 'earthquake',    catCodes: [3],      label: 'רעידת אדמה',         color: '#7f8c8d', icon: '🌍' },
    { id: 'tsunami',       catCodes: [4],      label: 'צונאמי',              color: '#1abc9c', icon: '🌊' },
    { id: 'radiological',  catCodes: [5],      label: 'סכנה רדיולוגית',     color: '#8e44ad', icon: '☢️'  },
    { id: 'hazmat',        catCodes: [6],      label: 'חומרים מסוכנים',     color: '#27ae60', icon: '☣️'  },
    { id: 'uav',           catCodes: [7, 13],  label: 'כטב"מ',               color: '#f39c12', icon: '🛸' },
    { id: 'general',       catCodes: [0, 99],  label: 'כללי',                color: '#95a5a6', icon: '📢' }
  ],


  // ─── REGIONS ─────────────────────────────────────────────────────────────
  regions: [
    { id: 'north',         label: 'צפון',            color: '#3498db' },
    { id: 'haifa',         label: 'חיפה והכרמל',      color: '#2980b9' },
    { id: 'sharon',        label: 'שרון',             color: '#27ae60' },
    { id: 'dan',           label: 'גוש דן',           color: '#f39c12' },
    { id: 'jerusalem',     label: 'ירושלים',          color: '#e74c3c' },
    { id: 'south',         label: 'דרום',             color: '#e67e22' },
    { id: 'gaza_envelope', label: 'עוטף עזה',         color: '#c0392b' },
    { id: 'west_bank',     label: 'יהודה ושומרון',   color: '#9b59b6' }
  ],


  // ─── MAP ─────────────────────────────────────────────────────────────────
  map: {
    center: [31.5, 34.9],
    zoom: 8,
    minZoom: 6,
    maxZoom: 16,
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    tileDark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attributionDark: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'
  },


  // ─── RISK INDEX ──────────────────────────────────────────────────────────
  riskIndex: {
    // Minimum number of matching records for full confidence
    minDataForConfidence: 30,
    // Below this threshold, show sparse-data warning
    sparseDataThreshold: 10,
    // Warning text displayed alongside the index (legal/safety requirement)
    disclaimer: 'מדד זה מבוסס על נתוני עבר בלבד ואינו מהווה תחזית או כלי לקבלת החלטות בזמן אמת.'
  },


  // ─── UI ──────────────────────────────────────────────────────────────────
  ui: {
    defaultPage: 'dashboard',
    animationsEnabled: true,
    defaultDateRangeMonths: 12,
    itemsPerPage: 20
  }
};

// Freeze top-level to prevent accidental mutation at runtime
Object.freeze(CONFIG);
