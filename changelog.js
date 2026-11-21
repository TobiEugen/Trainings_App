'use strict';
/* =========================================================
   App-Version & Änderungsprotokoll („Was ist neu“)
   Bei jedem Update: APP_VERSION erhöhen, neuen Eintrag OBEN ergänzen,
   dieselbe Version in version.json und in den ?v= Parametern in index.html eintragen,
   CACHE in sw.js hochzählen.
   ========================================================= */
const APP_VERSION = '1.6.2';

const CHANGELOG = [
  {
    version: '1.6.2', date: '2026-11-21',
    items: [
      '🎯 18 Darts Scoring: Die Buttons sind jetzt wie auf dem Board angeordnet – Triple in der Mitte, drüber/drunter darüber und darunter, links/rechts daneben',
      '➕ Doppel liegt bei 20, 18 und freiem Spiel ganz oben, bei der 19 ganz unten'
    ]
  },
  {
    version: '1.6.1', date: '2026-11-20',
    items: [
      '🛠️ Kalender repariert: Er verschwand, wenn ein Update nur halb geladen war',
      '🛡️ Die App zeigt jetzt nie mehr eine leere Seite, sondern bietet „App neu laden“ an'
    ]
  },
  {
    version: '1.6', date: '2026-11-20',
    items: [
      '🎯 Neues Darts-Spiel „501 gegen Gegner“: Best of 5 gegen einen 30-, 27- oder 24-Darter (gerade Legs 3 Darts weniger, weil der Gegner Anwurf hat)',
      '⌨️ Score-Eingabe per Ziffernblock, Schnelltasten und „Check“-Button mit Abfrage des Checkout-Darts',
      '📈 501-Statistik: Gesamt-Avg, First 18 Avg, Verlaufsgraphen und W/L-Tabelle je Gegnerstärke',
      '🆕 Diese „Was ist neu“-Anzeige nach jedem Update',
      '🔄 Updates werden jetzt beim Öffnen automatisch erkannt und geladen'
    ]
  },
  {
    version: '1.5', date: '2026-11-20',
    items: [
      'Scoring: Feld drüber/drunter und Ausreißer links/rechts mit Tendenz-Auswertung',
      'Statistik-Zeitraum frei einstellbar (letzte N Spiele oder Tage)',
      'Laufende Darts-Spiele auf der Startseite schließen'
    ]
  }
];
