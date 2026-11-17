# Bibliothek – Prototyp 0.1.0

PWA zur Verwaltung einer privaten Büchersammlung. Alle Daten bleiben lokal auf dem iPhone (IndexedDB), Sicherung als JSON-Datei in iCloud Drive.

## Installation (GitHub Pages)

1. Neues öffentliches Repository anlegen, z. B. `bibliothek`.
2. Den **Inhalt** dieses Ordners hochladen (index.html muss im Wurzelverzeichnis liegen).
3. Settings → Pages → Source: „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
4. Nach ca. 1 Minute erreichbar unter `https://<account>.github.io/bibliothek/`.

Die Kamera funktioniert nur über **https**. Lokal per `file://` geht sie nicht.

## Auf dem iPhone

1. Adresse in **Safari** öffnen.
2. Teilen → „Zum Home-Bildschirm“.
3. Ab jetzt nur noch über das Symbol auf dem Homescreen öffnen. Der Speicher der Homescreen-App ist getrennt von Safari.

## Erster Test (bitte in dieser Reihenfolge)

1. **Mehr → Datenquellen testen → Test starten.** Ergebnis notieren:
   - DNB „nicht erreichbar“, Google/Open Library „erreichbar“ → DNB blockiert Browserzugriff (CORS). Die App funktioniert trotzdem, nur ohne DNB.
   - Alle „nicht erreichbar“ → Netzproblem.
2. Regal anlegen (Name, Raum, Thema, Anzahl Fächer).
3. **Bücher erfassen** → Kamera starten → 10–20 Bücher scannen.
4. Prüfen: Titel, Autor, Cover korrekt? Was landet in „Nacharbeiten“?
5. **Mehr → Jetzt sichern** → „In Dateien sichern“ → iCloud Drive.
6. Optional: **Mehr → Regal-Etiketten** drucken und einen Regal-QR in der Scan-Ansicht scannen.

## Bekannte Grenzen

- Taschenlampe: Safari erlaubt Web-Apps keine Steuerung des Kameralichts. Der Knopf erscheint nur, wo es geht.
- Vibration: unter iOS für Web-Apps nicht verfügbar, deshalb Ton.
- Kamera-Erlaubnis: iOS fragt bei Homescreen-Apps teils bei jedem Start erneut.
- Daten liegen nur auf diesem Gerät. Ohne Sicherung gehen sie beim Löschen der App verloren.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst, Navigation |
| `app.js` | Oberfläche, Scanner, Router, Sicherung |
| `lib.js` | ISBN-Prüfung, Abfrage DNB/Google Books/Open Library, Zusammenführen |
| `db.js` | Speicher (IndexedDB) |
| `styles.css` | Themen Leseecke, Horror, Romantasy, Fantasy |
| `sw.js` | Offline-Betrieb, Cover-Zwischenspeicher |
| `vendor/` | ZXing (Barcode, Apache-2.0), qrcode-generator (MIT) |
| `fonts/` | Schriften (SIL Open Font License) |

Regal-QR-Inhalt: `BIBREGAL:<Regal-ID>`.
