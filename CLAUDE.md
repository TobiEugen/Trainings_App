# Trainings-Tracker – Hinweise für Claude

Persönliche Trainings-App (Fitness, Golf, Darts) für Tobi. Antworte auf **Deutsch**, die App-Oberfläche ist komplett deutsch.

## Technik
- Reine PWA ohne Build-Schritt und ohne Abhängigkeiten: `index.html`, `styles.css`, `changelog.js`, `charts.js`, `darts.js`, `app.js`, `version.json`, `manifest.json`, `sw.js`, `icons/`
- Skript-Reihenfolge in `index.html`: `changelog.js` → `charts.js` → `darts.js` → `app.js` (app.js ruft am Ende `render()` auf; die anderen Dateien nutzen Helfer aus app.js erst zur Laufzeit)
- Daten liegen lokal im Browser: `localStorage['trainings-tracker-v1']`. Kein Server, kein Login. Abgleich zwischen Geräten per Backup-Export/Import (⚙︎)
- Gehostet über **GitHub Pages** aus dem `main`-Branch (Root). Der Nutzer nutzt die App auf dem iPhone („Zum Home-Bildschirm“) und am Windows-PC

## Bei jeder Änderung (Release-Checkliste)
1. **Version erhöhen** an allen Stellen gleich: `APP_VERSION` in `changelog.js`, `version.json`, alle `?v=` in `index.html`
2. **Neuen Eintrag oben in `CHANGELOG`** (`changelog.js`) mit kurzen, verständlichen Stichpunkten auf Deutsch – wird dem Nutzer beim ersten Öffnen nach dem Update auf dem Startbildschirm angezeigt
3. **`CACHE` in `sw.js` hochzählen** (`training-vN` → `vN+1`); neue Dateien in die `FILES`-Liste
4. Bestehende Daten müssen weiter funktionieren (alte Einträge ohne neue Felder abfangen, z. B. `g.start ?? 'Upper'`)
5. README.md (Funktionsliste) aktualisieren
6. Mobile zuerst testen (390×844), Desktop prüfen
- Update-Mechanik: Die App prüft beim Öffnen/Zurückkehren `version.json` (no-store) und lädt bei neuer Version automatisch neu; der Service Worker fragt immer mit `cache: 'no-cache'` beim Server nach. Fehlt `changelog.js` (halb geladenes Update), darf nichts abstürzen

## Datenmodell (state)
- `entries[]`: `{id, date:'YYYY-MM-DD', area:'fitness'|'golf'|'darts', group:'home'|'gym'|'relax'|null, title, duration, notes, link, status:'done'|'planned', exercises?, game?}`
  - Gym: `exercises[]` = Snapshot `{exId, name, cat, sets, reps, time, plannedWeight, achievedWeight, done}`
  - Darts-Spiel: `game = {type:'scoring18'|'upperlower'|'shanghai'|'x01', variant, start?, darts?|hits?|log?|turns?, score}`
  - 501: `turns = [{s: Punkte, d: Darts}]`; Legs/Rest/Sieg werden per `x01State()` nachgerechnet; `score` = Gesamt-Avg
- `exercises[]` (Bibliothek): `{id, name, cat:'warmup'|'cardio'|'kraft', sets, reps, time, weight, history:[{date, weight, entryId}]}` – bei Cardio ist `weight` die Stufe; Cardio wird nach dem Training nur abgehakt
- `favorites[]` (Lieblingsvideos), `templates[]` (Gym-Vorlagen), `activeGame` (laufendes Darts-Spiel), `settings` (`rangeMode`, `rangeN` für Statistik-Zeitraum)

## Darts-Regeln
- 18 Darts Scoring (20/19/18/frei): T +2, D +1, Feld drüber/drunter 0, Ausreißer links/rechts −1. Buttons als Kreuz wie auf dem Board: Triple Mitte, drüber oben, drunter unten, links/rechts daneben; Doppel ganz oben (20/18/frei) bzw. ganz unten (19)
- Upper/Lower (20/19): 6 Aufnahmen à 3 Darts, abwechselnd, Startzone wählbar, Treffer 0–3 pro Aufnahme
- Shanghai: 1,20,2,20 … 19,20 (38 Felder, kein Bull). Ergebnisse: Shanghai, Doppel Out, 3 im großen Feld, Shanghai verpasst, nicht geschafft (= Feld wiederholen). Wertung = Anzahl Aufnahmen (weniger ist besser)
- 501 gegen Gegner (variant 30/27/24): bis 3 gewonnene Legs; ungerade Legs (eigener Anwurf) Limit = N Darts, gerade Legs = N−3. Leg gewonnen, wenn innerhalb des Limits gecheckt (Double-Out angenommen). Statistik: Gesamt-Avg, First 18 Avg (erste 6 Aufnahmen je Leg), W/L je Gegnerstärke
- Darts hat kein Dauer-Feld

## Arbeitsweise
- Der Nutzer möchte bei sinnvollen kleinen Zusatzfunktionen gefragt werden, bevor sie eingebaut werden
- Offene Ideen: Serien & Wochenziele, Golf-Funktionen
