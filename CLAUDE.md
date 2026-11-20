# Trainings-Tracker – Hinweise für Claude

Persönliche Trainings-App (Fitness, Golf, Darts) für Tobi. Antworte auf **Deutsch**, die App-Oberfläche ist komplett deutsch.

## Technik
- Reine PWA ohne Build-Schritt und ohne Abhängigkeiten: `index.html`, `styles.css`, `charts.js`, `darts.js`, `app.js`, `manifest.json`, `sw.js`, `icons/`
- Skript-Reihenfolge in `index.html`: `charts.js` → `darts.js` → `app.js` (app.js ruft am Ende `render()` auf; die anderen Dateien nutzen Helfer aus app.js erst zur Laufzeit)
- Daten liegen lokal im Browser: `localStorage['trainings-tracker-v1']`. Kein Server, kein Login. Abgleich zwischen Geräten per Backup-Export/Import (⚙︎)
- Gehostet über **GitHub Pages** aus dem `main`-Branch (Root). Der Nutzer nutzt die App auf dem iPhone („Zum Home-Bildschirm“) und am Windows-PC

## Bei jeder Änderung
1. **`CACHE` in `sw.js` hochzählen** (`training-vN` → `vN+1`), sonst bekommen Geräte das Update nicht zuverlässig
2. Neue Dateien in die `FILES`-Liste in `sw.js` aufnehmen
3. Bestehende Daten müssen weiter funktionieren (alte Einträge ohne neue Felder abfangen, z. B. `g.start ?? 'Upper'`)
4. README.md (Funktionsliste) aktualisieren
5. Mobile zuerst testen (390×844), Desktop prüfen

## Datenmodell (state)
- `entries[]`: `{id, date:'YYYY-MM-DD', area:'fitness'|'golf'|'darts', group:'home'|'gym'|'relax'|null, title, duration, notes, link, status:'done'|'planned', exercises?, game?}`
  - Gym: `exercises[]` = Snapshot `{exId, name, cat, sets, reps, time, plannedWeight, achievedWeight, done}`
  - Darts-Spiel: `game = {type:'scoring18'|'upperlower'|'shanghai', variant, start?, darts?|hits?|log?, score}`
- `exercises[]` (Bibliothek): `{id, name, cat:'warmup'|'cardio'|'kraft', sets, reps, time, weight, history:[{date, weight, entryId}]}` – bei Cardio ist `weight` die Stufe; Cardio wird nach dem Training nur abgehakt
- `favorites[]` (Lieblingsvideos), `templates[]` (Gym-Vorlagen), `activeGame` (laufendes Darts-Spiel), `settings` (`rangeMode`, `rangeN` für Statistik-Zeitraum)

## Darts-Regeln
- 18 Darts Scoring (20/19/18/frei): T +2, D +1, Feld drüber/drunter 0, Ausreißer links/rechts −1
- Upper/Lower (20/19): 6 Aufnahmen à 3 Darts, abwechselnd, Startzone wählbar, Treffer 0–3 pro Aufnahme
- Shanghai: 1,20,2,20 … 19,20 (38 Felder, kein Bull). Ergebnisse: Shanghai, Doppel Out, 3 im großen Feld, Shanghai verpasst, nicht geschafft (= Feld wiederholen). Wertung = Anzahl Aufnahmen (weniger ist besser)
- Darts hat kein Dauer-Feld

## Arbeitsweise
- Der Nutzer möchte bei sinnvollen kleinen Zusatzfunktionen gefragt werden, bevor sie eingebaut werden
- Offene Ideen: Serien & Wochenziele, Golf-Funktionen
