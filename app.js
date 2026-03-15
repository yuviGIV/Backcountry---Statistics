/**
 * app.js
 * Main application controller.
 * Handles routing, page rendering, chart lifecycle, and map management.
 */

(function () {
  'use strict';

  // ── Globals ───────────────────────────────────────────────────────────────
  const svc       = new DataService(APP_CONFIG);
  const analytics = new AnalyticsEngine();
  const C         = APP_CONFIG.colors;

  let allData      = [];
  let filteredData = [];
  let currentPage  = 'overview';
  let chartRegistry = {};       // page → { id: Chart instance }
  let mapInstance   = null;
  let markerCluster = null;
  let mapMarkers    = [];

  const filters = {
    startDate:   '',
    endDate:     '',
    region:      'all',
    alertType:   'all',
    operationId: 'all',
  };

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', async () => {
    showLoading(true);
    try {
      allData = await svc.load();
      filteredData = [...allData];

      populateFilterDropdowns();
      setupGlobalFilters();
      setupNavigation();
      setupRiskIndexForm();
      setDataSourceBadge();

      navigateTo('overview');
    } catch (err) {
      showError('שגיאה בטעינת הנתונים: ' + err.message);
    } finally {
      showLoading(false);
    }
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(link.dataset.page);
      });
    });
  }

  function navigateTo(page) {
    currentPage = page;

    document.querySelectorAll('.nav-link').forEach(l =>
      l.classList.toggle('active', l.dataset.page === page)
    );
    document.querySelectorAll('.page-section').forEach(s => {
      const isActive = s.id === `page-${page}`;
      s.classList.toggle('active', isActive);
      s.style.display = isActive ? '' : 'none';
    });

    // Lazy-init map only when map page becomes visible
    if (page === 'map') {
      setTimeout(() => {
        initMap();
        renderMapPage();
      }, 50);
    } else {
      renderPage(page);
    }

    // Update mobile sidebar close
    document.querySelector('.sidebar')?.classList.remove('open');
  }

  function renderPage(page) {
    switch (page) {
      case 'overview':    renderOverview();    break;
      case 'operations':  renderOperations();  break;
      case 'regional':    renderRegional();    break;
      case 'trends':      renderTrends();      break;
      case 'risk':        renderRiskPage();    break;
    }
  }

  // ── Global Filters ────────────────────────────────────────────────────────

  function populateFilterDropdowns() {
    // Operations
    const opSel = document.getElementById('filter-operation');
    APP_CONFIG.operations.forEach(op => {
      const opt = new Option(op.label, op.id);
      opSel.appendChild(opt);
    });

    // Regions
    const regSel = document.getElementById('filter-region');
    APP_CONFIG.regions.forEach(r => {
      const opt = new Option(r.label, r.id);
      regSel.appendChild(opt);
    });

    // Alert types
    const typeSel = document.getElementById('filter-alerttype');
    APP_CONFIG.alertTypes.forEach(at => {
      const opt = new Option(at.label, at.label);
      typeSel.appendChild(opt);
    });

    // Date range defaults
    const dates = allData.map(r => r.timestamp).sort((a, b) => a - b);
    if (dates.length) {
      document.getElementById('filter-start').value = dates[0].toISOString().slice(0, 10);
      document.getElementById('filter-end').value   = dates[dates.length - 1].toISOString().slice(0, 10);
      filters.startDate = document.getElementById('filter-start').value;
      filters.endDate   = document.getElementById('filter-end').value;
    }
  }

  function setupGlobalFilters() {
    const ids = ['filter-start','filter-end','filter-operation','filter-region','filter-alerttype'];
    ids.forEach(id => {
      document.getElementById(id)?.addEventListener('change', onFilterChange);
    });

    document.getElementById('btn-filter-reset')?.addEventListener('click', resetFilters);
    document.getElementById('sidebar-toggle')?.addEventListener('click', () =>
      document.querySelector('.sidebar')?.classList.toggle('open')
    );
  }

  function onFilterChange() {
    filters.startDate   = document.getElementById('filter-start').value;
    filters.endDate     = document.getElementById('filter-end').value;
    filters.operationId = document.getElementById('filter-operation').value;
    filters.region      = document.getElementById('filter-region').value;
    filters.alertType   = document.getElementById('filter-alerttype').value;

    filteredData = svc.filter(allData, filters);
    updateFilterCount();
    destroyChartsForPage(currentPage);
    renderPage(currentPage);
    if (currentPage === 'map') renderMapPage();
  }

  function resetFilters() {
    ['filter-operation','filter-region','filter-alerttype'].forEach(id =>
      (document.getElementById(id).value = 'all')
    );
    const dates = allData.map(r => r.timestamp).sort((a, b) => a - b);
    if (dates.length) {
      document.getElementById('filter-start').value = dates[0].toISOString().slice(0, 10);
      document.getElementById('filter-end').value   = dates[dates.length - 1].toISOString().slice(0, 10);
    }
    onFilterChange();
  }

  function updateFilterCount() {
    const el = document.getElementById('filter-count');
    if (el) el.textContent = `${filteredData.length.toLocaleString('he-IL')} אירועים`;
  }

  function setDataSourceBadge() {
    const el = document.getElementById('data-source-badge');
    if (!el) return;
    el.textContent = svc.dataSource === 'live' ? '🟢 נתונים חיים' : '🟡 נתוני דמו';
    el.title = svc.loadError ? `שגיאה בנתונים חיים: ${svc.loadError}` : '';
  }

  // ── Chart Lifecycle ───────────────────────────────────────────────────────

  function destroyChartsForPage(page) {
    if (!chartRegistry[page]) return;
    Object.values(chartRegistry[page]).forEach(ch => {
      try { ch.destroy(); } catch (_) {}
    });
    chartRegistry[page] = {};
  }

  function registerChart(page, id, chart) {
    if (!chartRegistry[page]) chartRegistry[page] = {};
    chartRegistry[page][id] = chart;
  }

  function makeChart(canvasId, type, data, options = {}) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    const defaults = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: C.text, font: { family: "'Heebo', sans-serif", size: 12 } },
        },
        tooltip: {
          bodyFont:  { family: "'Heebo', sans-serif" },
          titleFont: { family: "'Heebo', sans-serif" },
          backgroundColor: C.surfaceElevated,
          borderColor: C.border,
          borderWidth: 1,
        },
      },
      scales: type !== 'doughnut' && type !== 'pie' && type !== 'polarArea' ? {
        x: { ticks: { color: C.textMuted, font: { family: "'Heebo', sans-serif", size: 11 } }, grid: { color: C.chartGrid } },
        y: { ticks: { color: C.textMuted, font: { family: "'Heebo', sans-serif", size: 11 } }, grid: { color: C.chartGrid }, beginAtZero: true },
      } : undefined,
    };
    const mergedOptions = deepMerge(defaults, options);
    return new Chart(ctx, { type, data, options: mergedOptions });
  }

  // ── Page: Overview ────────────────────────────────────────────────────────

  function renderOverview() {
    const data = filteredData;
    const kpis = analytics.computeKPIs(data);

    // KPI cards
    setKPI('kpi-total',    kpis.total.toLocaleString('he-IL'),    'סך האירועים');
    setKPI('kpi-cities',   kpis.uniqueCities,                     'ערים מושפעות');
    setKPI('kpi-avgday',   kpis.avgPerDay,                        'ממוצע יומי');
    setKPI('kpi-peakhour', kpis.peakHour,                         'שעת שיא');

    // Trend chart (monthly)
    const monthlyObj = analytics.groupByMonth(data);
    const monthlyPairs = Object.entries(monthlyObj).sort(([a], [b]) => a.localeCompare(b));
    const ch1 = makeChart('chart-trend', 'line', {
      labels: monthlyPairs.map(([k]) => formatMonth(k)),
      datasets: [{
        label: 'אירועים',
        data: monthlyPairs.map(([, v]) => v),
        borderColor: C.primary,
        backgroundColor: hexAlpha(C.primary, 0.15),
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
      }],
    }, { plugins: { legend: { display: false } } });
    registerChart('overview', 'trend', ch1);

    // Alert type donut
    const typeData = analytics.groupByField(data, 'alertType');
    const typeColors = APP_CONFIG.alertTypes.map(at => at.color);
    const typeLabels = APP_CONFIG.alertTypes.map(at => at.label);
    const typeValues = typeLabels.map(l => typeData[l] || 0);
    const ch2 = makeChart('chart-types', 'doughnut', {
      labels: typeLabels,
      datasets: [{
        data: typeValues,
        backgroundColor: typeColors,
        borderColor: C.surface,
        borderWidth: 2,
        hoverOffset: 8,
      }],
    }, { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8 } } }, cutout: '65%' });
    registerChart('overview', 'types', ch2);

    // Top areas bar
    const areaCounts = analytics.sortedEntries(analytics.groupByField(data, 'area'), APP_CONFIG.topNItems);
    const ch3 = makeChart('chart-topareas', 'bar', {
      labels: areaCounts.map(([k]) => k),
      datasets: [{
        label: 'אירועים',
        data: areaCounts.map(([, v]) => v),
        backgroundColor: areaCounts.map((_, i) => hexAlpha(C.primary, 0.7 - i * 0.05)),
        borderRadius: 4,
      }],
    }, {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: C.textMuted }, grid: { color: C.chartGrid } },
        y: { ticks: { color: C.text, font: { size: 11 } }, grid: { display: false } },
      },
    });
    registerChart('overview', 'topareas', ch3);

    // Hourly distribution
    const hourCounts = analytics.groupByHour(data);
    const labels24 = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const ch4 = makeChart('chart-hourly', 'bar', {
      labels: labels24,
      datasets: [{
        label: 'אירועים',
        data: Object.values(hourCounts),
        backgroundColor: Object.values(hourCounts).map(v => {
          const max = Math.max(...Object.values(hourCounts));
          return hexAlpha(C.accent, 0.3 + (v / max) * 0.7);
        }),
        borderRadius: 2,
      }],
    }, { plugins: { legend: { display: false } } });
    registerChart('overview', 'hourly', ch4);

    // Heatmap
    renderHeatmap(data);

    // Insights
    const insights = analytics.generateInsights(data, kpis);
    renderInsights(insights);
  }

  function setKPI(id, value, label) {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelector('.kpi-value').textContent = value;
    if (label) el.querySelector('.kpi-label').textContent = label;
  }

  function renderHeatmap(data) {
    const container = document.getElementById('heatmap-grid');
    if (!container) return;
    const { matrix, max } = analytics.buildHeatmapMatrix(data);
    const days = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];

    container.innerHTML = '';
    // Header row: hours
    const headerRow = document.createElement('div');
    headerRow.className = 'heatmap-row';
    headerRow.innerHTML = '<div class="hm-day-label"></div>';
    for (let h = 0; h < 24; h++) {
      const cell = document.createElement('div');
      cell.className = 'hm-hour-label';
      cell.textContent = h % 3 === 0 ? h : '';
      headerRow.appendChild(cell);
    }
    container.appendChild(headerRow);

    matrix.forEach((row, d) => {
      const dayRow = document.createElement('div');
      dayRow.className = 'heatmap-row';
      const label = document.createElement('div');
      label.className = 'hm-day-label';
      label.textContent = days[d];
      dayRow.appendChild(label);
      row.forEach((count, h) => {
        const cell = document.createElement('div');
        cell.className = 'hm-cell';
        const intensity = max > 0 ? count / max : 0;
        const alpha = 0.08 + intensity * 0.92;
        const hue = 210 - intensity * 80;   // blue → red
        cell.style.background = `hsla(${hue}, 85%, 55%, ${alpha})`;
        cell.title = `יום ${days[d]} שעה ${h}:00 — ${count} אירועים`;
        dayRow.appendChild(cell);
      });
      container.appendChild(dayRow);
    });
  }

  function renderInsights(insights) {
    const container = document.getElementById('insights-list');
    if (!container) return;
    container.innerHTML = insights
      .map(t => `<li class="insight-item"><span class="insight-icon">💡</span><span>${t}</span></li>`)
      .join('');
  }

  // ── Page: Operations ──────────────────────────────────────────────────────

  function renderOperations() {
    const comparisons = analytics.compareOperations(filteredData, APP_CONFIG);
    const container = document.getElementById('ops-cards');
    if (!container) return;
    container.innerHTML = '';

    comparisons.forEach(({ op, kpis, alertsPerDay, durationDays, byType, byRegion, hourly }) => {
      const card = document.createElement('div');
      card.className = 'op-stat-card';
      card.style.borderTop = `3px solid ${op.color}`;
      card.innerHTML = `
        <div class="op-card-header">
          <span class="op-badge" style="background:${op.bgColor};color:${op.color}">${op.label}</span>
          <span class="op-dates">${op.startDate} – ${op.endDate || 'טרם הסתיים'}</span>
        </div>
        <div class="op-kpi-row">
          <div class="op-kpi"><strong>${kpis.total.toLocaleString('he-IL')}</strong><small>אירועים</small></div>
          <div class="op-kpi"><strong>${durationDays}</strong><small>ימים</small></div>
          <div class="op-kpi"><strong>${alertsPerDay}</strong><small>ממוצע/יום</small></div>
          <div class="op-kpi"><strong>${kpis.uniqueCities}</strong><small>ערים</small></div>
        </div>
      `;
      container.appendChild(card);
    });

    // Side-by-side bar chart: totals
    if (comparisons.length) {
      const ch = makeChart('chart-ops-compare', 'bar', {
        labels: comparisons.map(d => d.op.label),
        datasets: [{
          label: 'סה"כ אירועים',
          data: comparisons.map(d => d.kpis.total),
          backgroundColor: comparisons.map(d => d.op.color),
          borderRadius: 6,
        }],
      }, { plugins: { legend: { display: false } } });
      registerChart('operations', 'compare', ch);
    }

    // Hourly comparison
    const hourlyDatasets = comparisons.map(d => ({
      label: d.op.label,
      data: Object.values(d.hourly),
      borderColor: d.op.color,
      backgroundColor: hexAlpha(d.op.color, 0.1),
      fill: false,
      tension: 0.4,
      pointRadius: 2,
    }));
    if (hourlyDatasets.length) {
      const ch2 = makeChart('chart-ops-hourly', 'line', {
        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        datasets: hourlyDatasets,
      });
      registerChart('operations', 'hourly', ch2);
    }

    // Region stacked bar
    const allRegions = APP_CONFIG.regions.map(r => r.id);
    const regionDatasets = allRegions.map((reg, ri) => ({
      label: reg,
      data: comparisons.map(d => d.byRegion[reg] || 0),
      backgroundColor: APP_CONFIG.regions[ri]?.color || C.primary,
      borderRadius: 4,
    }));
    if (comparisons.length) {
      const ch3 = makeChart('chart-ops-regions', 'bar', {
        labels: comparisons.map(d => d.op.label),
        datasets: regionDatasets,
      }, { scales: { x: { stacked: true }, y: { stacked: true } } });
      registerChart('operations', 'regions', ch3);
    }
  }

  // ── Page: Map ─────────────────────────────────────────────────────────────

  function initMap() {
    if (mapInstance) return;
    const el = document.getElementById('leaflet-map');
    if (!el) return;

    mapInstance = L.map('leaflet-map', {
      center: APP_CONFIG.mapCenter,
      zoom:   APP_CONFIG.mapZoom,
      minZoom: APP_CONFIG.mapMinZoom,
      maxZoom: APP_CONFIG.mapMaxZoom,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(mapInstance);

    // Use MarkerClusterGroup if available
    if (typeof L.markerClusterGroup === 'function') {
      markerCluster = L.markerClusterGroup({ maxClusterRadius: 40 });
      mapInstance.addLayer(markerCluster);
    }
  }

  function renderMapPage() {
    if (!mapInstance) return;

    // Clear existing markers
    if (markerCluster) {
      markerCluster.clearLayers();
    } else {
      mapMarkers.forEach(m => mapInstance.removeLayer(m));
      mapMarkers = [];
    }

    const data = filteredData.filter(r => r.lat && r.lng);
    const typeColorMap = {};
    APP_CONFIG.alertTypes.forEach(at => { typeColorMap[at.label] = at.color; });
    const typeIconMap = {};
    APP_CONFIG.alertTypes.forEach(at => { typeIconMap[at.label] = at.icon; });

    const markers = data.map(r => {
      const color = typeColorMap[r.alertType] || C.primary;
      const icon  = typeIconMap[r.alertType] || '⚠️';
      const marker = L.circleMarker([r.lat, r.lng], {
        radius: 7,
        fillColor: color,
        color: '#fff',
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.75,
      });
      marker.bindPopup(`
        <div class="map-popup" dir="rtl">
          <div class="popup-title">${icon} ${r.city} — ${r.area}</div>
          <div class="popup-row"><strong>סוג:</strong> ${r.alertType}</div>
          <div class="popup-row"><strong>אזור:</strong> ${r.region}</div>
          <div class="popup-row"><strong>תאריך:</strong> ${formatDateTime(r.timestamp)}</div>
        </div>
      `);
      return marker;
    });

    if (markerCluster) {
      markerCluster.addLayers(markers);
    } else {
      markers.forEach(m => { m.addTo(mapInstance); mapMarkers.push(m); });
    }

    // Map stats panel
    const statsEl = document.getElementById('map-stats');
    if (statsEl) {
      const areaCounts = analytics.sortedEntries(analytics.groupByField(data, 'area'), 5);
      statsEl.innerHTML = `
        <div class="map-stat-title">5 אזורים עם הכי הרבה אירועים</div>
        ${areaCounts.map(([a, c]) => `
          <div class="map-stat-row">
            <span>${a}</span>
            <span class="map-stat-count">${c}</span>
          </div>`).join('')}
        <div class="map-stat-total">סה"כ מוצג: ${data.length.toLocaleString('he-IL')} אירועים</div>
      `;
    }
  }

  // ── Page: Regional Analysis ───────────────────────────────────────────────

  function renderRegional() {
    const data = filteredData;
    const ranking = analytics.regionalRanking(data, APP_CONFIG);

    // Rankings table
    const tbody = document.getElementById('regional-table-body');
    if (tbody) {
      tbody.innerHTML = ranking.slice(0, 20).map((item, i) => `
        <tr class="table-row ${i === 0 ? 'table-row-top' : ''}">
          <td>${i + 1}</td>
          <td>${item.area}</td>
          <td>${item.count.toLocaleString('he-IL')}</td>
          <td>
            <div class="bar-cell">
              <div class="bar-fill" style="width:${item.pct}%;background:${C.primary}"></div>
              <span>${item.pct}%</span>
            </div>
          </td>
          <td>${item.peakHour}</td>
          <td class="type-cell">${item.topType}</td>
          <td>${item.cities}</td>
        </tr>
      `).join('');
    }

    // Region pie
    const regionCounts = analytics.groupByField(data, 'region');
    const ch1 = makeChart('chart-regions-pie', 'doughnut', {
      labels: APP_CONFIG.regions.map(r => r.label),
      datasets: [{
        data: APP_CONFIG.regions.map(r => regionCounts[r.id] || 0),
        backgroundColor: APP_CONFIG.regions.map(r => r.color),
        borderColor: C.surface,
        borderWidth: 2,
        hoverOffset: 8,
      }],
    }, { plugins: { legend: { position: 'bottom' } }, cutout: '60%' });
    registerChart('regional', 'pie', ch1);

    // Day-of-week distribution
    const dow = analytics.groupByDayOfWeek(data);
    const dowKeys = Object.keys(dow);
    const ch2 = makeChart('chart-dayofweek', 'bar', {
      labels: dowKeys,
      datasets: [{
        label: 'אירועים',
        data: Object.values(dow),
        backgroundColor: hexAlpha(C.accent, 0.7),
        borderRadius: 4,
      }],
    }, { plugins: { legend: { display: false } } });
    registerChart('regional', 'dow', ch2);
  }

  // ── Page: Historical Trends ───────────────────────────────────────────────

  function renderTrends() {
    const data = filteredData;
    const dailyObj = analytics.groupByDay(data);
    const dailyPairs = analytics.fillDailyGaps(dailyObj);
    const maLine = analytics.movingAverage(dailyPairs, APP_CONFIG.movingAverageWindow);
    const anomalies = analytics.detectAnomalies(dailyPairs, APP_CONFIG.anomalyMultiplier);
    const anomalySet = new Set(anomalies.map(([k]) => k));

    // Daily + MA line chart
    const ch1 = makeChart('chart-daily-trend', 'bar', {
      labels: dailyPairs.map(([k]) => k),
      datasets: [
        {
          label: 'אירועים יומיים',
          data: dailyPairs.map(([, v]) => v),
          backgroundColor: dailyPairs.map(([k]) =>
            anomalySet.has(k) ? hexAlpha(C.secondary, 0.85) : hexAlpha(C.primary, 0.45)
          ),
          borderRadius: 1,
          order: 2,
        },
        {
          label: `ממוצע נע ${APP_CONFIG.movingAverageWindow} ימים`,
          data: maLine.map(([, v]) => v),
          type: 'line',
          borderColor: C.accent,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          order: 1,
        },
      ],
    }, {
      scales: {
        x: {
          ticks: { maxTicksLimit: 12, color: C.textMuted, maxRotation: 45 },
          grid: { color: C.chartGrid },
        },
      },
    });
    registerChart('trends', 'daily', ch1);

    // Anomalies list
    const anomalyEl = document.getElementById('anomaly-list');
    if (anomalyEl) {
      if (anomalies.length) {
        anomalyEl.innerHTML = anomalies
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `<div class="anomaly-item">📅 ${k} — <strong>${v}</strong> אירועים</div>`)
          .join('');
      } else {
        anomalyEl.innerHTML = '<div class="empty-state-sm">לא זוהו חריגות בתקופה הנוכחית.</div>';
      }
    }

    // Weekly aggregation
    const weeklyObj = analytics.groupByWeek(data);
    const weeklyPairs = Object.entries(weeklyObj).sort(([a], [b]) => a.localeCompare(b));
    const ch2 = makeChart('chart-weekly', 'line', {
      labels: weeklyPairs.map(([k]) => k),
      datasets: [{
        label: 'אירועים שבועיים',
        data: weeklyPairs.map(([, v]) => v),
        borderColor: C.success,
        backgroundColor: hexAlpha(C.success, 0.1),
        fill: true,
        tension: 0.4,
        pointRadius: 2,
      }],
    }, { plugins: { legend: { display: false } } });
    registerChart('trends', 'weekly', ch2);

    // Hour × type heatmap (type distribution by hour)
    renderHourTypeMatrix(data);
  }

  function renderHourTypeMatrix(data) {
    const container = document.getElementById('hour-type-matrix');
    if (!container) return;
    const types = APP_CONFIG.alertTypes.map(at => at.label);
    const matrix = {};
    types.forEach(t => {
      matrix[t] = new Array(24).fill(0);
    });
    data.forEach(r => {
      const h = r.timestamp.getHours();
      if (matrix[r.alertType] !== undefined) matrix[r.alertType][h]++;
    });
    const globalMax = Math.max(...Object.values(matrix).flat());

    container.innerHTML = '';
    types.forEach(type => {
      const row = document.createElement('div');
      row.className = 'htmatrix-row';
      const label = document.createElement('div');
      label.className = 'htmatrix-label';
      label.textContent = type.substring(0, 16);
      row.appendChild(label);
      matrix[type].forEach((count, h) => {
        const cell = document.createElement('div');
        cell.className = 'htmatrix-cell';
        const intensity = globalMax > 0 ? count / globalMax : 0;
        const alpha = 0.06 + intensity * 0.94;
        const typeConfig = APP_CONFIG.alertTypes.find(at => at.label === type);
        const color = typeConfig ? typeConfig.color : C.primary;
        cell.style.background = hexAlpha(color, alpha);
        cell.title = `${type} — שעה ${h}:00: ${count}`;
        row.appendChild(cell);
      });
      container.appendChild(row);
    });
  }

  // ── Page: Risk Index ──────────────────────────────────────────────────────

  function renderRiskPage() {
    // Populate area options
    const areaSel = document.getElementById('risk-area');
    if (areaSel && areaSel.options.length <= 1) {
      const areas = svc.getUniqueValues(allData, 'area');
      areas.forEach(a => {
        areaSel.appendChild(new Option(a, a));
      });
      // Also add regions
      APP_CONFIG.regions.forEach(r => {
        const opt = new Option(`[אזור] ${r.label}`, `__region__${r.id}`);
        opt.style.fontWeight = 'bold';
        areaSel.appendChild(opt);
      });
    }
    // Populate alert type options
    const typeSel = document.getElementById('risk-alerttype');
    if (typeSel && typeSel.options.length <= 1) {
      APP_CONFIG.alertTypes.forEach(at => {
        typeSel.appendChild(new Option(at.label, at.label));
      });
    }
  }

  function setupRiskIndexForm() {
    const form = document.getElementById('risk-form');
    if (!form) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      computeAndDisplayRiskIndex();
    });
  }

  function computeAndDisplayRiskIndex() {
    const areaRaw = document.getElementById('risk-area').value;
    const startDate = document.getElementById('risk-start').value;
    const endDate   = document.getElementById('risk-end').value;
    const hourStart = document.getElementById('risk-hour-start').value;
    const hourEnd   = document.getElementById('risk-hour-end').value;
    const alertType = document.getElementById('risk-alerttype').value;

    let area = areaRaw;
    let useRegion = false;
    if (areaRaw.startsWith('__region__')) {
      area = areaRaw.replace('__region__', '');
      useRegion = true;
    }

    const scopeData = useRegion
      ? allData.filter(r => r.region === area)
      : allData;

    const result = analytics.computeRiskIndex(scopeData, {
      area: useRegion ? null : area,
      startDate, endDate,
      hourStart: hourStart || null,
      hourEnd: hourEnd || null,
      alertType,
    });

    displayRiskResult(result, { area, startDate, endDate, hourStart, hourEnd, alertType });
  }

  function displayRiskResult(result, params) {
    const panel = document.getElementById('risk-result-panel');
    if (!panel) return;
    panel.style.display = '';

    const gauge = document.getElementById('risk-gauge-value');
    const ring  = document.getElementById('risk-gauge-ring');
    if (gauge) gauge.textContent = `${result.index}%`;
    if (ring) {
      const circumference = 2 * Math.PI * 45;
      const dash = (result.index / 100) * circumference;
      ring.style.strokeDasharray = `${dash} ${circumference}`;
      ring.style.stroke = riskColor(result.index);
    }

    setEl('risk-count',      `${result.count.toLocaleString('he-IL')} אירועים תואמים`);
    setEl('risk-days-range', `${result.totalDays} ימי טווח`);
    setEl('risk-days-alert', `${result.daysWithAlerts} ימים עם התרעה`);
    setEl('risk-formula',    result.formula);
    setEl('risk-confidence', `רמת ביטחון: ${result.confidenceHe || result.confidence}`);

    const warning = document.getElementById('risk-sparse-warning');
    if (warning) warning.style.display = result.sparseWarning ? '' : 'none';

    // render mini trend
    renderRiskMiniTrend(params);
  }

  function renderRiskMiniTrend(params) {
    destroyChartsForPage('risk');
    const areaRaw = params.area;
    let data = allData.filter(r => {
      if (areaRaw && areaRaw !== 'all') {
        if (r.area !== areaRaw && r.city !== areaRaw && r.region !== areaRaw) return false;
      }
      if (params.alertType && params.alertType !== 'all' && r.alertType !== params.alertType) return false;
      return true;
    });
    const monthlyObj = analytics.groupByMonth(data);
    const monthlyPairs = Object.entries(monthlyObj).sort(([a], [b]) => a.localeCompare(b));
    const ch = makeChart('chart-risk-trend', 'line', {
      labels: monthlyPairs.map(([k]) => formatMonth(k)),
      datasets: [{
        label: 'אירועים חודשיים',
        data: monthlyPairs.map(([, v]) => v),
        borderColor: C.accent,
        backgroundColor: hexAlpha(C.accent, 0.15),
        fill: true,
        tension: 0.4,
        pointRadius: 3,
      }],
    }, { plugins: { legend: { display: false } } });
    registerChart('risk', 'trend', ch);
  }

  function riskColor(index) {
    if (index >= 70) return '#e05252';
    if (index >= 40) return '#f0a500';
    if (index >= 20) return '#4a90d9';
    return '#2ecc71';
  }

  // ── UI Helpers ────────────────────────────────────────────────────────────

  function showLoading(visible) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = visible ? 'flex' : 'none';
  }

  function showError(msg) {
    const el = document.getElementById('error-toast');
    if (!el) { console.error(msg); return; }
    el.querySelector('.toast-msg').textContent = msg;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 5000);
  }

  function setEl(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function formatMonth(iso) {
    const [y, m] = iso.split('-');
    const months = ['','ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'];
    return `${months[parseInt(m)]} ${y.slice(2)}`;
  }

  function formatDateTime(d) {
    if (!d) return '--';
    return d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function hexAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function deepMerge(target, source) {
    const out = Object.assign({}, target);
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
          && source[key].constructor === Object) {
        out[key] = deepMerge(target[key] || {}, source[key]);
      } else if (source[key] !== undefined) {
        out[key] = source[key];
      }
    }
    return out;
  }

  // Expose for debugging
  window._APP = { allData: () => allData, filteredData: () => filteredData, analytics, filters };

})();
