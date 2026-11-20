'use strict';
/* =========================================================
   Darts: Trainingsspiele, Statistiken, Verlauf
   ========================================================= */

// SO/SU = richtiges Feld drüber/drunter, ML/MR = Ausreißer links/rechts (S/M = ältere Spiele ohne Richtung)
const DART_POINTS = { T: 2, D: 1, SO: 0, SU: 0, S: 0, ML: -1, MR: -1, M: -1 };
const DART_LABELS = { T: 'Triple', D: 'Doppel', SO: 'Feld drüber', SU: 'Feld drunter', S: 'Feld', ML: 'Links daneben', MR: 'Rechts daneben', M: 'Daneben' };
const DART_SHORT = { T: 'Triple', D: 'Doppel', SO: 'Feld ⬆', SU: 'Feld ⬇', S: 'Feld', ML: '⬅ links', MR: 'rechts ➡', M: 'daneben' };
const dartClass = d => d === 'T' ? 'T' : d === 'D' ? 'D' : d[0] === 'M' ? 'M' : 'S';
const SH_OUTCOMES = {
  shanghai: 'Shanghai',
  doppelout: 'Doppel Out',
  grossesfeld: '3 im großen Feld',
  verpasst: 'Shanghai verpasst',
  fail: 'Nicht geschafft'
};
// Shanghai-Reihenfolge: 1, 20, 2, 20, 3, 20 … 19, 20
const SHANGHAI_SEQ = Array.from({ length: 19 }, (_, i) => [i + 1, 20]).flat();

const GAMES = {
  scoring18: { name: '18 Darts Scoring', short: 'Scoring', variants: ['20', '19', '18', 'frei'],
    desc: 'Triple +2 · Doppel +1 · Feld drüber/drunter 0 · Ausreißer links/rechts −1', unit: 'Punkte', better: 'hoch' },
  upperlower: { name: 'Upper/Lower', short: 'Upper/Lower', variants: ['20', '19'],
    desc: '18 Darts, abwechselnd über und unter das Triple (Start wählbar)', unit: 'Treffer', better: 'hoch' },
  shanghai: { name: 'Shanghai', short: 'Shanghai', variants: null,
    desc: '1, 20, 2, 20 … 19, 20 – jedes Feld bis geschafft', unit: 'Aufnahmen', better: 'niedrig' }
};
const variantLabel = v => v === 'frei' ? 'Freies Spiel' : v ? `auf der ${v}` : '';

/* ---------- Spielstand berechnen ---------- */
function gameDone(g) {
  if (g.type === 'scoring18') return g.darts.length >= 18;
  if (g.type === 'upperlower') return g.hits.length >= 6;
  if (g.type === 'shanghai') return shSuccesses(g) >= SHANGHAI_SEQ.length;
  return false;
}
const shSuccesses = g => g.log.filter(l => l.outcome !== 'fail').length;

function gameScore(g) {
  if (g.type === 'scoring18') return g.darts.reduce((s, d) => s + DART_POINTS[d], 0);
  if (g.type === 'upperlower') return g.hits.reduce((s, h) => s + h, 0);
  if (g.type === 'shanghai') return g.log.length;
  return 0;
}
function gameScoreText(g) {
  const s = gameScore(g);
  if (g.type === 'scoring18') return `${s > 0 ? '+' : ''}${s} Punkte`;
  if (g.type === 'upperlower') return `${s}/18 Treffer`;
  return `${s} Aufnahmen`;
}

/* ---------- Spiel starten / fortsetzen ---------- */
function startGame(type, variant, start) {
  if (state.activeGame && !confirm('Es läuft noch ein Spiel. Verwerfen und neu starten?')) return;
  const g = { type, variant: variant || null, startedAt: new Date().toISOString() };
  if (type === 'scoring18') g.darts = [];
  if (type === 'upperlower') { g.hits = []; g.start = start || 'Upper'; }
  if (type === 'shanghai') g.log = [];
  state.activeGame = g; save();
  render(); openGame();
}

function openGame() {
  const g = state.activeGame; if (!g) return;
  openModal(`${GAMES[g.type].name}${g.variant ? ' – ' + variantLabel(g.variant) : ''}`, gameBody(g));
  bindGameForm();
}
function refreshGame() {
  const g = state.activeGame; if (!g) return closeModal();
  $('#modalBody').innerHTML = gameBody(g);
  bindGameForm();
}

function gameBody(g) {
  const done = gameDone(g);
  let html = '';
  if (g.type === 'scoring18') html = scoringBody(g, done);
  if (g.type === 'upperlower') html = ulBody(g, done);
  if (g.type === 'shanghai') html = shBody(g, done);
  if (done) {
    html += `<form id="gameForm" style="margin-top:16px">
      <label class="field"><span>Datum</span><input type="date" name="date" value="${today()}" required></label>
      <label class="field"><span>Notizen</span><textarea name="notes" placeholder="z. B. Wurfhand müde, neue Darts getestet …"></textarea></label>
      <button class="btn block" type="submit">✓ Ergebnis speichern</button>
    </form>`;
  }
  html += `<div class="btn-row">
    <button class="btn secondary" data-action="game-undo" ${(g.darts || g.hits || g.log).length ? '' : 'disabled'}>↶ Rückgängig</button>
    <button class="btn danger" data-action="game-cancel">Spiel abbrechen</button>
  </div>`;
  return html;
}

function bindGameForm() {
  const form = $('#gameForm'); if (!form) return;
  form.onsubmit = ev => {
    ev.preventDefault();
    const g = state.activeGame;
    const f = new FormData(form);
    const entry = {
      id: uid(), createdAt: new Date().toISOString(), area: 'darts', group: null, status: 'done',
      date: f.get('date'), notes: f.get('notes').trim(),
      title: `${GAMES[g.type].name}${g.variant ? ' ' + variantLabel(g.variant) : ''}`,
      game: { ...g, score: gameScore(g) }
    };
    state.entries.push(entry);
    state.activeGame = null; save();
    ui.dartsStat = g.type;
    closeModal(); render(); toast('Spiel gespeichert 🎯');
  };
}

/* ---------- 18 Darts Scoring ---------- */
function scoringBody(g, done) {
  const round = Math.min(Math.floor(g.darts.length / 3), 5);
  const total = gameScore(g);
  const rounds = [];
  for (let r = 0; r < 6; r++) rounds.push(g.darts.slice(r * 3, r * 3 + 3));
  const cur = done ? [] : rounds[round];
  const slot = i => cur[i] ? `<span class="dart-slot ${dartClass(cur[i])}">${DART_LABELS[cur[i]]}</span>` : `<span class="dart-slot empty">Dart ${i + 1}</span>`;
  return `
    <div class="game-hero">
      <div><small>Ziel</small><b>${g.variant === 'frei' ? 'frei' : g.variant}</b></div>
      <div><small>Aufnahme</small><b>${done ? 6 : round + 1}/6</b></div>
      <div><small>Summe</small><b>${total > 0 ? '+' : ''}${total}</b></div>
    </div>
    ${done ? '<p class="hint" style="text-align:center">Alle 18 Darts geworfen – stark!</p>' : `
      <div class="dart-slots">${slot(0)}${slot(1)}${slot(2)}</div>
      <div class="game-buttons grid-2">
        <button class="btn" data-action="dart-throw" data-v="T">Triple <small>+2</small></button>
        <button class="btn" data-action="dart-throw" data-v="D">Doppel <small>+1</small></button>
        <button class="btn field-btn" data-action="dart-throw" data-v="SO">⬆ Feld drüber <small>0</small></button>
        <button class="btn field-btn" data-action="dart-throw" data-v="SU">⬇ Feld drunter <small>0</small></button>
        <button class="btn miss-btn" data-action="dart-throw" data-v="ML">⬅ Ausreißer links <small>−1</small></button>
        <button class="btn miss-btn" data-action="dart-throw" data-v="MR">Ausreißer rechts ➡ <small>−1</small></button>
      </div>`}
    <table class="score-table"><tr><th>Aufn.</th><th>Darts</th><th>Punkte</th></tr>
      ${rounds.map((r, i) => {
        const p = r.reduce((s, d) => s + DART_POINTS[d], 0);
        return `<tr class="${i === round && !done ? 'current' : ''}"><td>${i + 1}</td>
          <td>${r.map(d => DART_SHORT[d]).join(' · ') || '–'}</td><td>${r.length ? (p > 0 ? '+' : '') + p : ''}</td></tr>`;
      }).join('')}
      <tr class="sum"><td colspan="2">Summe</td><td>${total > 0 ? '+' : ''}${total}</td></tr>
    </table>`;
}

/* ---------- Upper / Lower ---------- */
// Startzone wählbar (g.start); ältere Spiele ohne Angabe starten mit Upper
const ulZone = (g, i) => ((i % 2 === 0) === (g.start !== 'Lower')) ? 'Upper' : 'Lower';
function ulBody(g, done) {
  const round = g.hits.length;
  const total = gameScore(g);
  return `
    <div class="game-hero">
      <div><small>Ziel</small><b>${g.variant}</b></div>
      <div><small>Aufnahme</small><b>${done ? 6 : round + 1}/6</b></div>
      <div><small>Treffer</small><b>${total}/18</b></div>
    </div>
    ${done ? '<p class="hint" style="text-align:center">Fertig!</p>' : `
      <div class="zone-banner ${ulZone(g, round).toLowerCase()}">${ulZone(g, round) === 'Upper' ? '⬆ UPPER – über das Triple' : '⬇ LOWER – unter das Triple'}</div>
      <p class="hint" style="text-align:center">Wie viele der 3 Darts haben getroffen?</p>
      <div class="game-buttons grid-4">
        ${[0, 1, 2, 3].map(n => `<button class="btn ${n ? '' : 'secondary'}" data-action="dart-throw" data-v="${n}">${n}</button>`).join('')}
      </div>`}
    <table class="score-table"><tr><th>Aufn.</th><th>Zone</th><th>Treffer</th></tr>
      ${[0, 1, 2, 3, 4, 5].map(i => `<tr class="${i === round && !done ? 'current' : ''}"><td>${i + 1}</td><td>${ulZone(g, i)}</td><td>${g.hits[i] ?? ''}${g.hits[i] != null ? '/3' : ''}</td></tr>`).join('')}
      <tr class="sum"><td colspan="2">Summe</td><td>${total}/18</td></tr>
    </table>`;
}

/* ---------- Shanghai ---------- */
function shBody(g, done) {
  const idx = shSuccesses(g);
  const field = SHANGHAI_SEQ[idx];
  const triesHere = done ? 0 : g.log.filter(l => l.idx === idx).length + 1;
  const pct = Math.round(idx / SHANGHAI_SEQ.length * 100);
  let html = `
    <div class="game-hero">
      <div><small>Feld</small><b>${done ? SHANGHAI_SEQ.length : idx + 1}/${SHANGHAI_SEQ.length}</b></div>
      <div><small>Ziel</small><b>${done ? '✓' : field}</b></div>
      <div><small>Aufnahmen</small><b>${g.log.length}</b></div>
    </div>
    <div class="progress"><i style="width:${pct}%"></i></div>`;
  if (!done) {
    html += `<p class="hint" style="text-align:center">${triesHere}. Versuch auf die <b>${field}</b> – was hast du geschafft?</p>
      <div class="game-buttons grid-2">
        <button class="btn" data-action="dart-throw" data-v="shanghai">Shanghai</button>
        <button class="btn" data-action="dart-throw" data-v="doppelout">Doppel Out</button>
        <button class="btn" data-action="dart-throw" data-v="grossesfeld">3 im großen Feld</button>
        <button class="btn" data-action="dart-throw" data-v="verpasst">Shanghai verpasst</button>
      </div>
      <button class="btn danger block" style="margin-top:8px" data-action="dart-throw" data-v="fail">✗ Nicht geschafft – Feld wiederholen</button>`;
  } else {
    html += shSummary(g);
  }
  if (!done && g.log.length) {
    html += `<div class="cat-label">Letzte Aufnahmen</div>` + g.log.slice(-5).reverse().map(l =>
      `<div class="meta">Feld ${SHANGHAI_SEQ[l.idx]}: ${SH_OUTCOMES[l.outcome]}</div>`).join('');
  }
  return html;
}

function shSummary(g) {
  const counts = {};
  g.log.forEach(l => counts[l.outcome] = (counts[l.outcome] || 0) + 1);
  const perField = {};
  g.log.forEach(l => perField[l.idx] = (perField[l.idx] || 0) + 1);
  const hard = Object.entries(perField).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return `<div class="cat-label">Endabrechnung</div>
    <div class="card" style="background:var(--panel-2)">
      <div class="meta">Aufnahmen gesamt: <b>${g.log.length}</b> (Minimum ${SHANGHAI_SEQ.length})</div>
      ${Object.keys(SH_OUTCOMES).map(k => `<div class="meta">${SH_OUTCOMES[k]}: <b>${counts[k] || 0}</b></div>`).join('')}
      ${hard.length ? `<div class="meta" style="margin-top:6px">Mehrere Versuche: ${hard.map(([i, n]) => `Feld ${SHANGHAI_SEQ[i]} (${n}×)`).join(', ')}</div>` : '<div class="meta" style="margin-top:6px">Jedes Feld im ersten Versuch! 🔥</div>'}
    </div>`;
}

/* ---------- Eingaben ---------- */
function gameInput(v) {
  const g = state.activeGame; if (!g || gameDone(g)) return;
  if (g.type === 'scoring18') g.darts.push(v);
  if (g.type === 'upperlower') g.hits.push(Number(v));
  if (g.type === 'shanghai') g.log.push({ idx: shSuccesses(g), outcome: v });
  save(); refreshGame();
}
function gameUndo() {
  const g = state.activeGame; if (!g) return;
  (g.darts || g.hits || g.log).pop();
  save(); refreshGame();
}

/* ---------- Ergebnis-Ansicht gespeicherter Spiele ---------- */
function openGameResult(e) {
  const g = e.game;
  let body = '';
  if (g.type === 'scoring18') body = scoringBody(g, true);
  if (g.type === 'upperlower') body = ulBody(g, true);
  if (g.type === 'shanghai') body = shBody(g, true);
  body = body.replace(/<p class="hint"[^>]*>.*?<\/p>/, '');
  openModal(e.title, `${body}
    <form id="resultForm" style="margin-top:16px">
      <label class="field"><span>Datum</span><input type="date" name="date" value="${e.date}" required></label>
      <label class="field"><span>Notizen</span><textarea name="notes">${esc(e.notes)}</textarea></label>
      <button class="btn block" type="submit">Speichern</button>
      <div class="btn-row"><button class="btn danger" type="button" data-action="delete-entry" data-id="${e.id}">Löschen</button></div>
    </form>`);
  $('#resultForm').onsubmit = ev => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    Object.assign(e, { date: f.get('date'), notes: f.get('notes').trim() });
    save(); closeModal(); render(); toast('Gespeichert ✓');
  };
}

/* ---------- Darts-Ansicht ---------- */
function renderDarts() {
  const g = state.activeGame;
  const active = g ? `<div class="card active-game">
      <div class="card-head"><span class="card-title">▶ Laufendes Spiel: ${GAMES[g.type].name}</span>
        <span class="meta">${g.variant ? variantLabel(g.variant) : ''}</span></div>
      <div class="meta">Stand: ${gameScoreText(g)}</div>
      <div class="btn-row">
        <button class="btn danger" data-action="game-cancel">✕ Spiel schließen</button>
        <button class="btn" data-action="game-resume">Fortsetzen</button>
      </div>
    </div>` : '';

  const gameCards = Object.entries(GAMES).map(([k, x]) => `
    <button class="card tap game-card" data-action="darts-start" data-game="${k}">
      <span class="card-title">🎯 ${x.name}</span><span class="meta">${x.desc}</span>
    </button>`).join('');

  const freeList = state.entries.filter(e => e.area === 'darts').sort(byDateDesc);

  return `${active}
    <div class="section-title" style="margin-top:0"><h3>Trainingsspiel starten</h3></div>
    ${gameCards}
    <button class="btn secondary block" data-action="new-entry" data-area="darts">+ Freie Einheit eintragen</button>
    ${renderDartsStats()}
    <div class="section-title"><h3>Verlauf</h3><span class="meta">${freeList.length} Einträge</span></div>
    ${freeList.length ? freeList.map(videoCard).join('') : '<div class="empty">Noch keine Einheiten.</div>'}`;
}

function renderDartsStats() {
  const type = ui.dartsStat;
  const game = GAMES[type];
  const variants = game.variants;
  if (variants && ui.dartsVariant !== 'alle' && !variants.includes(ui.dartsVariant)) ui.dartsVariant = 'alle';
  const games = applyRange(state.entries.filter(e => e.game?.type === type && (!variants || ui.dartsVariant === 'alle' || e.game.variant === ui.dartsVariant))
    .sort((a, b) => a.date.localeCompare(b.date)));
  const scores = games.map(e => e.game.score);
  const best = scores.length ? (game.better === 'hoch' ? Math.max(...scores) : Math.min(...scores)) : null;
  const avg = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : null;
  const last = scores.length ? scores[scores.length - 1] : null;
  const f = v => v == null ? '–' : fmtNum(v);

  let detail = '';
  if (games.length && type === 'scoring18') {
    const all = games.flatMap(e => e.game.darts);
    const cnt = k => all.filter(d => d === k).length;
    const share = k => Math.round(cnt(k) / all.length * 100);
    const keys = ['T', 'D', 'SO', 'SU', 'S', 'ML', 'MR', 'M'].filter(k => !['S', 'M'].includes(k) || cnt(k) > 0);
    detail = statBars(keys.map(k => ({ label: DART_LABELS[k] + (k === 'S' || k === 'M' ? ' (ohne Richtung)' : ''), pct: share(k), cls: dartClass(k) })), `Verteilung aller ${all.length} Darts`);
    const fo = cnt('SO'), fu = cnt('SU'), ml = cnt('ML'), mr = cnt('MR');
    const tendency = [];
    if (fo + fu >= 5 && fo !== fu) tendency.push(`im Feld eher <b>${fo > fu ? 'zu hoch' : 'zu tief'}</b> (${Math.round(Math.max(fo, fu) / (fo + fu) * 100)}%)`);
    if (ml + mr >= 5 && ml !== mr) tendency.push(`Ausreißer eher <b>${ml > mr ? 'links' : 'rechts'}</b> (${Math.round(Math.max(ml, mr) / (ml + mr) * 100)}%)`);
    if (tendency.length) detail += `<div class="meta" style="margin-top:8px">Tendenz: ${tendency.join(' · ')}</div>`;
  }
  if (games.length && type === 'upperlower') {
    const zone = z => {
      let hit = 0, n = 0;
      games.forEach(e => e.game.hits.forEach((h, i) => { if (ulZone(e.game, i) === z) { hit += h; n += 3; } }));
      return n ? Math.round(hit / n * 100) : 0;
    };
    detail = statBars([{ label: 'Upper-Quote', pct: zone('Upper') }, { label: 'Lower-Quote', pct: zone('Lower') }], 'Trefferquote nach Zone');
  }
  if (games.length && type === 'shanghai') {
    const logs = games.flatMap(e => e.game.log);
    const succ = logs.filter(l => l.outcome !== 'fail');
    const share = k => succ.length ? Math.round(succ.filter(l => l.outcome === k).length / succ.length * 100) : 0;
    detail = statBars(['shanghai', 'doppelout', 'grossesfeld', 'verpasst'].map(k => ({ label: SH_OUTCOMES[k], pct: share(k) })), 'So schaffst du die Felder');
    const per = {};
    games.forEach(e => {
      const c = {};
      e.game.log.forEach(l => c[l.idx] = (c[l.idx] || 0) + 1);
      Object.entries(c).forEach(([i, n]) => { const fld = SHANGHAI_SEQ[i]; (per[fld] ||= []).push(n); });
    });
    const hard = Object.entries(per).map(([fld, arr]) => [fld, arr.reduce((s, v) => s + v, 0) / arr.length])
      .filter(([, a]) => a > 1).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (hard.length) detail += `<div class="meta" style="margin-top:8px">Schwierigste Felder (Ø Versuche): ${hard.map(([fld, a]) => `${fld} (${fmtNum(a)})`).join(', ')}</div>`;
  }

  const chart = lineChart({
    points: games.map(e => ({ date: e.date, y: e.game.score, tip: `${fmtDate(e.date)}: ${gameScoreText(e.game)}${variants ? ' · ' + variantLabel(e.game.variant) : ''}` })),
    color: 'var(--darts)', title: `${game.unit} pro Spiel${game.better === 'niedrig' ? ' (weniger ist besser)' : ''}`,
    empty: 'Spiel ein paar Runden, dann erscheint hier dein Verlauf.'
  });

  return `
    <div class="section-title"><h3>📈 Statistik</h3></div>
    <div class="segmented">
      ${Object.entries(GAMES).map(([k, x]) => `<button data-action="darts-stat" data-game="${k}" class="${type === k ? 'active' : ''}">${x.short}</button>`).join('')}
    </div>
    ${variants ? `<div class="chips">${['alle', ...variants].map(v => `<button data-action="darts-variant-filter" data-v="${v}" class="chip ${ui.dartsVariant === v ? 'active' : ''}">${v === 'alle' ? 'Alle' : v === 'frei' ? 'Frei' : v}</button>`).join('')}</div>` : ''}
    ${rangeControl('Spiele')}
    <div class="stats">
      <div class="stat"><b>${games.length}</b><small>Spiele</small></div>
      <div class="stat"><b>${f(best)}</b><small>Bestwert</small></div>
      <div class="stat"><b>${f(avg)}</b><small>Ø · zuletzt ${f(last)}</small></div>
    </div>
    <div class="card">${chart}${detail}</div>`;
}

function statBars(rows, title) {
  return `<div class="cat-label">${title}</div>` + rows.map(r => `
    <div class="stat-bar"><span>${r.label}</span><div class="bar"><i class="${r.cls || ''}" style="width:${r.pct}%"></i></div><b>${r.pct}%</b></div>`).join('');
}

function openDartsVariantPicker(type) {
  const game = GAMES[type];
  if (!game.variants) return startGame(type);
  const startPick = type === 'upperlower' ? `<p class="hint">Womit fängst du an?</p>
    <div class="segmented">
      ${['Upper', 'Lower'].map(z => `<button data-action="ul-start" data-v="${z}" class="${ui.ulStart === z ? 'active' : ''}">${z === 'Upper' ? '⬆ Upper' : '⬇ Lower'}</button>`).join('')}
    </div>` : '';
  openModal(game.name, `<p class="hint">${game.desc}</p>${startPick}<p class="hint">Auf welches Feld spielst du?</p>
    <div class="game-buttons grid-2">
      ${game.variants.map(v => `<button class="btn" data-action="darts-variant" data-game="${type}" data-v="${v}">${v === 'frei' ? 'Freies Spiel' : v}</button>`).join('')}
    </div>`);
}

/* Aktionen, die von app.js weitergereicht werden */
function handleDartsAction(action, el) {
  switch (action) {
    case 'darts-start': openDartsVariantPicker(el.dataset.game); return true;
    case 'darts-variant': closeModal(); startGame(el.dataset.game, el.dataset.v, ui.ulStart); return true;
    case 'ul-start': ui.ulStart = el.dataset.v; openDartsVariantPicker('upperlower'); return true;
    case 'game-resume': openGame(); return true;
    case 'dart-throw': gameInput(el.dataset.v); return true;
    case 'game-undo': gameUndo(); return true;
    case 'game-cancel':
      if (confirm('Spiel abbrechen? Der Spielstand geht verloren.')) { state.activeGame = null; save(); closeModal(); render(); }
      return true;
    case 'darts-stat': ui.dartsStat = el.dataset.game; render(); return true;
    case 'darts-variant-filter': ui.dartsVariant = el.dataset.v; render(); return true;
  }
  return false;
}
