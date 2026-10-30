/**
 * ============================================================================
 * COMERSYS — MOTOR DE GRÁFICOS VECTORIALES (SVG PURO)
 * ============================================================================
 * Genera gráficos empresariales limpios y responsivos:
 * 1. Línea de tendencia de ventas de los últimos 7 días (Dashboard).
 * 2. Barras comparativas de Ingresos vs Egresos (Finanzas).
 */
(function (global) {
  'use strict';

  const { Formatters } = global.ComerSys.Core;

  const Charts = {
    /**
     * Renderiza el gráfico de línea y área para "Ventas de los últimos 7 días".
     */
    renderSalesLineChart(container, series) {
      if (!container) return;
      const width = 560;
      const height = 225;
      const padLeft = 58;
      const padRight = 22;
      const padTop = 20;
      const padBottom = 34;
      const plotW = width - padLeft - padRight;
      const plotH = height - padTop - padBottom;

      const values = series.map((d) => Number(d.sold || 0));
      const maxVal = Math.max(...values, 1000);
      const niceMax = Math.ceil(maxVal / 4) * 4 || 1000;

      const getX = (idx) =>
        padLeft + (series.length > 1 ? (idx / (series.length - 1)) * plotW : plotW / 2);
      const getY = (val) => padTop + plotH - (val / niceMax) * plotH;

      // Líneas de grilla horizontales
      let gridLines = '';
      for (let step = 0; step <= 3; step++) {
        const val = (niceMax / 3) * step;
        const y = getY(val).toFixed(1);
        const label =
          val >= 1000
            ? `$${Math.round(val / 1000)}k`
            : `$${Math.round(val)}`;
        gridLines += `
          <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="var(--border-subtle)" stroke-width="1"/>
          <text x="${padLeft - 10}" y="${Number(y) + 4}" text-anchor="end" fill="var(--text-light)" font-size="11">${label}</text>
        `;
      }

      const points = series.map((d, idx) => ({
        x: Number(getX(idx).toFixed(1)),
        y: Number(getY(d.sold).toFixed(1)),
        label: d.label,
        sold: d.sold
      }));

      const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
      const areaPath =
        points.length > 0
          ? `M ${points[0].x},${padTop + plotH} L ` +
            points.map((p) => `${p.x},${p.y}`).join(' L ') +
            ` L ${points[points.length - 1].x},${padTop + plotH} Z`
          : '';

      const dotsAndLabels = points
        .map(
          (p) => `
          <g>
            <circle cx="${p.x}" cy="${p.y}" r="4.2" fill="#2563EB" stroke="var(--bg-surface)" stroke-width="2">
              <title>${p.label}: ${Formatters.currency(p.sold)}</title>
            </circle>
            <text x="${p.x}" y="${height - 10}" text-anchor="middle" fill="var(--text-muted)" font-size="11">${p.label}</text>
          </g>
        `
        )
        .join('');

      container.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="max-height:190px;overflow:visible;">
          <defs>
            <linearGradient id="comersysSalesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#2563EB" stop-opacity="0.24"/>
              <stop offset="100%" stop-color="#2563EB" stop-opacity="0.0"/>
            </linearGradient>
          </defs>
          ${gridLines}
          <path d="${areaPath}" fill="url(#comersysSalesGrad)"/>
          <polyline fill="none" stroke="#2563EB" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" points="${polylinePoints}"/>
          ${dotsAndLabels}
        </svg>
      `;
    },

    /**
     * Renderiza el gráfico de barras comparativo "Ingresos vs Egresos" (Finanzas).
     */
    renderIncomeExpenseBars(container, series) {
      if (!container) return;
      const width = 340;
      const height = 115;
      const padBottom = 22;
      const padTop = 8;
      const plotH = height - padBottom - padTop;

      const maxVal = Math.max(
        ...series.map((s) => Math.max(Number(s.income || 0), Number(s.expense || 0))),
        100
      );

      const groupWidth = width / series.length;
      const barWidth = Math.min(12, Math.floor(groupWidth * 0.32));

      let barsHtml = '';
      series.forEach((item, idx) => {
        const centerX = idx * groupWidth + groupWidth / 2;
        const incH = Math.max(3, Math.round((Number(item.income || 0) / maxVal) * plotH));
        const expH = Math.max(3, Math.round((Number(item.expense || 0) / maxVal) * plotH));

        const incY = padTop + plotH - incH;
        const expY = padTop + plotH - expH;

        barsHtml += `
          <g>
            <rect x="${centerX - barWidth - 1.5}" y="${incY}" width="${barWidth}" height="${incH}" rx="2.5" fill="#2563EB">
              <title>${item.label} — Ingresos: ${Formatters.currency(item.income)}</title>
            </rect>
            <rect x="${centerX + 1.5}" y="${expY}" width="${barWidth}" height="${expH}" rx="2.5" fill="#93C5FD">
              <title>${item.label} — Egresos: ${Formatters.currency(item.expense)}</title>
            </rect>
            <text x="${centerX}" y="${height - 5}" text-anchor="middle" fill="var(--text-muted)" font-size="9.5">${item.label.split(' ')[0]}</text>
          </g>
        `;
      });

      container.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="115">
          <line x1="0" y1="${padTop + plotH}" x2="${width}" y2="${padTop + plotH}" stroke="var(--border-color)" stroke-width="1"/>
          ${barsHtml}
        </svg>
      `;
    }
  };

  global.ComerSys.UI.Charts = Charts;
})(window);
