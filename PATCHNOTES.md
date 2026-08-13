# Patchnotes

## V3.1.0 MODULAR BASE
- V1.9f2 Golden bleibt die funktionale Referenz.
- Monolithischer App-Code in 10 flache, austauschbare Quellblöcke getrennt.
- Keine Ring-, Riemen-, Flächen-, Kamera-, Touch- oder UI-Logik absichtlich verändert.
- `app.js` ist jetzt nur noch ein kleiner Loader.
- Der Loader lädt zuerst ALLE Blöcke. Erst wenn alle vorhanden sind, wird die Legacy-App gemeinsam ausgeführt.
- Fehlendes/fehlerhaft hochgeladenes Modul => sichtbarer `MODULAR BOOT FAILED`-Hinweis statt halb gestarteter App.
- Build-/Patchnote-Anzeige auf V3.1.0 aktualisiert.
- Erweiterungsslots für Accessoires, Foto, Strap Paint, Body Lab, Materialien, Posing, Export und Generatoren reserviert.
- Guided Test + Screenshotreport als eigener Block erhalten.
