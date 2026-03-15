/**
 * data-service.js
 * Adapter layer that loads alert data from either the live API or sample JSON,
 * normalizes records into a unified schema, and provides filtering utilities.
 */

class DataService {
  constructor(config) {
    this.config = config;
    this._cache = null;
    this.loadError = null;
    this.dataSource = null;   // 'live' | 'mock' — set after successful load
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Load and cache all records. Returns normalized array.
   * Automatically falls back to mock data if live fetch fails.
   */
  async load() {
    if (this._cache) return this._cache;

    if (this.config.dataMode === 'live') {
      try {
        const raw = await this._fetchLive();
        this._cache = this._normalizeAll(raw);
        this.dataSource = 'live';
        return this._cache;
      } catch (err) {
        console.warn('[DataService] Live API failed, falling back to mock:', err.message);
        this.loadError = err.message;
      }
    }

    // mock / fallback path
    const raw = await this._fetchMock();
    this._cache = this._normalizeAll(raw);
    this.dataSource = 'mock';
    return this._cache;
  }

  /**
   * Filter the cached dataset.
   * @param {Object} filters - { startDate, endDate, region, alertType, operationId, city }
   * @returns {Array} filtered records
   */
  filter(data, filters = {}) {
    return data.filter(r => {
      if (filters.startDate && r.timestamp < new Date(filters.startDate)) return false;
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        if (r.timestamp > end) return false;
      }
      if (filters.region    && filters.region    !== 'all' && r.region    !== filters.region)    return false;
      if (filters.alertType && filters.alertType !== 'all' && r.alertType !== filters.alertType) return false;
      if (filters.operationId && filters.operationId !== 'all' && r.operationId !== filters.operationId) return false;
      if (filters.city      && r.city !== filters.city)      return false;
      return true;
    });
  }

  /** Return sorted unique values for a given field */
  getUniqueValues(data, field) {
    return [...new Set(data.map(r => r[field]).filter(Boolean))].sort((a, b) =>
      typeof a === 'string' ? a.localeCompare(b, 'he') : a - b
    );
  }

  // ── Private helpers ────────────────────────────────────────────────────

  async _fetchLive() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(this.config.liveApiUrl, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async _fetchMock() {
    const res = await fetch(this.config.sampleDataPath);
    if (!res.ok) throw new Error(`Cannot load ${this.config.sampleDataPath}: ${res.status}`);
    return res.json();
  }

  /**
   * Normalize a raw record array into the unified schema:
   * { id, timestamp:Date, area, city, region, alertType, operationId, lat, lng }
   */
  _normalizeAll(records) {
    if (!Array.isArray(records)) {
      // Some API formats wrap in an object
      records = records.alerts || records.data || records.items || [];
    }
    return records
      .map(r => this._normalizeOne(r))
      .filter(r => r.timestamp && !isNaN(r.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  _normalizeOne(r) {
    const ts = new Date(r.timestamp || r.time || r.alertTime || r.date || 0);
    return {
      id:          r.id          || r.alertId || `gen_${Math.random().toString(36).slice(2)}`,
      timestamp:   ts,
      area:        r.area        || r.areaName  || r.zone || '',
      city:        r.city        || r.name      || r.location || '',
      region:      r.region      || this._inferRegion(r.area || r.areaName || ''),
      alertType:   r.alertType   || r.category  || r.type || 'ירי רקטות וטילים',
      operationId: r.operationId || this._inferOperation(ts),
      lat:         parseFloat(r.lat || r.latitude  || 0),
      lng:         parseFloat(r.lng || r.longitude || 0),
    };
  }

  _inferRegion(area) {
    const map = {
      'דרום': ['עוטף עזה','נגב','שפלת יהודה','לכיש','ים המלח','ערבה','אשדוד','אשקלון','קריית גת'],
      'צפון': ['גליל','כינרת','עמקים','גולן','קריות','חיפה','עכו','נהריה','קריית שמונה'],
      'ירושלים': ['ירושלים'],
      'מרכז': ['גוש דן','שרון','שפלה','פתח','ראשון','רחובות','נתניה','הרצליה','מודיעין'],
    };
    for (const [region, keywords] of Object.entries(map)) {
      if (keywords.some(kw => area.includes(kw))) return region;
    }
    return 'אחר';
  }

  _inferOperation(ts) {
    if (!ts || isNaN(ts)) return null;
    for (const op of this.config.operations) {
      const start = new Date(op.startDate);
      const end   = op.endDate ? new Date(op.endDate) : new Date('2099-01-01');
      if (ts >= start && ts <= end) return op.id;
    }
    return null;
  }
}
