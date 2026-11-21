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
    desc: '1, 20, 2, 20 … 19, 20 – jedes Feld bis geschafft', unit: 'Aufnahmen', better: 'niedrig' },
  x01: { name: '501 gegen Gegner', short: '501', variants: ['30', '27', '24'],
    desc: 'Best of 5 Legs gegen einen Gegner, der in 30, 27 oder 24 Darts checkt', unit: 'Avg', better: 'hoch' }
};
const variantLabel = (v, type) => type === 'x01' ? `gegen ${v}-Darter` : v === 'frei' ? 'Freies Spiel' : v ? `auf der ${v}` : '';

/* ---------- Spielstand berechnen ---------- */
function gameDone(g) {
  if (g.type === 'scoring18') return g.darts.length >= 18;
  if (g.type === 'upperlower') return g.hits.length >= 6;
  if (g.type === 'shanghai') return shSuccesses(g) >= SHANGHAI_SEQ.length;
  if (g.type === 'x01') return x01State(g).done;
  return false;
}
const shSuccesses = g => g.log.filter(l => l.outcome !== 'fail').length;

function gameScore(g) {
  if (g.type === 'scoring18') return g.darts.reduce((s, d) => s + DART_POINTS[d], 0);
  if (g.type === 'upperlower') return g.hits.reduce((s, h) => s + h, 0);
  if (g.type === 'shanghai') return g.log.length;
  if (g.type === 'x01') return Math.round(x01State(g).avg * 100) / 100;
  return 0;
}
function gameScoreText(g) {
  const s = gameScore(g);
  if (g.type === 'scoring18') return `${s > 0 ? '+' : ''}${s} Punkte`;
  if (g.type === 'upperlower') return `${s}/18 Treffer`;
  if (g.type === 'x01') { const st = x01State(g); return `${st.wins}:${st.losses}${st.done ? (st.wins > st.losses ? ' Sieg' : ' Niederlage') : ''} · Ø ${fmtNum(st.avg)}`; }
  return `${s} Aufnahmen`;
}

/* ---------- Spiel starten / fortsetzen ---------- */
function startGame(type, variant, start) {
  if (state.activeGame && !confirm('Es läuft noch ein Spiel. Verwerfen und neu starten?')) return;
  const g = { type, variant: variant || null, startedAt: new Date().toISOString() };
  if (type === 'scoring18') g.darts = [];
  if (type === 'upperlower') { g.hits = []; g.start = start || 'Upper'; }
  if (type === 'shanghai') g.log = [];
  if (type === 'x01') { g.turns = []; ui.x01Input = ''; ui.x01Pending = null; }
  state.activeGame = g; save();
  render(); openGame();
}

function openGame() {
  const g = state.activeGame; if (!g) return;
  openModal(`${GAMES[g.type].name}${g.variant ? ' – ' + variantLabel(g.variant, g.type) : ''}`, gameBody(g));
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
  if (g.type === 'x01') html = x01Body(g, done);
  if (done) {
    html += `<form id="gameForm" style="margin-top:16px">
      <label class="field"><span>Datum</span><input type="date" name="date" value="${today()}" required></label>
      <label class="field"><span>Notizen</span><textarea name="notes" placeholder="z. B. Wurfhand müde, neue Darts getestet …"></textarea></label>
      <button class="btn block" type="submit">✓ Ergebnis speichern</button>
    </form>`;
  }
  html += `<div class="btn-row">
    <button class="btn secondary" data-action="game-undo" ${(g.darts || g.hits || g.log || g.turns).length ? '' : 'disabled'}>↶ Rückgängig</button>
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
      title: `${GAMES[g.type].name}${g.variant ? ' ' + variantLabel(g.variant, g.type) : ''}`,
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
      <div class="dart-cross ${g.variant === '19' ? 'double-below' : 'double-above'}">
        <button class="btn dc-d" data-action="dart-throw" data-v="D">Doppel <small>+1</small></button>
        <button class="btn field-btn dc-so" data-action="dart-throw" data-v="SO">⬆ drüber <small>0</small></button>
        <button class="btn miss-btn dc-ml" data-action="dart-throw" data-v="ML">⬅ links <small>−1</small></button>
        <button class="btn dc-t" data-action="dart-throw" data-v="T">Triple <small>+2</small></button>
        <button class="btn miss-btn dc-mr" data-action="dart-throw" data-v="MR">rechts ➡ <small>−1</small></button>
        <button class="btn field-btn dc-su" data-action="dart-throw" data-v="SU">⬇ drunter <small>0</small></button>
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
  (g.darts || g.hits || g.log || g.turns).pop();
  ui.x01Input = ''; ui.x01Pending = null;
  save(); refreshGame();
}

/* ---------- Ergebnis-Ansicht gespeicherter Spiele ---------- */
function openGameResult(e) {
  const g = e.game;
  let body = '';
  if (g.type === 'scoring18') body = scoringBody(g, true);
  if (g.type === 'upperlower') body = ulBody(g, true);
  if (g.type === 'shanghai') body = shBody(g, true);
  if (g.type === 'x01') body = x01Body(g, true);
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
        <span class="meta">${g.variant ? variantLabel(g.variant, g.type) : ''}</span></div>
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
  if (type === 'x01') return renderX01Stats();
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
    points: games.map(e => ({ date: e.date, y: e.game.score, tip: `${fmtDate(e.date)}: ${gameScoreText(e.game)}${variants ? ' · ' + variantLabel(e.game.variant, type) : ''}` })),
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
  if (type === 'x01') return openModal(game.name, `<p class="hint">${game.desc}. Gespielt wird bis 3 gewonnene Legs.</p>
    <p class="hint">In ungeraden Legs hast du Anwurf und das volle Limit, in geraden Legs hat der Gegner Anwurf – dann musst du 3 Darts früher checken.</p>
    <p class="hint">In wie vielen Darts checkt dein Gegner?</p>
    <div class="game-buttons grid-3">
      ${game.variants.map(v => `<button class="btn" data-action="darts-variant" data-game="x01" data-v="${v}">${v}<small style="display:block">${v} / ${v - 3}</small></button>`).join('')}
    </div>`);
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
    case 'x01-key': x01Key(el.dataset.v); return true;
    case 'x01-quick': x01Submit(Number(el.dataset.v)); return true;
    case 'x01-ok': x01Submit(ui.x01Input === '' ? null : Number(ui.x01Input)); return true;
    case 'x01-checkout': x01Checkout(Number(el.dataset.v)); return true;
    case 'x01-pending-cancel': ui.x01Pending = null; refreshGame(); return true;
    case 'darts-variant-filter': ui.dartsVariant = el.dataset.v; render(); return true;
  }
  return false;
}

/* =========================================================
   501 gegen Gegner (Best of 5)
   Gespeichert werden nur die Aufnahmen: turns = [{s: Punkte, d: Darts}]
   Legs, Rest, Sieg/Niederlage werden daraus nachgerechnet (Rückgängig = letzte Aufnahme entfernen).
   ========================================================= */
const X01_START = 501, X01_TARGET = 3;
const X01_IMPOSSIBLE = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);
const X01_NO_CHECKOUT = new Set([159, 162, 163, 165, 166, 168, 169]);

function x01State(g) {
  const base = Number(g.variant);
  const legs = [];
  let leg = null, wins = 0, losses = 0;
  const newLeg = () => {
    const num = legs.length + 1;
    leg = { num, myThrow: num % 2 === 1, limit: num % 2 === 1 ? base : base - 3, rest: X01_START, darts: 0, scores: [], turnDarts: [], won: null };
    legs.push(leg);
  };
  newLeg();
  for (const t of g.turns) {
    if (wins >= X01_TARGET || losses >= X01_TARGET) break;
    leg.rest -= t.s; leg.darts += t.d; leg.scores.push(t.s); leg.turnDarts.push(t.d);
    if (leg.rest === 0) { leg.won = true; wins++; }
    else if (leg.darts >= leg.limit) { leg.won = false; losses++; }
    if (leg.won !== null && wins < X01_TARGET && losses < X01_TARGET) newLeg();
  }
  const done = wins >= X01_TARGET || losses >= X01_TARGET;
  let pts = 0, darts = 0, f18p = 0, f18d = 0;
  legs.forEach(l => l.scores.forEach((sc, i) => {
    pts += sc; darts += l.turnDarts[i];
    if (i < 6) { f18p += sc; f18d += l.turnDarts[i]; }
  }));
  return { legs, cur: leg, wins, losses, done,
    points: pts, darts, avg: darts ? pts / darts * 3 : 0,
    f18Points: f18p, f18Darts: f18d, f18: f18d ? f18p / f18d * 3 : 0 };
}

function x01Body(g, done) {
  const st = x01State(g);
  const L = st.cur;
  let html = `
    <div class="x01-score">
      <div class="${st.wins > st.losses ? 'lead' : ''}"><small>Ich</small><b>${st.wins}</b></div>
      <div class="vs">Legs<br><small>bis ${X01_TARGET}</small></div>
      <div class="${st.losses > st.wins ? 'lead' : ''}"><small>Gegner (${g.variant})</small><b>${st.losses}</b></div>
    </div>`;
  if (!done) {
    const left = L.limit - L.darts;
    const legPts = X01_START - L.rest;
    const legAvg = L.darts ? legPts / L.darts * 3 : null;
    // Nötiger Avg: Restpunkte verteilt auf die verbleibenden Darts des Limits
    const needAvg = left > 0 ? L.rest / left * 3 : null;
    const needCls = needAvg == null ? '' : legAvg != null && needAvg <= legAvg ? 'ok' : needAvg > 120 ? 'hard' : '';
    html += `
    <div class="game-hero two">
      <div><small>Leg ${L.num} · ${L.myThrow ? 'Ich werfe an' : 'Gegner wirft an'}</small><b class="x01-rest">${L.rest}</b></div>
      <div><small>Darts / Limit</small><b>${L.darts}/${L.limit}</b></div>
    </div>
    <div class="game-hero two">
      <div><small>Leg-Avg</small><b>${legAvg == null ? '–' : fmtNum(legAvg)}</b></div>
      <div class="need ${needCls}"><small>Nötiger Avg zum Leg-Sieg</small><b>${needAvg == null ? '–' : fmtNum(needAvg)}</b></div>
    </div>
    <p class="hint" style="text-align:center">Noch <b>${left} Darts</b> (${Math.ceil(left / 3)} Aufnahmen), um das Leg zu gewinnen.</p>`;
    if (ui.x01Pending) {
      const r = ui.x01Pending;
      const opts = [1, 2, 3].filter(k => k === 3 || (k === 2 && r <= 110) || (k === 1 && (r === 50 || (r <= 40 && r % 2 === 0))));
      html += `<div class="card" style="background:var(--panel-2);text-align:center">
        <div class="card-title">🎯 Check ${r}! Mit dem wievielten Dart?</div>
        <div class="game-buttons grid-3" style="margin-top:10px">
          ${[1, 2, 3].map(k => `<button class="btn" data-action="x01-checkout" data-v="${k}" ${opts.includes(k) ? '' : 'disabled'}>${k}. Dart</button>`).join('')}
        </div>
        <button class="btn secondary small" style="margin-top:10px" data-action="x01-pending-cancel">Doch nicht</button>
      </div>`;
    } else {
      html += `
      <div class="x01-display">${ui.x01Input === '' ? '<span class="meta">Score eingeben</span>' : ui.x01Input}</div>
      <div class="x01-pad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="btn secondary" data-action="x01-key" data-v="${n}">${n}</button>`).join('')}
        <button class="btn secondary" data-action="x01-key" data-v="del">⌫</button>
        <button class="btn secondary" data-action="x01-key" data-v="0">0</button>
        <button class="btn" data-action="x01-ok">OK</button>
      </div>
      <button class="btn danger block" style="margin-top:8px" data-action="x01-quick" data-v="0">Überworfen / 0</button>`;
    }
    if (L.scores.length) {
      let r = X01_START;
      html += `<table class="score-table"><tr><th>Aufn.</th><th>Score</th><th>Rest</th></tr>
        ${L.scores.map((sc, i) => { r -= sc; return `<tr><td>${i + 1}</td><td>${sc}</td><td>${r}</td></tr>`; }).reverse().join('')}</table>`;
    }
  } else {
    html += `<p class="hint" style="text-align:center">${st.wins > st.losses ? '🏆 Match gewonnen!' : 'Match verloren – nächstes Mal!'}</p>`;
  }
  if (done) html += x01Summary(st); // Gesamt-Avg & Leg-Übersicht erst in der Endabrechnung
  return html;
}

function x01Summary(st) {
  const finished = st.legs.filter(l => l.won !== null);
  if (!finished.length) return '';
  return `<div class="stats" style="margin-top:14px">
      <div class="stat"><b>${fmtNum(st.avg)}</b><small>Gesamt-Avg</small></div>
      <div class="stat"><b>${fmtNum(st.f18)}</b><small>First 18 Avg</small></div>
      <div class="stat"><b>${st.wins}:${st.losses}</b><small>Legs</small></div>
    </div>
    <table class="score-table"><tr><th>Leg</th><th>Anwurf</th><th>Darts</th><th>Ø</th><th>Ergebnis</th></tr>
      ${finished.map(l => {
        const p = l.scores.reduce((a, b) => a + b, 0);
        return `<tr><td>${l.num}</td><td>${l.myThrow ? 'Ich' : 'Gegner'}</td><td>${l.darts}/${l.limit}</td>
          <td>${fmtNum(p / l.darts * 3)}</td><td>${l.won ? '✓ gewonnen' : `✗ Rest ${l.rest}`}</td></tr>`;
      }).join('')}
    </table>`;
}

function x01Key(v) {
  if (v === 'del') ui.x01Input = ui.x01Input.slice(0, -1);
  else if (ui.x01Input.length < 3) ui.x01Input = (ui.x01Input + v).replace(/^0+(?=\d)/, '');
  refreshGame();
}

function x01Submit(score) {
  const g = state.activeGame; if (!g || g.type !== 'x01' || score == null) return;
  const L = x01State(g).cur;
  if (score > 180 || X01_IMPOSSIBLE.has(score)) { ui.x01Input = ''; refreshGame(); return toast(`${score} ist mit 3 Darts nicht möglich`); }
  if (score > L.rest || L.rest - score === 1) { ui.x01Input = ''; refreshGame(); return toast('Überworfen – trag 0 ein'); }
  if (score === L.rest) {
    if (score > 170 || X01_NO_CHECKOUT.has(score)) { ui.x01Input = ''; refreshGame(); return toast(`${score} kann man nicht checken`); }
    ui.x01Pending = score; ui.x01Input = ''; return refreshGame();
  }
  g.turns.push({ s: score, d: 3 });
  ui.x01Input = '';
  afterX01Turn(g);
}

function x01Checkout(darts) {
  const g = state.activeGame; if (!g || !ui.x01Pending) return;
  g.turns.push({ s: ui.x01Pending, d: darts });
  ui.x01Pending = null;
  afterX01Turn(g);
}

function afterX01Turn(g) {
  const before = g.turns.slice(0, -1);
  const prev = x01State({ ...g, turns: before });
  const now = x01State(g);
  save(); refreshGame();
  const finishedLeg = now.legs[prev.legs.length - 1];
  if (finishedLeg && finishedLeg.won === true) toast(`Leg ${finishedLeg.num} gewonnen in ${finishedLeg.darts} Darts 🎯`);
  else if (finishedLeg && finishedLeg.won === false) toast(`Leg ${finishedLeg.num} an den Gegner – Limit erreicht`);
}

function renderX01Stats() {
  const variants = GAMES.x01.variants;
  if (ui.dartsVariant !== 'alle' && !variants.includes(ui.dartsVariant)) ui.dartsVariant = 'alle';
  const all = applyRange(state.entries.filter(e => e.game?.type === 'x01').sort((a, b) => a.date.localeCompare(b.date)));
  const games = all.filter(e => ui.dartsVariant === 'alle' || e.game.variant === ui.dartsVariant);
  const sts = games.map(e => ({ e, st: x01State(e.game) }));
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const pts = sum(sts, x => x.st.points), darts = sum(sts, x => x.st.darts);
  const f18p = sum(sts, x => x.st.f18Points), f18d = sum(sts, x => x.st.f18Darts);
  const won = sts.filter(x => x.st.wins > x.st.losses).length;

  const wlRows = variants.map(v => {
    const list = all.filter(e => e.game.variant === v).map(e => x01State(e.game));
    const w = list.filter(s => s.wins > s.losses).length, l = list.length - w;
    const lw = sum(list, s => s.wins), ll = sum(list, s => s.losses);
    const best = list.flatMap(s => s.legs.filter(x => x.won)).reduce((m, x) => Math.min(m, x.darts), Infinity);
    return `<tr><td>${v}-Darter</td><td>${w} – ${l}</td><td>${list.length ? Math.round(w / list.length * 100) + ' %' : '–'}</td>
      <td>${lw} – ${ll}</td><td>${best === Infinity ? '–' : best}</td></tr>`;
  }).join('');

  const chart = (key, title) => lineChart({
    points: sts.map(({ e, st }) => ({ date: e.date, y: Math.round(st[key] * 100) / 100,
      tip: `${fmtDate(e.date)}: ${fmtNum(st[key])} · ${st.wins}:${st.losses} gegen ${e.game.variant}` })),
    color: 'var(--darts)', title, empty: 'Spiel ein Match, dann erscheint hier dein Verlauf.'
  });

  return `
    <div class="section-title"><h3>📈 Statistik</h3></div>
    <div class="segmented">
      ${Object.entries(GAMES).map(([k, x]) => `<button data-action="darts-stat" data-game="${k}" class="${k === 'x01' ? 'active' : ''}">${x.short}</button>`).join('')}
    </div>
    <div class="chips">${['alle', ...variants].map(v => `<button data-action="darts-variant-filter" data-v="${v}" class="chip ${ui.dartsVariant === v ? 'active' : ''}">${v === 'alle' ? 'Alle' : v + 'er'}</button>`).join('')}</div>
    ${rangeControl('Matches')}
    <div class="stats">
      <div class="stat"><b>${darts ? fmtNum(pts / darts * 3) : '–'}</b><small>Gesamt-Avg</small></div>
      <div class="stat"><b>${f18d ? fmtNum(f18p / f18d * 3) : '–'}</b><small>First 18 Avg</small></div>
      <div class="stat"><b>${won}–${games.length - won}</b><small>Matches W–L</small></div>
    </div>
    <div class="card">${chart('avg', 'Gesamt-Avg pro Match')}</div>
    <div class="card">${chart('f18', 'First 18 Avg pro Match')}</div>
    <div class="card">
      <div class="cat-label" style="margin-top:0">W/L nach Gegnerstärke</div>
      <table class="score-table" style="margin-top:4px"><tr><th>Gegner</th><th>Matches</th><th>Quote</th><th>Legs</th><th>Bestes Leg</th></tr>${wlRows}</table>
    </div>`;
}
