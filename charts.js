'use strict';
/* =========================================================
   Kleine Liniendiagramme (SVG, ohne externe Bibliothek)
   lineChart({ points:[{date:'YYYY-MM-DD', y:Number, tip:'Text'}], color, unit, title })
   ========================================================= */

const CHART_W = 360, CHART_H = 190;
const PAD = { l: 34, r: 34, t: 14, b: 26 };

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || step0;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

const fmtNum = v => String(Math.round(v * 10) / 10).replace('.', ',');
const shortDate = iso => { const [, m, d] = iso.split('-'); return `${d}.${m}.`; };

function lineChart({ points, color = 'var(--accent)', unit = '', title = '', empty = 'Noch keine Daten für ein Diagramm.' }) {
  if (!points.length) return `<div class="empty">${empty}</div>`;
  const pts = points.slice().sort((a, b) => a.date.localeCompare(b.date));
  const t = pts.map(p => new Date(p.date + 'T12:00:00').getTime());
  // gleiche Tage leicht versetzen, damit sich Punkte nicht überdecken
  for (let i = 1; i < t.length; i++) if (t[i] <= t[i - 1]) t[i] = t[i - 1] + 3600e3 * 3;
  const tMin = t[0], tMax = t[t.length - 1];
  const ys = pts.map(p => p.y);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const yMin = ticks[0], yMax = ticks[ticks.length - 1];
  const iw = CHART_W - PAD.l - PAD.r, ih = CHART_H - PAD.t - PAD.b;
  const X = v => tMax === tMin ? PAD.l + iw / 2 : PAD.l + (v - tMin) / (tMax - tMin) * iw;
  const Y = v => PAD.t + ih - (v - yMin) / (yMax - yMin) * ih;

  const xy = pts.map((p, i) => [X(t[i]), Y(p.y)]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const area = pts.length > 1 ? `${line}L${xy[xy.length - 1][0].toFixed(1)},${PAD.t + ih}L${xy[0][0].toFixed(1)},${PAD.t + ih}Z` : '';
  const grid = ticks.map(v => `<line x1="${PAD.l}" x2="${CHART_W - PAD.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/>
    <text x="${PAD.l - 8}" y="${Y(v) + 4}" text-anchor="end" class="axis">${fmtNum(v)}</text>`).join('');
  const xLabels = pts.length === 1
    ? `<text x="${xy[0][0]}" y="${CHART_H - 8}" text-anchor="middle" class="axis">${shortDate(pts[0].date)}</text>`
    : `<text x="${PAD.l}" y="${CHART_H - 8}" text-anchor="start" class="axis">${shortDate(pts[0].date)}</text>
       <text x="${CHART_W - PAD.r}" y="${CHART_H - 8}" text-anchor="end" class="axis">${shortDate(pts[pts.length - 1].date)}</text>`;
  const dots = xy.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${color}" class="dot-ring"/>`).join('');
  const [lx, ly] = xy[xy.length - 1];
  const endLabel = `<text x="${lx + 8}" y="${ly + 4}" class="end-label">${fmtNum(pts[pts.length - 1].y)}</text>`;
  const data = esc(JSON.stringify(xy.map(([x, y], i) => ({ x, y, tip: pts[i].tip || `${fmtDate(pts[i].date)}: ${fmtNum(pts[i].y)} ${unit}` }))));

  return `<figure class="chart" data-points="${data}">
    ${title ? `<figcaption>${esc(title)}</figcaption>` : ''}
    <div class="chart-box">
      <svg viewBox="0 0 ${CHART_W} ${CHART_H}" role="img" aria-label="${esc(title || 'Verlauf')}">
        ${grid}
        ${area ? `<path d="${area}" fill="${color}" opacity=".1"/>` : ''}
        ${pts.length > 1 ? `<path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
        ${dots}${endLabel}${xLabels}
        <line class="crosshair" x1="0" x2="0" y1="${PAD.t}" y2="${PAD.t + ih}" style="display:none"/>
      </svg>
      <div class="chart-tip" style="display:none"></div>
    </div>
  </figure>`;
}

/* Crosshair + Tooltip (Maus und Finger) */
function chartPointer(ev) {
  const fig = ev.target.closest('.chart');
  if (!fig) return;
  const svg = fig.querySelector('svg');
  const rect = svg.getBoundingClientRect();
  const sx = (ev.clientX - rect.left) / rect.width * CHART_W;
  const pts = JSON.parse(fig.dataset.points);
  let best = pts[0];
  pts.forEach(p => { if (Math.abs(p.x - sx) < Math.abs(best.x - sx)) best = p; });
  const ch = fig.querySelector('.crosshair');
  ch.setAttribute('x1', best.x); ch.setAttribute('x2', best.x); ch.style.display = '';
  const tip = fig.querySelector('.chart-tip');
  tip.textContent = best.tip;
  tip.style.display = '';
  const px = best.x / CHART_W * rect.width, py = best.y / CHART_H * rect.height;
  tip.style.left = Math.min(Math.max(px, 70), rect.width - 70) + 'px';
  tip.style.top = Math.max(py - 44, 0) + 'px';
}
function chartLeave(ev) {
  const fig = ev.target.closest('.chart');
  if (!fig) return;
  fig.querySelector('.crosshair').style.display = 'none';
  fig.querySelector('.chart-tip').style.display = 'none';
}
document.addEventListener('pointermove', chartPointer);
document.addEventListener('pointerdown', chartPointer);
document.addEventListener('pointerout', ev => { if (ev.target.closest('.chart') && !ev.relatedTarget?.closest?.('.chart')) chartLeave(ev); });
