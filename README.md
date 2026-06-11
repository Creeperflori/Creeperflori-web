# Creeperflori Web

Die offizielle Website von Creeperflori.

## Struktur

- `index.html` leitet auf die Startseite weiter.
- `start.html` ist die Hauptseite mit News und Support.
- `sozial.html`, `fillypath.html` und `creepercave.html` sind eigene Bereiche.
- `css/style.css` enthält das gemeinsame Design.
- `js/app.js` enthält Login, News, Support und Seiteneinstellungen.
- `js/config.js` enthält zentrale Links und Firebase-Konfiguration.

## Lokal testen

Im Repo-Ordner:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Danach im Browser öffnen:

```text
http://127.0.0.1:8000/start.html
```
