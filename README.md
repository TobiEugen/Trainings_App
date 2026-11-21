# Trainings-Tracker (Fitness · Golf · Darts)

Web-App (PWA), die auf Windows im Browser und auf dem iPhone wie eine normale App läuft.
Keine Kosten, kein Server: Die Daten liegen lokal auf dem jeweiligen Gerät.

## Funktionen (Version 1)
- **Kalender** als Done-Liste: farbige Punkte pro Bereich, Tagesliste, Monatsstatistik
- **Fitness**
  - *Homeworkout* & *Entspannung*: Einheit mit Datum, was gemacht, YouTube-Link, Dauer, Vorkommnisse
  - *Gym*: Übungsbibliothek (Warm-Up / Krafttraining, Sätze, Wiederholungen, letztes Gewicht)
    → Training planen (Übungen auswählen) → nach dem Training geschaffte Gewichte eintragen.
    Das „letzte Gewicht“ der Übung wird automatisch aktualisiert, der Verlauf gespeichert.
- **Lieblingsvideos** (Homeworkout/Entspannung): beim Eintragen als ⭐ speichern, später auswählen oder mit „Heute eintragen“ in einem Klick erfassen
- **Trainingsvorlagen** (Gym): Übungsauswahl als Vorlage speichern (z. B. „Push-Tag“) und mit „Damit planen“ wiederverwenden
- **Cardio** (Gym): eigene Übungskategorie mit Sätzen, Zeit pro Satz und Stufe; nach dem Training nur abhaken
- **Fortschritts-Diagramm** (Gym): Gewicht pro Kraftübung über die Zeit
- **Darts-Trainingsspiele** mit Statistik und Verlaufsdiagramm:
  - *18 Darts Scoring* (20, 19, 18 oder frei): Triple +2, Doppel +1, Feld drüber/drunter 0, Ausreißer links/rechts −1 – mit Tendenz-Auswertung
  - *Upper/Lower* (20 oder 19): 6 Aufnahmen abwechselnd über/unter das Triple, Start (Upper oder Lower) wählbar, Treffer zählen
  - *Shanghai*: 1, 20, 2, 20 … 19, 20 – Feld wiederholen bis geschafft, Endabrechnung mit Versuchen
  - *501 gegen Gegner*: Best of 5 gegen einen 30/27/24-Darter (gerade Legs 3 Darts weniger, da Gegner Anwurf hat); Score-Eingabe per Ziffernblock, Anzeige von Leg-Avg und nötigem Avg; Gesamt-Avg, First-18-Avg, W/L je Gegnerstärke
- **Statistik-Zeitraum** frei wählbar: alle, die letzten N Spiele/Trainings oder die letzten N Tage
- Laufende Darts-Spiele lassen sich auf der Darts-Startseite fortsetzen oder schließen
- **Golf**: einfache Einträge (wird später erweitert)
- **Backup** (⚙︎ oben rechts): Export/Import als JSON-Datei, z. B. um Daten vom PC aufs iPhone zu bringen

## Unter Windows testen
Doppelklick auf `index.html` funktioniert, besser ist ein kleiner lokaler Server
(dann geht auch der Offline-Modus):

```
cd trainings-app
python -m http.server 8000
```
Dann im Browser `http://localhost:8000` öffnen. In Edge/Chrome kannst du sie über
„App installieren“ (Symbol in der Adressleiste) wie ein Programm installieren.

## Aufs iPhone bringen (kostenlos mit GitHub Pages)
1. Kostenloses Konto auf https://github.com anlegen.
2. Neues Repository anlegen, z. B. `training` (Public).
3. „Add file → Upload files“ → alle Dateien aus diesem Ordner hochladen (inkl. Ordner `icons`).
4. Repository → *Settings* → *Pages* → Source: „Deploy from a branch“, Branch `main`, Ordner `/ (root)` → Save.
5. Nach ca. 1 Minute ist die App unter `https://<dein-name>.github.io/training/` erreichbar.
6. Auf dem iPhone in **Safari** öffnen → Teilen-Symbol → **„Zum Home-Bildschirm“**.

Fertig – die App startet jetzt vom Home-Bildschirm im Vollbild und funktioniert auch offline.

**Wichtig:** Die Daten der Home-Bildschirm-App sind getrennt von denen in Safari.
Nutze die App immer über das Icon und mache ab und zu ein Backup (⚙︎ → Backup herunterladen).

## Updates
Änderungen werden ins GitHub-Repository gepusht. Die App erkennt beim Öffnen automatisch eine neue Version,
lädt sie und zeigt auf dem Startbildschirm „Was ist neu“. Deine Daten bleiben dabei erhalten.
Ablauf für Entwickler: siehe Release-Checkliste in `CLAUDE.md`.

## Dateien
- `index.html` – Grundgerüst
- `styles.css` – Aussehen
- `app.js` – Hauptlogik & Datenspeicherung
- `darts.js` – Darts-Spiele & Statistik
- `charts.js` – Diagramme
- `manifest.json`, `sw.js`, `icons/` – damit es eine installierbare Offline-App ist
