# Harness Designer V0.5b — Interaction & Orientation Fixes

## Behoben

### Riemen-Anker
- Riemen-Anker folgen jetzt der exakt gerenderten Riemenkurve
- keine separate Neuberechnung mehr, die vom sichtbaren Riemen abweichen kann
- Position bleibt weiterhin prozentual von 0–100 % gespeichert
- der Anker sitzt leicht über der Lederoberfläche

### Verbindungsmodus
- Riemen-Mittelpunkte/Handles werden im Verbindungsmodus vollständig ausgeblendet
- sie sind dort auch nicht mehr anklickbar
- dadurch können sie Ring- oder Riemen-Anker nicht mehr verdecken

### Ringe auswählen
- kurzer Tap auf einen Ring öffnet zuverlässig dessen Parameter
- erst ab einer kleinen tatsächlichen Fingerbewegung wird der Ring verschoben
- Durchmesser und Ringstärke sind damit einfacher editierbar

### Modellorientierung / Spiegelachse
- importierte GLB/GLTF-Modelle werden beim Import analysiert
- die längste Bounding-Box-Achse wird als Körperhöhe angenommen
- liegt die Figur um 90° auf X oder Z, wird sie automatisch auf Welt-Y aufgerichtet
- anschließend wird sie zentriert und skaliert
- dadurch bleibt die Spiegel-Mittellinie bei x = 0 konsistent

## Hinweis
Die automatische Orientierung ist für typische stehende/liegende Human-Base-Meshes gedacht.
Bei extremen Posen oder ungewöhnlichen Modellen kann später zusätzlich ein manueller
Orientierungs-Override sinnvoll sein.
