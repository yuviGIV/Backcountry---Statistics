/**
 * analytics.js
 * Pure statistical computation engine.
 * No DOM access — all functions take data arrays and return plain objects.
 *
 * SAFETY NOTE: computeRiskIndex() produces a DESCRIPTIVE historical metric only.
 * It must never be presented as a prediction or operational threat indicator.
 */

class AnalyticsEngine {

  // ── KPI Summary ───────────────────────────────────────────────────────────

  computeKPIs(data) {
    if (!data.length) return this._emptyKPIs();

    const total = data.length;
    const uniqueCities = new Set(data.map(r => r.city)).size;
    const uniqueAreas  = new Set(data.map(r => r.area)).size;

    const timestamps = data.map(r => r.timestamp).sort((a, b) => a - b);
    const first = timestamps[0];
    const last  = timestamps[timestamps.length - 1];
    const daysDiff = Math.max(1, Math.ceil((last - first) / (1000 * 60 * 60 * 24)));
    const avgPerDay = (total / daysDiff).toFixed(1);

    const hourCounts  = this.groupByHour(data);
    const areaCounts  = this.groupByField(data, 'area');
    const typeCounts  = this.groupByField(data, 'alertType');
    const regionCounts = this.groupByField(data, 'region');

    const peakHourEntry  = this._topEntry(hourCounts);
    const topAreaEntry   = this._topEntry(areaCounts);
    const topTypeEntry   = this._topEntry(typeCounts);
    const topRegionEntry = this._topEntry(regionCounts);

    return {
      total, uniqueCities, uniqueAreas, daysDiff,
      avgPerDay,
      peakHour:  peakHourEntry  ? `${peakHourEntry[0]}:00`  : '--',
      peakHourCount: peakHourEntry ? peakHourEntry[1] : 0,
      topArea:   topAreaEntry   ? topAreaEntry[0]   : '--',
      topAreaCount: topAreaEntry ? topAreaEntry[1] : 0,
      topType:   topTypeEntry   ? topTypeEntry[0]   : '--',
      topTypeCount: topTypeEntry ? topTypeEntry[1] : 0,
      topRegion: topRegionEntry ? topRegionEntry[0] : '--',
      topRegionPct: topRegionEntry
        ? Math.round((topRegionEntry[1] / total) * 100) : 0,
      dateRange: { first, last },
    };
  }

  _emptyKPIs() {
    return {
      total: 0, uniqueCities: 0, uniqueAreas: 0, daysDiff: 0,
      avgPerDay: '0', peakHour: '--', peakHourCount: 0,
      topArea: '--', topAreaCount: 0, topType: '--', topTypeCount: 0,
      topRegion: '--', topRegionPct: 0,
      dateRange: { first: null, last: null },
    };
  }

  // ── Grouping helpers ──────────────────────────────────────────────────────

  groupByField(data, field) {
    return data.reduce((acc, r) => {
      const key = r[field] || 'לא ידוע';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  groupByHour(data) {
    const counts = {};
    for (let h = 0; h < 24; h++) counts[h] = 0;
    data.forEach(r => { counts[r.timestamp.getHours()]++; });
    return counts;
  }

  groupByDayOfWeek(data) {
    const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
    const counts = {};
    days.forEach(d => { counts[d] = 0; });
    data.forEach(r => { counts[days[r.timestamp.getDay()]]++; });
    return counts;
  }

  groupByDay(data) {
    return data.reduce((acc, r) => {
      const key = r.timestamp.toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  groupByWeek(data) {
    return data.reduce((acc, r) => {
      const d = new Date(r.timestamp);
      d.setDate(d.getDate() - d.getDay());          // Sunday start
      const key = d.toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  groupByMonth(data) {
    return data.reduce((acc, r) => {
      const key = r.timestamp.toISOString().slice(0, 7);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  /** Sorted [key, count] pairs descending */
  sortedEntries(obj, limit = null) {
    const sorted = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  // ── Time-series helpers ───────────────────────────────────────────────────

  /**
   * Fill missing dates in a day-keyed object within the data's date range.
   * Returns sorted [date, count] pairs.
   */
  fillDailyGaps(dayObj, startDate = null, endDate = null) {
    if (!Object.keys(dayObj).length) return [];
    const keys = Object.keys(dayObj).sort();
    const start = startDate || new Date(keys[0]);
    const end   = endDate   || new Date(keys[keys.length - 1]);
    const result = [];
    const cur = new Date(start);
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10);
      result.push([key, dayObj[key] || 0]);
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }

  /**
   * Compute centered moving average.
   * @param {Array} sortedPairs - [[key, value], ...]
   * @param {number} window
   * @returns {Array} [[key, avg], ...]
   */
  movingAverage(sortedPairs, window = 7) {
    const half = Math.floor(window / 2);
    return sortedPairs.map(([key], i) => {
      const lo = Math.max(0, i - half);
      const hi = Math.min(sortedPairs.length - 1, i + half);
      const slice = sortedPairs.slice(lo, hi + 1);
      const avg = slice.reduce((s, [, v]) => s + v, 0) / slice.length;
      return [key, Math.round(avg * 10) / 10];
    });
  }

  /**
   * Detect anomaly spikes using mean + k*stddev threshold.
   * @returns {Array} [[key, value], ...] pairs flagged as anomalies
   */
  detectAnomalies(sortedPairs, multiplier = 2.5) {
    if (!sortedPairs.length) return [];
    const values = sortedPairs.map(([, v]) => v);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    const threshold = mean + multiplier * std;
    return sortedPairs.filter(([, v]) => v > threshold);
  }

  // ── Heatmap ───────────────────────────────────────────────────────────────

  /**
   * Build a 7×24 matrix (dayOfWeek × hour) of alert counts.
   * Returns { matrix: number[][], max: number }
   */
  buildHeatmapMatrix(data) {
    const days = 7, hours = 24;
    const matrix = Array.from({ length: days }, () => new Array(hours).fill(0));
    data.forEach(r => {
      const dow = r.timestamp.getDay();  // 0=Sun
      const h   = r.timestamp.getHours();
      matrix[dow][h]++;
    });
    const max = Math.max(...matrix.flat());
    return { matrix, max };
  }

  // ── Operation comparison ──────────────────────────────────────────────────

  compareOperations(data, config) {
    return config.operations.map(op => {
      const subset = data.filter(r => r.operationId === op.id);
      const start  = new Date(op.startDate);
      const end    = op.endDate ? new Date(op.endDate) : new Date();
      const durationDays = Math.max(1, Math.ceil((end - start) / (1000*60*60*24)));
      const kpis   = this.computeKPIs(subset);
      const byType = this.groupByField(subset, 'alertType');
      const byRegion = this.groupByField(subset, 'region');
      const hourly  = this.groupByHour(subset);
      return {
        op, subset, kpis, durationDays,
        byType, byRegion, hourly,
        alertsPerDay: (subset.length / durationDays).toFixed(1),
      };
    }).filter(d => d.subset.length > 0);
  }

  // ── Regional ranking ──────────────────────────────────────────────────────

  regionalRanking(data, config) {
    const allAreas = this.groupByField(data, 'area');
    return Object.entries(allAreas)
      .sort((a, b) => b[1] - a[1])
      .map(([area, count]) => {
        const subset = data.filter(r => r.area === area);
        const hourly = this.groupByHour(subset);
        const byType = this.groupByField(subset, 'alertType');
        const peakH  = this._topEntry(hourly);
        const topT   = this._topEntry(byType);
        return {
          area, count,
          pct: Math.round((count / data.length) * 100),
          peakHour: peakH ? `${peakH[0]}:00` : '--',
          topType:  topT  ? topT[0] : '--',
          cities:   [...new Set(subset.map(r => r.city))].length,
        };
      });
  }

  // ── Historical Risk Index ─────────────────────────────────────────────────
  //
  // SAFETY: This metric is PURELY DESCRIPTIVE and historical.
  // It computes the fraction of days (within the selected scope) on which
  // at least one alert matching the filters occurred.
  // It CANNOT and MUST NOT be interpreted as probability of future events.

  computeRiskIndex(allData, params) {
    const {
      area,
      startDate, endDate,
      hourStart, hourEnd,
      alertType,
    } = params;

    // Step 1: Establish scope — all records for this area (no date/hour filter)
    const scopeData = allData.filter(r => {
      if (!area || area === 'all') return true;
      return r.area === area || r.city === area || r.region === area;
    });

    if (!scopeData.length) {
      return {
        index: 0, confidence: 'low',
        formula: 'אין נתונים לאזור שנבחר',
        count: 0, totalDays: 0, daysWithAlerts: 0,
        sparseWarning: true,
      };
    }

    // Step 2: Date range for baseline
    const timestamps = scopeData.map(r => r.timestamp).sort((a, b) => a - b);
    const rangeStart = startDate ? new Date(startDate) : timestamps[0];
    const rangeEnd   = endDate   ? new Date(endDate)   : timestamps[timestamps.length - 1];
    const totalDays  = Math.max(1, Math.ceil((rangeEnd - rangeStart) / (1000*60*60*24)));

    // Step 3: Filter by all params
    const filtered = scopeData.filter(r => {
      if (r.timestamp < rangeStart || r.timestamp > rangeEnd) return false;
      if (alertType && alertType !== 'all' && r.alertType !== alertType) return false;
      const h = r.timestamp.getHours();
      if (hourStart != null && h < parseInt(hourStart)) return false;
      if (hourEnd   != null && h > parseInt(hourEnd))   return false;
      return true;
    });

    // Step 4: Count distinct days with at least one qualifying alert
    const daysWithAlerts = new Set(filtered.map(r => r.timestamp.toISOString().slice(0, 10))).size;

    const index = Math.round((daysWithAlerts / totalDays) * 100);

    // Step 5: Confidence based on sample size
    let confidence, confidenceHe;
    if (filtered.length < 10) {
      confidence = 'low';
      confidenceHe = 'נמוכה – נתונים דלילים (פחות מ-10 אירועים)';
    } else if (filtered.length < 50) {
      confidence = 'medium';
      confidenceHe = 'בינונית – נתונים מוגבלים';
    } else {
      confidence = 'high';
      confidenceHe = 'גבוהה';
    }

    const formula =
      `ימים עם התרעה (${daysWithAlerts}) ÷ סה"כ ימים בטווח (${totalDays}) × 100 = ${index}%`;

    return {
      index,
      confidence,
      confidenceHe,
      formula,
      count: filtered.length,
      totalDays,
      daysWithAlerts,
      sparseWarning: filtered.length < 10,
      rangeStart, rangeEnd,
    };
  }

  // ── Auto-generated insights ───────────────────────────────────────────────

  generateInsights(data, kpis) {
    if (!data.length) return ['אין נתונים להצגה עבור הסינון הנוכחי.'];
    const insights = [];
    const typeCounts  = this.groupByField(data, 'alertType');
    const topType     = this._topEntry(typeCounts);
    const regionCounts = this.groupByField(data, 'region');
    const topRegion   = this._topEntry(regionCounts);

    if (topType) {
      const pct = Math.round((topType[1] / kpis.total) * 100);
      insights.push(`סוג ההתרעה הנפוץ ביותר הוא "${topType[0]}" — ${pct}% מסך ${kpis.total.toLocaleString('he-IL')} האירועים.`);
    }
    if (topRegion) {
      const pct = Math.round((topRegion[1] / kpis.total) * 100);
      insights.push(`האזור הפגוע ביותר הוא "${topRegion[0]}" — ${pct}% מהאירועים.`);
    }
    if (kpis.peakHour !== '--') {
      insights.push(`שעת השיא היא ${kpis.peakHour}, עם ${kpis.peakHourCount} אירועים רשומים.`);
    }
    if (parseFloat(kpis.avgPerDay) > 0) {
      insights.push(`ממוצע של ${kpis.avgPerDay} אירועים ביום נרשם על פני ${kpis.daysDiff} ימים.`);
    }
    // Day-of-week insight
    const dow = this.groupByDayOfWeek(data);
    const topDow = this._topEntry(dow);
    if (topDow) {
      insights.push(`יום ${topDow[0]} הוא יום השבוע עם מספר האירועים הגבוה ביותר (${topDow[1]} אירועים).`);
    }
    return insights;
  }

  // ── Private utilities ─────────────────────────────────────────────────────

  _topEntry(obj) {
    const entries = Object.entries(obj).filter(([, v]) => v > 0);
    if (!entries.length) return null;
    return entries.reduce((best, cur) => cur[1] > best[1] ? cur : best);
  }
}
