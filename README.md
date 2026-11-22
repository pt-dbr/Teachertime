# Lehrzeit für GitHub Pages

Statische, deutschsprachige Zeiterfassung fürs iPad. GitHub Pages liefert die App-Dateien per HTTPS. Einträge, Stundenplan und Dienstort werden nur im lokalen Website-Speicher des Browsers abgelegt. Die App enthält keine Upload-Funktion, keine Analytik, keine externen Bibliotheken und keine Schnittstelle zum Speichern beim Hoster. GitHub erhält beim Abruf der App die üblichen technischen Informationen einer HTTPS-Anfrage.

## Auf GitHub bereitstellen

1. Erstelle ein separates Repository, etwa `lehrzeit`. Lade nur **index.html, style.css, app.js, sw.js, icon.png und manifest.webmanifest** in das Hauptverzeichnis des Branches **main**. Die ZIP zuerst in „Dateien“ entpacken. `.nojekyll` ist optional. Stundenplan, Sicherungen und Aufzeichnungen gehören nicht ins Repository.
2. Öffne im Repository **Settings → Pages → Build and deployment**. Wähle **Deploy from a branch**, dann **main** und **/ (root)**. Wähle **Save**.
3. Öffne die angezeigte HTTPS-Adresse auf dem iPad in Safari. Die Adresse sieht gewöhnlich so aus wie `https://DEIN-NAME.github.io/lehrzeit/`.
4. Optional in Safari über **Teilen → Zum Home-Bildschirm** hinzufügen. Wähle anschließend einen festen Einstieg für den Alltag. Safari und die Homescreen-App können getrennte Speicher verwenden. Vor einem Wechsel exportierst du eine Sicherung im bisherigen Einstieg und importierst sie im neuen.
5. Öffne die gewählte Version einmal vollständig mit Internetverbindung. Der Service Worker speichert die App-Dateien für die Offline-Nutzung. Prüfe das einmal im Flugmodus, bevor du dich darauf verlässt.

Eine reguläre GitHub-Pages-Seite ist öffentlich erreichbar. Sie enthält nur die App und keine Einträge. Verwende nach Möglichkeit eine eigene Website-Adresse oder einen GitHub-Account, dessen Pages-Ursprung ausschließlich vertrauenswürdige Inhalte ausliefert. Andere Webseiten auf derselben Domain können browserseitig denselben Speicherschutzbereich teilen. Bei Wechsel von Domain, Browser oder Profil überträgst du die Daten mit der lokalen Sicherungsdatei.

## Bedienung

- **Tag.** Tätigkeit antippen und Timer starten. Über **+ Zeit nachtragen** Datum, Beginn und Ende eingeben. Abgeschlossene Einträge lassen sich bearbeiten und löschen.
- **Stundenplan.** Termine wöchentlich oder einmalig anlegen, zum Beispiel Unterricht, Vertretung, Aufsicht oder Elterngespräch. Ein Klick im Tagesplan übernimmt abgelaufene Planzeiten oder öffnet den Timer beziehungsweise die manuelle Erfassung.
- **Statistik.** Tag, Woche oder Monat und ein Datum wählen. Anwesenheit und Arbeitszeit haben eigene Summen. Überschneidungen zählen in der gesamten Arbeitszeit einmal.
- **Einstellungen.** Sicherung exportieren und unter **Auf meinem iPad** ablegen. Der Import ersetzt den aktuellen Bestand nach Bestätigung. Das Löschen von Website-Daten entfernt auch die Einträge. Regelmäßige lokale Sicherungen helfen, sie wiederherzustellen.

## CSV-Beispiel

UTF-8, Semikolon als Trennzeichen, keine CSV-Anführungszeichen. Benutze Wochentage von `Mo` bis `So` und die Tätigkeitsnamen aus der App.

```text
Tag;Beginn;Ende;Tätigkeit;Titel
Mo;08:00;08:45;Unterricht;Mathematik 7b
Mo;09:40;09:55;Aufsicht;Pausenhof
```

## Standort

In den Einstellungen kannst du den aktuellen Standort als Dienstort speichern. Dafür braucht Safari deine Standortfreigabe. Die App prüft lokal, ob du außerhalb des Schulumkreises bist, und kann im Vordergrund fragen „Arbeitest du gerade?“. Die Anwesenheit startest und beendest du von Hand. Geschlossene Web-Apps erhalten keine verlässlichen Standortereignisse. Eine Abfrage beim Entsperren des iPads steht ebenfalls nicht zur Verfügung.
