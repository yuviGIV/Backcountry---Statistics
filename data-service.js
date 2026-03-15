/**
 * data-service.js — Data adapter layer
 *
 * Responsibilities:
 *  1. Load alert data from mock JSON or live OREF API
 *  2. Normalize raw records into a unified internal schema
 *  3. Cache normalized data in memory
 *  4. Provide filtered views for analytics modules
 *
 * Internal (normalized) record schema:
 * {
 *   id:             string   — unique alert identifier
 *   timestamp:      Date     — parsed JS Date object
 *   isoDate:        string   — YYYY-MM-DD
 *   year:           number
 *   month:          number   — 1–12
 *   day:            number   — 1–31
 *   hour:           number   — 0–23
 *   weekday:        number   — 0 (Sun) – 6 (Sat)
 *   alertTypeId:    string   — normalized type key (e.g. 'rockets')
 *   alertTypeLabel: string   — Hebrew display label
 *   category:       number   — raw OREF category code
 *   area:           string   — raw area/city text from OREF
 *   city:           string   — cleaned city name
 *   region:         string   — region id (e.g. 'south')
 *   lat:            number
 *   lon:            number
 *   operationId:    string | null — matched operation id from config
 * }
 */

const DataService = (() => {

  // ─── Internal state ─────────────────────────────────────────────────────
  let _rawRecords    = [];
  let _normalized    = [];
  let _loadStatus    = 'idle'; // 'idle' | 'loading' | 'ready' | 'error'
  let _loadError     = null;
  let _listeners     = [];

  // ─── City → region / coordinate lookup ──────────────────────────────────
  // Used when the raw record doesn't carry pre-tagged _region / _lat / _lon fields.
  const CITY_META = {
    'אשקלון':          { region: 'south',         lat: 31.6700, lon: 34.5711 },
    'אשדוד':           { region: 'south',         lat: 31.8014, lon: 34.6552 },
    'שדרות':           { region: 'gaza_envelope', lat: 31.5240, lon: 34.5966 },
    'נתיבות':          { region: 'gaza_envelope', lat: 31.4197, lon: 34.5905 },
    'באר שבע':         { region: 'south',         lat: 31.2524, lon: 34.7915 },
    'ניר עם':          { region: 'gaza_envelope', lat: 31.4483, lon: 34.5592 },
    'כפר עזה':         { region: 'gaza_envelope', lat: 31.3667, lon: 34.5167 },
    'בארי':            { region: 'gaza_envelope', lat: 31.3906, lon: 34.5231 },
    'ספיר':            { region: 'gaza_envelope', lat: 31.3083, lon: 34.4917 },
    'רעים':            { region: 'gaza_envelope', lat: 31.3333, lon: 34.5000 },
    'אופקים':          { region: 'south',         lat: 31.3139, lon: 34.6192 },
    'ניר אוז':         { region: 'gaza_envelope', lat: 31.3542, lon: 34.4892 },
    'קריית גת':        { region: 'south',         lat: 31.6100, lon: 34.7640 },
    'קריית מלאכי':     { region: 'south',         lat: 31.7316, lon: 34.7374 },
    'תל אביב':         { region: 'dan',           lat: 32.0853, lon: 34.7818 },
    'ראשון לציון':     { region: 'dan',           lat: 31.9730, lon: 34.7894 },
    'חולון':           { region: 'dan',           lat: 32.0167, lon: 34.7667 },
    'בת ים':           { region: 'dan',           lat: 32.0167, lon: 34.7500 },
    'גבעתיים':         { region: 'dan',           lat: 32.0658, lon: 34.8108 },
    'רמת גן':          { region: 'dan',           lat: 32.0686, lon: 34.8238 },
    'פתח תקווה':       { region: 'dan',           lat: 32.0840, lon: 34.8878 },
    'ירושלים':         { region: 'jerusalem',     lat: 31.7683, lon: 35.2137 },
    'חיפה':            { region: 'haifa',         lat: 32.7940, lon: 34.9896 },
    'קריית שמונה':     { region: 'north',         lat: 33.2069, lon: 35.5701 },
    'נהריה':           { region: 'north',         lat: 33.0048, lon: 35.0949 },
    'עכו':             { region: 'north',         lat: 32.9281, lon: 35.0818 },
    'שלומי':           { region: 'north',         lat: 33.0819, lon: 35.1450 },
    'מטולה':           { region: 'north',         lat: 33.2722, lon: 35.5625 },
    'כרמיאל':          { region: 'north',         lat: 32.9181, lon: 35.2964 },
    'צפת':             { region: 'north',         lat: 32.9646, lon: 35.4950 },
    'ראש פינה':        { region: 'north',         lat: 32.9717, lon: 35.5404 },
    'חצור הגלילית':   { region: 'north',         lat: 33.0175, lon: 35.5544 },
    'מעלות-תרשיחא':   { region: 'north',         lat: 33.0169, lon: 35.2722 },
    'נצרת עילית':      { region: 'north',         lat: 32.7069, lon: 35.3322 },
    'יסוד המעלה':      { region: 'north',         lat: 33.0667, lon: 35.5969 },
    'כפר יובל':        { region: 'north',         lat: 33.2272, lon: 35.6261 },
    'דפנה':            { region: 'north',         lat: 33.2353, lon: 35.6581 },
    'שניר':            { region: 'north',         lat: 33.2319, lon: 35.6292 },
    'אביבים':          { region: 'north',         lat: 33.1142, lon: 35.4578 },
    'ברעם':            { region: 'north',         lat: 33.0894, lon: 35.4100 },
    'נחף':             { region: 'north',         lat: 32.9736, lon: 35.3878 },
    'חניתה':           { region: 'north',         lat: 33.0775, lon: 35.1739 },
    'נתניה':           { region: 'sharon',        lat: 32.3215, lon: 34.8532 },
    'הרצליה':          { region: 'sharon',        lat: 32.1664, lon: 34.8439 },
    'כפר סבא':         { region: 'sharon',        lat: 32.1788, lon: 34.9066 },
    'רעננה':           { region: 'sharon',        lat: 32.1838, lon: 34.8706 },
    'חדרה':            { region: 'sharon',        lat: 32.4365, lon: 34.9192 },
    'רחובות':          { region: 'dan',           lat: 31.8928, lon: 34.8113 },
    'לוד':             { region: 'dan',           lat: 31.9516, lon: 34.8969 },
    'רמלה':            { region: 'dan',           lat: 31.9274, lon: 34.8645 },
    'מודיעין':         { region: 'jerusalem',     lat: 31.8969, lon: 34.9838 },
    'דימונה':          { region: 'south',         lat: 31.0678, lon: 35.0333 },
    'ערד':             { region: 'south',         lat: 31.2590, lon: 35.2133 },
  };

  // ─── Resolve alert type from category code ───────────────────────────────
  function _resolveAlertType(catCode) {
    const code = parseInt(catCode, 10);
    for (const t of CONFIG.alertTypes) {
      if (t.catCodes.includes(code)) return { id: t.id, label: t.label };
    }
    return { id: 'general', label: 'כללי' };
  }

  // ─── Resolve operation from timestamp ────────────────────────────────────
  function _resolveOperation(ts) {
    const t = ts.getTime();
    for (const op of CONFIG.operations) {
      const start = new Date(op.startDate).getTime();
      const end   = op.endDate ? new Date(op.endDate).getTime() + 86400000 : Infinity;
      if (t >= start && t <= end) return op.id;
    }
    return null;
  }

  // ─── Normalize a single raw OREF record ──────────────────────────────────
  function _normalizeRecord(raw) {
    const ts   = new Date(raw.alertDate.replace(' ', 'T'));
    const city = (raw.data || '').split(' - ')[0].trim();
    const meta = CITY_META[city] || {};

    const typeInfo = _resolveAlertType(raw.cat);

    return {
      id:             String(raw.id),
      timestamp:      ts,
      isoDate:        ts.toISOString().slice(0, 10),
      year:           ts.getFullYear(),
      month:          ts.getMonth() + 1,
      day:            ts.getDate(),
      hour:           ts.getHours(),
      weekday:        ts.getDay(),   // 0=Sun … 6=Sat
      alertTypeId:    typeInfo.id,
      alertTypeLabel: typeInfo.label,
      category:       parseInt(raw.cat, 10),
      area:           raw.data || city,
      city:           city,
      region:         raw._region || meta.region || 'unknown',
      lat:            raw._lat    || meta.lat    || null,
      lon:            raw._lon    || meta.lon    || null,
      operationId:    _resolveOperation(ts)
    };
  }

  // ─── Fetch or load data ───────────────────────────────────────────────────
  async function load() {
    if (_loadStatus === 'ready') return _normalized;
    _loadStatus = 'loading';
    _emit('loading');

    try {
      let raw;
      if (CONFIG.dataSource === 'live') {
        // Build final URL — prepend CORS proxy when configured (needed on
        // GitHub Pages because oref.org.il does not send CORS headers).
        const targetUrl = CONFIG.liveApiUrl;
        const url = CONFIG.corsProxy
          ? CONFIG.corsProxy + encodeURIComponent(targetUrl)
          : targetUrl;

        // Use the exact headers required by the OREF API
        const resp = await fetch(url, {
          headers: CONFIG.liveApiHeaders || {
            'Accept':           'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        if (!resp.ok) throw new Error(`OREF API responded with HTTP ${resp.status}`);

        const text = await resp.text();
        // The endpoint may return an empty body when there are no active alerts
        raw = text.trim() ? JSON.parse(text) : [];

        // Active-alerts endpoint returns a single object or an array — normalise
        if (raw && !Array.isArray(raw)) raw = [raw];

      } else {
        const resp = await fetch(CONFIG.mockDataPath);
        if (!resp.ok) throw new Error(`Cannot load ${CONFIG.mockDataPath}`);
        raw = await resp.json();
      }

      _rawRecords = Array.isArray(raw) ? raw : [];
      _normalized = _rawRecords.map(_normalizeRecord).filter(r => r.lat && r.lon);
      // Sort chronologically
      _normalized.sort((a, b) => a.timestamp - b.timestamp);

      _loadStatus = 'ready';
      _emit('ready');
      return _normalized;

    } catch (err) {
      _loadError  = err;
      _loadStatus = 'error';
      _emit('error', err);
      throw err;
    }
  }

  // ─── Public query API ────────────────────────────────────────────────────

  /**
   * getAll — return all normalized records (loaded copy)
   */
  function getAll() { return _normalized; }

  /**
   * filter — apply a filter spec and return matching records
   * @param {object} spec
   *   spec.startDate   {string}  YYYY-MM-DD
   *   spec.endDate     {string}  YYYY-MM-DD
   *   spec.regions     {string[]}
   *   spec.alertTypes  {string[]}
   *   spec.operations  {string[]}
   *   spec.cities      {string[]}
   *   spec.hourStart   {number}  0–23
   *   spec.hourEnd     {number}  0–23
   */
  function filter(spec = {}) {
    return _normalized.filter(r => {
      if (spec.startDate && r.isoDate < spec.startDate) return false;
      if (spec.endDate   && r.isoDate > spec.endDate)   return false;
      if (spec.regions?.length   && !spec.regions.includes(r.region))      return false;
      if (spec.alertTypes?.length && !spec.alertTypes.includes(r.alertTypeId)) return false;
      if (spec.operations?.length && !spec.operations.includes(r.operationId)) return false;
      if (spec.cities?.length    && !spec.cities.includes(r.city))         return false;
      if (spec.hourStart != null && r.hour < spec.hourStart)                return false;
      if (spec.hourEnd   != null && r.hour > spec.hourEnd)                  return false;
      return true;
    });
  }

  /** Unique sorted list of cities in the dataset */
  function getCities() {
    return [...new Set(_normalized.map(r => r.city))].sort();
  }

  /** Status getters */
  function getStatus() { return _loadStatus; }
  function getError()  { return _loadError;  }

  // ─── Event emitter ───────────────────────────────────────────────────────
  function _emit(event, data) {
    _listeners.forEach(fn => { try { fn(event, data); } catch(e) {} });
  }

  function on(fn) { _listeners.push(fn); }
  function off(fn) { _listeners = _listeners.filter(l => l !== fn); }

  return { load, getAll, filter, getCities, getStatus, getError, on, off };

})();
