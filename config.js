/**
 * config.js
 * Central configuration for the Israel Historical Alerts Dashboard.
 * Edit this file to update operation date ranges, labels, colors, and API settings.
 * All dates in YYYY-MM-DD format. Set endDate to null for ongoing operations.
 *
 * ⚠️  USER-MAINTAINED: Operation dates below are community-maintained estimates.
 *      Verify against official sources before use.
 */

const APP_CONFIG = {

  // ─── DATA SOURCE ─────────────────────────────────────────────────────────
  // 'mock'  → loads sample-data.json (works offline, GitHub Pages safe)
  // 'live'  → attempts fetch from liveApiUrl, falls back to mock on failure
  dataMode: 'live',

  liveApiUrl: 'https://www.oref.org.il/api/alerts/history',
  sampleDataPath: './sample-data.json',

  // ─── OPERATIONS ──────────────────────────────────────────────────────────
  // ⚠️  USER-MAINTAINED DATES — verify against official sources
  operations: [
    {
      id: 'iron_swords',
      label: 'חרבות ברזל',
      labelEn: 'Operation Iron Swords',
      startDate: '2023-10-07',
      endDate: null,                    // null = ongoing
      color: '#e05252',
      bgColor: 'rgba(224,82,82,0.15)',
      description: 'מלחמת חרבות ברזל, פרצה ב-7 באוקטובר 2023',
    },
    {
      id: 'am_calvai',
      label: 'עם כלביא',
      labelEn: 'Operation Am Calvai',
      startDate: '2024-08-07',
      endDate: '2024-09-26',
      color: '#f0a500',
      bgColor: 'rgba(240,165,0,0.15)',
      description: 'מבצע עם כלביא, אוגוסט–ספטמבר 2024',
    },
    {
      id: 'north_arrows',
      label: 'חיצי הצפון',
      labelEn: 'Northern Arrows',
      startDate: '2023-10-08',
      endDate: '2024-03-31',
      color: '#4a90d9',
      bgColor: 'rgba(74,144,217,0.15)',
      description: 'עימות בחזית הצפון, לבנון 2023–2024',
    },
  ],

  // ─── ALERT TYPES ─────────────────────────────────────────────────────────
  alertTypes: [
    { id: 'rockets',      label: 'ירי רקטות וטילים',    color: '#e05252', icon: '🚀' },
    { id: 'uav',          label: 'חדירת כלי טיס עוין',  color: '#e87d2b', icon: '✈️'  },
    { id: 'infiltration', label: 'חדירת מחבלים',         color: '#9b59b6', icon: '⚠️'  },
    { id: 'hazmat',       label: 'חומרים מסוכנים',       color: '#1abc9c', icon: '☣️'  },
    { id: 'tsunami',      label: 'צונאמי',               color: '#3498db', icon: '🌊'  },
    { id: 'earthquake',   label: 'רעידת אדמה',           color: '#95a5a6', icon: '🏚️'  },
  ],

  // ─── REGIONS ─────────────────────────────────────────────────────────────
  regions: [
    { id: 'דרום',     label: 'דרום',     color: '#e05252' },
    { id: 'צפון',     label: 'צפון',     color: '#4a90d9' },
    { id: 'מרכז',     label: 'מרכז',     color: '#2ecc71' },
    { id: 'ירושלים',  label: 'ירושלים',  color: '#f0a500' },
  ],

  // ─── MAP ─────────────────────────────────────────────────────────────────
  mapCenter: [31.5, 34.9],
  mapZoom: 7,
  mapMinZoom: 6,
  mapMaxZoom: 16,

  // ─── ANALYTICS ───────────────────────────────────────────────────────────
  movingAverageWindow: 7,          // days for trend smoothing
  anomalyMultiplier: 2.5,          // std dev multiplier for spike detection
  topNItems: 8,                    // items shown in top-N lists

  // ─── SAFETY DISCLAIMER ───────────────────────────────────────────────────
  riskIndexTitle: 'מדד סיכון היסטורי',
  riskIndexDisclaimer:
    'מדד זה מבוסס על נתוני עבר בלבד ואינו מהווה תחזית ' +
    'או כלי לקבלת החלטות בזמן אמת.',

  // ─── THEME COLORS ────────────────────────────────────────────────────────
  colors: {
    primary:         '#4a90d9',
    secondary:       '#e05252',
    accent:          '#f0a500',
    success:         '#2ecc71',
    warning:         '#f0a500',
    danger:          '#e05252',
    bg:              '#0b0d14',
    surface:         '#12151f',
    surfaceElevated: '#1a1e2e',
    surfaceHover:    '#232840',
    border:          '#252a40',
    borderLight:     '#2e3450',
    text:            '#dde1f0',
    textMuted:       '#7a80a0',
    textDim:         '#4a506a',
    chartGrid:       'rgba(255,255,255,0.05)',
  },

};
