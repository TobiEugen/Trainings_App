'use strict';
/* =========================================================
   Trainings-Tracker – Fitness, Golf, Darts
   Daten liegen lokal im Browser (localStorage) des Geräts.
   ========================================================= */

const STORAGE_KEY = 'trainings-tracker-v1';

const AREAS = {
  fitness: { label: 'Fitness', icon: '💪' },
  golf:    { label: 'Golf',    icon: '⛳' },
  darts:   { label: 'Darts',   icon: '🎯' }
};
const GROUPS = {
  home:  { label: 'Homeworkout' },
  gym:   { label: 'Gym' },
  relax: { label: 'Entspannung' }
};
const CATS = { warmup: 'Warm-Up', cardio: 'Cardio', kraft: 'Krafttraining' };
const CAT_KEYS = Object.keys(CATS);
// Hinweis: Bei Cardio-Übungen steht im Feld "weight" die Stufe, in "time" die Zeit pro Satz (min).
const isCardio = x => x.cat === 'cardio';
const fmtVal = (cat, v) => (v === '' || v == null || isNaN(v)) ? '–' : cat === 'cardio' ? `Stufe ${String(v).replace('.', ',')}` : fmtWeight(v);
function exMeta(x) {
  return isCardio(x)
    ? `${x.sets} Sätze × ${x.time ?? '–'} min · Stufe ${x.weight ?? '–'}`
    : `${x.sets} Sätze × ${x.reps} Wdh · zuletzt ${fmtWeight(x.weight)}`;
}
function exLine(x, v) { // Zeile in Trainingsübersicht
  return isCardio(x)
    ? `${x.sets}× ${x.time ?? '–'} min${v != null ? ' @ Stufe ' + String(v).replace('.', ',') : ''}`
    : `${x.sets}×${x.reps}${v != null ? ' @ ' + fmtWeight(v) : ''}`;
}

/* ---------------- Speicher ---------------- */
function emptyState() { return { version: 1, entries: [], exercises: [], favorites: [], templates: [], activeGame: null, settings: { rangeMode: 'alle', rangeN: 10 } }; }

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const s = JSON.parse(raw);
    const base = emptyState();
    return { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) } };
  } catch (e) {
    console.warn('Laden fehlgeschlagen', e);
    return emptyState();
  }
}
let state = load();

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Speichern fehlgeschlagen!'); console.error(e); }
}

/* ---------------- Helfer ---------------- */
const $ = sel => document.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoDate(new Date());
const fmtDate = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtWeight = w => (w === '' || w == null || isNaN(w)) ? '–' : `${String(w).replace('.', ',')} kg`;
const num = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const byDateDesc = (a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || ''));

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}

/* ---------------- Navigation ---------------- */
const ui = {
  view: 'kalender',
  fitnessTab: 'home',
  calMonth: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })(),
  calSelected: today(),
  dartsStat: 'scoring18',
  dartsVariant: 'alle',
  ulStart: 'Upper',
  x01Input: '',
  x01Pending: null,
  gymChartEx: null
};

function navigate(view) {
  ui.view = view;
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.nav === view));
  render();
  window.scrollTo(0, 0);
}

function render() {
  const titles = { kalender: 'Kalender', fitness: 'Fitness', golf: 'Golf', darts: 'Darts' };
  $('#viewTitle').textContent = titles[ui.view];
  const v = $('#view');
  if (ui.view === 'kalender') v.innerHTML = renderCalendar();
  else if (ui.view === 'fitness') v.innerHTML = renderFitness();
  else if (ui.view === 'darts') v.innerHTML = renderDarts();
  else v.innerHTML = renderSimpleArea(ui.view);
}

/* ---------------- Kalender (Done-Liste) ---------------- */
function doneEntries() { return state.entries.filter(e => e.status !== 'planned'); }

function entryLabel(e) {
  if (e.area === 'fitness') return `${GROUPS[e.group]?.label || 'Fitness'}${e.title ? ' · ' + e.title : ''}`;
  return `${AREAS[e.area].label}${e.title ? ' · ' + e.title : ''}`;
}

function renderCalendar() {
  const m = ui.calMonth;
  const year = m.getFullYear(), month = m.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Montag = 0
  const start = new Date(year, month, 1 - startOffset);

  const byDay = {};
  doneEntries().forEach(e => (byDay[e.date] ||= []).push(e));

  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = isoDate(d);
    const list = byDay[iso] || [];
    const areas = [...new Set(list.map(e => e.area))];
    const cls = ['cal-day',
      d.getMonth() !== month ? 'other' : '',
      iso === today() ? 'today' : '',
      iso === ui.calSelected ? 'selected' : ''].join(' ');
    cells += `<button class="${cls}" data-action="cal-select" data-date="${iso}">
      ${d.getDate()}<span class="dots">${areas.map(a => `<i class="dot ${a}"></i>`).join('')}</span></button>`;
  }

  // Monatsstatistik
  const monthKey = `${year}-${pad(month + 1)}`;
  const inMonth = doneEntries().filter(e => e.date.startsWith(monthKey));
  const minutes = inMonth.reduce((s, e) => s + (Number(e.duration) || 0), 0);
  const days = new Set(inMonth.map(e => e.date)).size;

  const selList = (byDay[ui.calSelected] || []).slice().sort(byDateDesc);
  const monthName = m.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  return `
    <div class="stats">
      <div class="stat"><b>${inMonth.length}</b><small>Einheiten</small></div>
      <div class="stat"><b>${days}</b><small>Trainingstage</small></div>
      <div class="stat"><b>${(minutes / 60).toFixed(1).replace('.', ',')}</b><small>Stunden</small></div>
    </div>
    <div class="card">
      <div class="cal-head">
        <button class="icon-btn" data-action="cal-prev" aria-label="Vorheriger Monat">‹</button>
        <strong>${monthName}</strong>
        <button class="icon-btn" data-action="cal-next" aria-label="Nächster Monat">›</button>
      </div>
      <div class="cal-grid">
        ${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => `<div class="cal-dow">${d}</div>`).join('')}
        ${cells}
      </div>
      <div class="legend">
        <span><i class="dot fitness"></i>Fitness</span><span><i class="dot golf"></i>Golf</span><span><i class="dot darts"></i>Darts</span>
      </div>
    </div>
    <div class="section-title"><h3>${fmtDate(ui.calSelected)}</h3>
      <button class="btn small secondary" data-action="cal-today">Heute</button></div>
    ${selList.length ? selList.map(entryCard).join('') : '<div class="empty">An diesem Tag wurde nichts eingetragen.</div>'}
  `;
}

function entryCard(e) {
  const color = `var(--${e.area})`;
  let extra = '';
  if (e.group === 'gym' && e.exercises?.length) {
    extra = `<div class="meta" style="margin-top:4px">${e.exercises.length} Übungen</div>`;
  }
  return `<div class="card tap" data-action="open-entry" data-id="${e.id}">
    <div class="row"><div class="area-bar" style="background:${color}"></div><div class="grow">
      <div class="card-head"><span class="card-title">${AREAS[e.area].icon} ${esc(entryLabel(e))}</span>
        ${e.status === 'planned' ? '<span class="tag planned">geplant</span>' : ''}</div>
      <div class="meta">${fmtDate(e.date)}${e.duration ? ' · ' + e.duration + ' min' : ''}${e.game ? ' · ' + gameScoreText(e.game) : ''}</div>
      ${extra}
      ${e.notes ? `<div class="notes">${esc(e.notes)}</div>` : ''}
    </div></div></div>`;
}

/* ---------------- Fitness ---------------- */
function renderFitness() {
  const seg = `<div class="segmented">
    ${Object.entries(GROUPS).map(([k, g]) => `<button data-action="fitness-tab" data-tab="${k}" class="${ui.fitnessTab === k ? 'active' : ''}">${g.label}</button>`).join('')}
  </div>`;
  if (ui.fitnessTab === 'gym') return seg + renderGym();
  return seg + renderVideoGroup(ui.fitnessTab);
}

function renderVideoGroup(group) {
  const list = state.entries.filter(e => e.area === 'fitness' && e.group === group).sort(byDateDesc);
  return `
    <button class="btn block" data-action="new-entry" data-area="fitness" data-group="${group}">+ Neue Einheit</button>
    ${renderFavorites(group)}
    <div class="section-title"><h3>Verlauf</h3><span class="meta">${list.length} Einträge</span></div>
    ${list.length ? list.map(videoCard).join('') : '<div class="empty">Noch keine Einheiten. Leg deine erste an!</div>'}
  `;
}

function renderFavorites(group) {
  const favs = state.favorites.filter(f => f.group === group).sort((a, b) => a.title.localeCompare(b.title));
  if (!favs.length) return `<p class="hint" style="margin-top:12px">⭐ Tipp: Beim Eintragen kannst du ein Video als Lieblingsvideo speichern.</p>`;
  return `<div class="section-title"><h3>⭐ Lieblingsvideos</h3></div>` + favs.map(f => `
    <div class="card">
      <div class="card-head"><span class="card-title">${esc(f.title)}</span><span class="meta">${f.duration ? f.duration + ' min' : ''}</span></div>
      ${f.link ? `<a class="link" href="${esc(f.link)}" target="_blank" rel="noopener" data-stop>▶ Video öffnen</a>` : ''}
      <div class="btn-row">
        <button class="btn secondary small" data-action="delete-fav" data-id="${f.id}">Entfernen</button>
        <button class="btn small" data-action="new-from-fav" data-id="${f.id}">+ Heute eintragen</button>
      </div>
    </div>`).join('');
}

function videoCard(e) {
  return `<div class="card tap" data-action="open-entry" data-id="${e.id}">
    <div class="card-head"><span class="card-title">${esc(e.title || 'Ohne Titel')}</span><span class="meta">${e.duration ? e.duration + ' min' : ''}</span></div>
    <div class="meta">${fmtDate(e.date)}${e.game ? ' · <b>' + gameScoreText(e.game) + '</b>' : ''}</div>
    ${e.link ? `<a class="link" href="${esc(e.link)}" target="_blank" rel="noopener" data-stop>▶ Video öffnen</a>` : ''}
    ${e.notes ? `<div class="notes">${esc(e.notes)}</div>` : ''}
  </div>`;
}

/* ---------------- Gym ---------------- */
function renderGym() {
  const planned = state.entries.filter(e => e.group === 'gym' && e.status === 'planned').sort((a, b) => a.date.localeCompare(b.date));
  const done = state.entries.filter(e => e.group === 'gym' && e.status !== 'planned').sort(byDateDesc);

  return `
    <div class="btn-row" style="margin-top:0">
      <button class="btn" data-action="plan-gym">+ Training planen</button>
      <button class="btn secondary" data-action="manage-exercises">Übungen (${state.exercises.length})</button>
    </div>

    ${state.templates.length ? `<div class="section-title"><h3>📋 Vorlagen</h3></div>` + state.templates.slice().sort((a, b) => a.name.localeCompare(b.name)).map(t => {
      const names = t.exIds.map(id => state.exercises.find(x => x.id === id)?.name).filter(Boolean);
      return `<div class="card">
        <div class="card-head"><span class="card-title">${esc(t.name)}</span><span class="meta">${names.length} Übungen</span></div>
        <div class="meta">${esc(names.join(', '))}</div>
        <div class="btn-row">
          <button class="btn secondary small" data-action="delete-template" data-id="${t.id}">Löschen</button>
          <button class="btn small" data-action="plan-from-template" data-id="${t.id}">Damit planen</button>
        </div></div>`;
    }).join('') : ''}

    <div class="section-title"><h3>Geplant</h3></div>
    ${planned.length ? planned.map(e => `
      <div class="card">
        <div class="card-head"><span class="card-title">${esc(e.title || 'Gym-Training')}</span><span class="tag planned">geplant</span></div>
        <div class="meta">${fmtDate(e.date)} · ${e.exercises.length} Übungen</div>
        ${gymExerciseSummary(e, false)}
        <div class="btn-row">
          <button class="btn secondary small" data-action="plan-gym" data-id="${e.id}">Bearbeiten</button>
          <button class="btn small" data-action="finish-gym" data-id="${e.id}">✓ Training abschließen</button>
        </div>
      </div>`).join('') : '<div class="empty">Kein Training geplant.</div>'}

    ${renderGymProgress()}

    <div class="section-title"><h3>Absolviert</h3><span class="meta">${done.length} Trainings</span></div>
    ${done.length ? done.map(e => `
      <div class="card tap" data-action="open-entry" data-id="${e.id}">
        <div class="card-head"><span class="card-title">${esc(e.title || 'Gym-Training')}</span><span class="meta">${e.duration ? e.duration + ' min' : ''}</span></div>
        <div class="meta">${fmtDate(e.date)}</div>
        ${gymExerciseSummary(e, true)}
        ${e.notes ? `<div class="notes">${esc(e.notes)}</div>` : ''}
      </div>`).join('') : '<div class="empty">Noch kein Training abgeschlossen.</div>'}
  `;
}

function renderGymProgress() {
  const withHist = state.exercises.filter(x => x.history?.length).sort((a, b) => a.name.localeCompare(b.name));
  if (!withHist.length) return '';
  if (!withHist.some(x => x.id === ui.gymChartEx)) ui.gymChartEx = withHist[0].id;
  const x = withHist.find(y => y.id === ui.gymChartEx);
  return `<div class="section-title"><h3>📈 Fortschritt</h3></div>
    <select id="gymChartPick" data-change="gym-chart">${withHist.map(y => `<option value="${y.id}" ${y.id === x.id ? 'selected' : ''}>${esc(y.name)}</option>`).join('')}</select>
    ${rangeControl('Trainings')}
    ${exChart({ ...x, history: applyRange(x.history.slice().sort((a, b) => a.date.localeCompare(b.date))) })}`;
}

/* Zeitraum-Filter für Statistiken: alle / letzte N Einträge / letzte N Tage */
function applyRange(list) { // list aufsteigend nach Datum sortiert
  const { rangeMode, rangeN } = state.settings;
  const n = Math.max(1, parseInt(rangeN, 10) || 1);
  if (rangeMode === 'anzahl') return list.slice(-n);
  if (rangeMode === 'tage') {
    const d = new Date(); d.setDate(d.getDate() - (n - 1));
    const from = isoDate(d);
    return list.filter(x => x.date >= from);
  }
  return list;
}
function rangeControl(noun) {
  const { rangeMode, rangeN } = state.settings;
  return `<div class="range-ctl">
    <span class="meta">Zeige</span>
    <select data-change="range-mode" aria-label="Zeitraum">
      <option value="alle" ${rangeMode === 'alle' ? 'selected' : ''}>alle</option>
      <option value="anzahl" ${rangeMode === 'anzahl' ? 'selected' : ''}>die letzten … ${noun}</option>
      <option value="tage" ${rangeMode === 'tage' ? 'selected' : ''}>die letzten … Tage</option>
    </select>
    ${rangeMode === 'alle' ? '' : `<input type="number" inputmode="numeric" min="1" value="${rangeN}" data-change="range-n" aria-label="Anzahl">`}
  </div>`;
}

function gymExerciseSummary(e, showAchieved) {
  const parts = CAT_KEYS.map(cat => {
    const list = e.exercises.filter(x => x.cat === cat);
    if (!list.length) return '';
    return `<div class="cat-label">${CATS[cat]}</div>` + list.map(x => {
      if (isCardio(x)) {
        const status = showAchieved ? (x.done === false ? ' – ✗ ausgelassen' : ' – ✓ erledigt') : '';
        return `<div class="meta">• ${esc(x.name)} – ${exLine(x, x.plannedWeight)}${status}</div>`;
      }
      const w = showAchieved ? x.achievedWeight : x.plannedWeight;
      const trend = showAchieved && x.achievedWeight != null && x.plannedWeight != null
        ? (x.achievedWeight > x.plannedWeight ? ' ⬆' : x.achievedWeight < x.plannedWeight ? ' ⬇' : '') : '';
      return `<div class="meta">• ${esc(x.name)} – ${exLine(x, w)}${trend}</div>`;
    }).join('');
  });
  return parts.join('');
}

/* ---------------- Golf / Darts ---------------- */
function renderSimpleArea(area) {
  const list = state.entries.filter(e => e.area === area).sort(byDateDesc);
  return `
    <p class="hint">Einfache Einträge für ${AREAS[area].label}. Spezielle Funktionen bauen wir später aus.</p>
    <button class="btn block" data-action="new-entry" data-area="${area}">+ Neue Einheit</button>
    <div class="section-title"><h3>Verlauf</h3><span class="meta">${list.length} Einträge</span></div>
    ${list.length ? list.map(videoCard).join('') : '<div class="empty">Noch keine Einheiten.</div>'}
  `;
}

/* ---------------- Modal ---------------- */
function openModal(title, html) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modalBody').innerHTML = '';
  document.body.style.overflow = '';
}

/* Einfache Einheit (Homeworkout, Entspannung, Golf, Darts) */
function entryForm(e) {
  const isVideo = e.area === 'fitness';
  const titleLabel = isVideo ? 'Was hast du gemacht? (z. B. Video-Titel)' : 'Was hast du trainiert?';
  const favs = isVideo ? state.favorites.filter(f => f.group === e.group) : [];
  const favSelect = favs.length ? `<label class="field"><span>⭐ Aus Lieblingsvideos wählen</span><select id="favPick">
      <option value="">– auswählen –</option>
      ${favs.map(f => `<option value="${f.id}">${esc(f.title)}</option>`).join('')}</select></label>` : '';
  return `<form id="entryForm">
    <label class="field"><span>Datum</span><input type="date" name="date" value="${e.date}" required></label>
    ${favSelect}
    <label class="field"><span>${titleLabel}</span><input name="title" value="${esc(e.title)}" placeholder="${isVideo ? 'z. B. 30 Min Ganzkörper' : 'z. B. Driving Range'}"></label>
    ${isVideo ? `<label class="field"><span>YouTube-Link (optional)</span><input type="url" name="link" value="${esc(e.link)}" placeholder="https://youtube.com/…"></label>` : ''}
    ${e.area === 'darts' ? '' : `<label class="field"><span>Dauer (Minuten)</span><input type="number" inputmode="numeric" min="0" name="duration" value="${e.duration ?? ''}"></label>`}
    <label class="field"><span>Besondere Vorkommnisse / Notizen</span><textarea name="notes" placeholder="z. B. Knie gezwickt, sehr gut gelaufen …">${esc(e.notes)}</textarea></label>
    ${isVideo ? `<label class="ex-row" style="border:0"><input type="checkbox" name="saveFav"><span>⭐ Als Lieblingsvideo speichern</span></label>` : ''}
    <button class="btn block" type="submit">Speichern</button>
    ${e.id ? `<div class="btn-row"><button class="btn danger" type="button" data-action="delete-entry" data-id="${e.id}">Löschen</button></div>` : ''}
  </form>`;
}

function openEntry(e) {
  if (e.game) return openGameResult(e);
  if (e.group === 'gym') return e.status === 'planned' ? openPlanGym(e.id) : openFinishGym(e.id);
  const title = e.area === 'fitness' ? GROUPS[e.group].label : AREAS[e.area].label;
  openModal(e.id ? `${title} bearbeiten` : `Neue Einheit – ${title}`, entryForm(e));
  const pick = $('#favPick');
  if (pick) pick.onchange = () => {
    const f = state.favorites.find(x => x.id === pick.value); if (!f) return;
    const form = $('#entryForm');
    form.title.value = f.title; form.link.value = f.link || '';
    if (f.duration != null) form.duration.value = f.duration;
  };
  $('#entryForm').onsubmit = ev => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const data = {
      ...e,
      id: e.id || uid(),
      createdAt: e.createdAt || new Date().toISOString(),
      date: f.get('date'),
      title: f.get('title').trim(),
      link: (f.get('link') || '').trim(),
      duration: e.area === 'darts' ? null : num(f.get('duration')),
      notes: f.get('notes').trim(),
      status: 'done'
    };
    upsertEntry(data);
    if (f.get('saveFav') && data.title) {
      const dup = state.favorites.find(x => x.group === data.group && (x.link ? x.link === data.link : x.title === data.title));
      if (dup) Object.assign(dup, { title: data.title, link: data.link, duration: data.duration });
      else state.favorites.push({ id: uid(), group: data.group, title: data.title, link: data.link, duration: data.duration });
      save();
    }
    closeModal(); render(); toast('Gespeichert ✓');
  };
}

function upsertEntry(data) {
  const i = state.entries.findIndex(x => x.id === data.id);
  if (i >= 0) state.entries[i] = data; else state.entries.push(data);
  save();
}

/* Übungen verwalten */
function openExercises() {
  const list = cat => state.exercises.filter(x => x.cat === cat).sort((a, b) => a.name.localeCompare(b.name));
  const block = cat => `<div class="cat-label">${CATS[cat]}</div>` + (list(cat).length ? list(cat).map(x => `
    <div class="ex-row">
      <div class="grow"><div class="card-title">${esc(x.name)}</div>
        <div class="meta">${exMeta(x)}</div></div>
      <button class="btn secondary small" data-action="edit-exercise" data-id="${x.id}">Bearbeiten</button>
    </div>`).join('') : '<div class="meta" style="padding:8px 0">Noch keine Übungen.</div>');
  openModal('Meine Übungen', `
    <button class="btn block" data-action="edit-exercise">+ Neue Übung</button>
    ${CAT_KEYS.map(block).join('')}
  `);
}

function exFields(x) {
  const sets = `<label class="field"><span>Sätze</span><input type="number" inputmode="numeric" min="1" name="sets" value="${x.sets ?? 3}" required></label>`;
  if (isCardio(x)) return sets +
    `<label class="field"><span>Zeit/Satz (min)</span><input inputmode="decimal" name="time" value="${x.time ?? ''}" placeholder="z. B. 5"></label>
     <label class="field"><span>Stufe</span><input inputmode="decimal" name="weight" value="${x.weight ?? ''}" placeholder="–"></label>`;
  return sets +
    `<label class="field"><span>Wiederh.</span><input type="number" inputmode="numeric" min="1" name="reps" value="${x.reps ?? 10}" required></label>
     <label class="field"><span>Letztes Gew. (kg)</span><input inputmode="decimal" name="weight" value="${x.weight ?? ''}" placeholder="–"></label>`;
}

function exChart(x) {
  const cardio = isCardio(x);
  return `<div class="card" style="background:var(--bg);margin-top:6px">${lineChart({
    points: (x.history || []).map(h => ({ date: h.date, y: h.weight, tip: `${fmtDate(h.date)}: ${fmtVal(x.cat, h.weight)}` })),
    color: cardio ? 'var(--golf)' : 'var(--fitness)',
    title: cardio ? `${x.name} – Stufe über Zeit` : `${x.name} – Gewicht über Zeit (kg)`
  })}</div>`;
}

function openExerciseForm(id) {
  const x = state.exercises.find(e => e.id === id) || { name: '', cat: 'kraft', sets: 3, reps: 10, weight: null, history: [] };
  openModal(id ? 'Übung bearbeiten' : 'Neue Übung', `<form id="exForm">
    <label class="field"><span>Name</span><input name="name" value="${esc(x.name)}" required placeholder="z. B. Bankdrücken"></label>
    <label class="field"><span>Kategorie</span><select name="cat">
      ${Object.entries(CATS).map(([k, l]) => `<option value="${k}" ${x.cat === k ? 'selected' : ''}>${l}</option>`).join('')}
    </select></label>
    <div class="grid-3" id="exFields">${exFields(x)}</div>
    ${x.history?.length ? exChart(x) : ''}
    <div class="btn-row">
      <button class="btn secondary" type="button" data-action="manage-exercises">Zurück</button>
      <button class="btn" type="submit">Speichern</button>
    </div>
    ${id ? `<div class="btn-row"><button class="btn danger" type="button" data-action="delete-exercise" data-id="${id}">Übung löschen</button></div>` : ''}
  </form>`);
  const catSel = $('#exForm [name=cat]');
  catSel.onchange = () => { $('#exFields').innerHTML = exFields({ ...x, cat: catSel.value }); };
  $('#exForm').onsubmit = ev => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const data = { ...x, id: x.id || uid(), name: f.get('name').trim(), cat: f.get('cat'),
      sets: num(f.get('sets')) || 1, weight: num(f.get('weight')) };
    if (data.cat === 'cardio') data.time = num(f.get('time')); else data.reps = num(f.get('reps')) || 1;
    const i = state.exercises.findIndex(e => e.id === data.id);
    if (i >= 0) state.exercises[i] = data; else state.exercises.push(data);
    save(); openExercises(); render(); toast('Übung gespeichert ✓');
  };
}

/* Gym-Training planen: Übungen auswählen */
function openPlanGym(id, templateId) {
  if (!state.exercises.length) {
    toast('Leg zuerst deine Übungen an');
    return openExerciseForm();
  }
  const tpl = state.templates.find(t => t.id === templateId);
  const e = state.entries.find(x => x.id === id) || { date: today(), title: tpl ? tpl.name : '', exercises: [] };
  const chosen = new Set(tpl ? tpl.exIds : e.exercises.map(x => x.exId));
  const block = cat => {
    const list = state.exercises.filter(x => x.cat === cat).sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) return '';
    return `<div class="cat-label">${CATS[cat]}</div>` + list.map(x => `
      <label class="ex-row">
        <input type="checkbox" name="ex" value="${x.id}" ${chosen.has(x.id) ? 'checked' : ''}>
        <div class="grow"><div class="card-title">${esc(x.name)}</div>
          <div class="meta">${exMeta(x)}</div></div>
      </label>`).join('');
  };
  openModal(id ? 'Training bearbeiten' : 'Gym-Training planen', `<form id="planForm">
    <div class="grid-2">
      <label class="field"><span>Datum</span><input type="date" name="date" value="${e.date}" required></label>
      <label class="field"><span>Name (optional)</span><input name="title" value="${esc(e.title)}" placeholder="z. B. Push-Tag"></label>
    </div>
    ${state.templates.length ? `<label class="field"><span>📋 Vorlage laden</span><select id="tplPick">
      <option value="">– auswählen –</option>
      ${state.templates.map(t => `<option value="${t.id}" ${tpl && tpl.id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>` : ''}
    <p class="hint">Wähle die Übungen für dieses Training:</p>
    ${CAT_KEYS.map(block).join('')}
    <label class="ex-row" style="border:0;margin-top:8px"><input type="checkbox" name="saveTpl"><span>📋 Als Vorlage speichern (Name = Trainingsname)</span></label>
    <button class="btn block" type="submit" style="margin-top:8px">Training speichern</button>
    ${id ? `<div class="btn-row"><button class="btn danger" type="button" data-action="delete-entry" data-id="${id}">Training löschen</button></div>` : ''}
  </form>`);
  const tplPick = $('#tplPick');
  if (tplPick) tplPick.onchange = () => {
    const t = state.templates.find(x => x.id === tplPick.value); if (!t) return;
    const form = $('#planForm');
    form.querySelectorAll('input[name=ex]').forEach(cb => { cb.checked = t.exIds.includes(cb.value); });
    if (!form.title.value.trim()) form.title.value = t.name;
  };
  $('#planForm').onsubmit = ev => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const ids = f.getAll('ex');
    if (!ids.length) return toast('Bitte mindestens eine Übung wählen');
    if (f.get('saveTpl')) {
      const name = f.get('title').trim();
      if (!name) return toast('Bitte einen Namen für die Vorlage eingeben');
      const dup = state.templates.find(t => t.name.toLowerCase() === name.toLowerCase());
      if (dup) dup.exIds = ids; else state.templates.push({ id: uid(), name, exIds: ids });
    }
    const exercises = ids.map(exId => {
      const old = e.exercises.find(x => x.exId === exId);
      if (old) return old;
      const x = state.exercises.find(y => y.id === exId);
      return { exId, name: x.name, cat: x.cat, sets: x.sets, reps: x.reps, time: x.time, plannedWeight: x.weight, achievedWeight: null };
    });
    upsertEntry({ ...e, id: e.id || uid(), createdAt: e.createdAt || new Date().toISOString(),
      area: 'fitness', group: 'gym', status: 'planned', date: f.get('date'), title: f.get('title').trim(), exercises });
    closeModal(); render(); toast('Training geplant ✓');
  };
}

/* Gym-Training abschließen: geschaffte Gewichte eintragen */
function openFinishGym(id) {
  const e = state.entries.find(x => x.id === id);
  if (!e) return;
  const block = cat => {
    const list = e.exercises.filter(x => x.cat === cat);
    if (!list.length) return '';
    return `<div class="cat-label">${CATS[cat]}</div>` + list.map((x) => `
      <div class="ex-row">
        <div class="grow"><div class="card-title">${esc(x.name)}</div>
          <div class="meta">${isCardio(x) ? exLine(x, x.plannedWeight) : `${exLine(x, null)} · geplant ${fmtVal(x.cat, x.plannedWeight)}`}</div></div>
        ${isCardio(x)
          ? `<label class="done-check"><input type="checkbox" name="c_${x.exId}" ${x.done === false ? '' : 'checked'}> erledigt</label>`
          : `<input inputmode="decimal" name="w_${x.exId}" value="${x.achievedWeight ?? x.plannedWeight ?? ''}" placeholder="kg" aria-label="Geschafft ${esc(x.name)}" style="width:90px">`}
      </div>`).join('');
  };
  const isDone = e.status !== 'planned';
  openModal(isDone ? 'Training bearbeiten' : 'Training abschließen', `<form id="finishForm">
    <label class="field"><span>Datum</span><input type="date" name="date" value="${e.date}" required></label>
    <p class="hint">Kraft: geschafftes Gewicht (kg) eintragen · Cardio: abhaken, wenn erledigt</p>
    ${CAT_KEYS.map(block).join('')}
    <label class="field" style="margin-top:14px"><span>Dauer (Minuten)</span><input type="number" inputmode="numeric" min="0" name="duration" value="${e.duration ?? ''}"></label>
    <label class="field"><span>Besondere Vorkommnisse / Notizen</span><textarea name="notes">${esc(e.notes)}</textarea></label>
    <button class="btn block" type="submit">${isDone ? 'Speichern' : '✓ Abschließen'}</button>
    <div class="btn-row"><button class="btn danger" type="button" data-action="delete-entry" data-id="${e.id}">Training löschen</button></div>
  </form>`);
  $('#finishForm').onsubmit = ev => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const date = f.get('date');
    e.exercises.forEach(x => {
      if (isCardio(x)) x.done = !!f.get('c_' + x.exId);
      else x.achievedWeight = num(f.get('w_' + x.exId));
    });
    Object.assign(e, { date, duration: num(f.get('duration')), notes: f.get('notes').trim(), status: 'done' });
    // Übungsbibliothek aktualisieren: "letztes Gewicht" + Verlauf
    e.exercises.forEach(x => {
      const lib = state.exercises.find(y => y.id === x.exId);
      if (!lib || isCardio(x) || x.achievedWeight == null) return;
      lib.history = (lib.history || []).filter(h => h.entryId !== e.id);
      lib.history.push({ date, weight: x.achievedWeight, entryId: e.id });
      lib.history.sort((a, b) => a.date.localeCompare(b.date));
      lib.weight = lib.history[lib.history.length - 1].weight;
    });
    save(); closeModal(); render(); toast(isDone ? 'Gespeichert ✓' : 'Stark! Training erledigt 💪');
  };
}

/* Einstellungen: Backup */
function openSettings() {
  const n = state.entries.length;
  openModal('Einstellungen & Backup', `
    <p class="hint">Deine Daten liegen nur auf diesem Gerät. Mit einem Backup überträgst du sie z. B. vom PC aufs iPhone – oder sicherst sie.</p>
    <div class="card"><div class="card-title">Daten exportieren</div>
      <div class="meta">${n} Einheiten, ${state.exercises.length} Übungen</div>
      <div class="btn-row"><button class="btn" data-action="export">Backup herunterladen</button></div></div>
    <div class="card"><div class="card-title">Daten importieren</div>
      <div class="meta">Ersetzt die Daten auf diesem Gerät durch das Backup.</div>
      <div class="btn-row"><label class="btn secondary" style="cursor:pointer">Backup-Datei wählen
        <input type="file" accept="application/json,.json" id="importFile" hidden></label></div></div>
  `);
  $('#importFile').onchange = ev => {
    const file = ev.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!Array.isArray(data.entries) || !Array.isArray(data.exercises)) throw new Error('Format');
        if (!confirm(`Backup mit ${data.entries.length} Einheiten importieren? Die aktuellen Daten werden ersetzt.`)) return;
        const base = emptyState();
        state = { ...base, ...data, settings: { ...base.settings, ...(data.settings || {}) } }; save(); closeModal(); render(); toast('Backup importiert ✓');
      } catch { toast('Ungültige Backup-Datei'); }
    };
    r.readAsText(file);
  };
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `training-backup-${today()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------------- Events ---------------- */
document.addEventListener('click', ev => {
  if (ev.target.closest('[data-stop]')) return; // Links normal öffnen
  const nav = ev.target.closest('[data-nav]');
  if (nav) return navigate(nav.dataset.nav);
  if (ev.target.closest('[data-close]') || ev.target.id === 'modal') return closeModal();

  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;
  switch (action) {
    case 'cal-prev': ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() - 1, 1); render(); break;
    case 'cal-next': ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() + 1, 1); render(); break;
    case 'cal-select': ui.calSelected = el.dataset.date; render(); break;
    case 'cal-today': { const d = new Date(); ui.calMonth = new Date(d.getFullYear(), d.getMonth(), 1); ui.calSelected = today(); render(); break; }
    case 'fitness-tab': ui.fitnessTab = el.dataset.tab; render(); break;
    case 'new-entry': openEntry({ area: el.dataset.area, group: el.dataset.group || null, date: today(), title: '', notes: '', link: '' }); break;
    case 'open-entry': { const e = state.entries.find(x => x.id === id); if (e) openEntry(e); break; }
    case 'delete-entry':
      if (confirm('Diesen Eintrag wirklich löschen?')) {
        state.entries = state.entries.filter(x => x.id !== id);
        state.exercises.forEach(x => {
          if (!x.history) return;
          const before = x.history.length;
          x.history = x.history.filter(h => h.entryId !== id);
          // "zuletzt"-Wert auf den neuesten verbleibenden Eintrag zurücksetzen
          if (x.history.length !== before && x.history.length) x.weight = x.history[x.history.length - 1].weight;
        });
        save(); closeModal(); render(); toast('Gelöscht');
      }
      break;
    case 'plan-gym': openPlanGym(id); break;
    case 'plan-from-template': openPlanGym(null, id); break;
    case 'delete-template':
      if (confirm('Vorlage löschen?')) { state.templates = state.templates.filter(t => t.id !== id); save(); render(); }
      break;
    case 'new-from-fav': {
      const fav = state.favorites.find(x => x.id === id); if (!fav) break;
      openEntry({ area: 'fitness', group: fav.group, date: today(), title: fav.title, link: fav.link, duration: fav.duration, notes: '' });
      break;
    }
    case 'delete-fav':
      if (confirm('Aus den Lieblingsvideos entfernen?')) { state.favorites = state.favorites.filter(x => x.id !== id); save(); render(); }
      break;
    case 'finish-gym': openFinishGym(id); break;
    case 'manage-exercises': openExercises(); break;
    case 'edit-exercise': openExerciseForm(id); break;
    case 'delete-exercise':
      if (confirm('Übung löschen? Vergangene Trainings bleiben erhalten.')) {
        state.exercises = state.exercises.filter(x => x.id !== id); save(); openExercises(); render();
      }
      break;
    case 'export': exportData(); break;
    default: handleDartsAction(action, el);
  }
});
$('#settingsBtn').onclick = openSettings;
document.addEventListener('change', ev => {
  const c = ev.target.dataset.change;
  if (c === 'gym-chart') { ui.gymChartEx = ev.target.value; render(); }
  if (c === 'range-mode') { state.settings.rangeMode = ev.target.value; save(); render(); }
  if (c === 'range-n') { const n = parseInt(ev.target.value, 10); if (n > 0) { state.settings.rangeN = n; save(); } render(); }
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeModal(); });

/* ---------------- Start ---------------- */
render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW', err));
}
