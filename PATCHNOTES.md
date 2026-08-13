# Patchnotes

## V3.2.1 – Ring Merge Fix

### Snap
- Ring↔Ring-Snap-Schwelle nochmals vergrößert und stärker an die sichtbare Ringgröße gekoppelt.
- Ziel bleibt Beinahe-Überlappung; klar getrennte Ringe sollen nicht versehentlich mergen.

### Trennen
- Soft-Merge speichert jetzt die Eintrittsrichtung des Gast-Rings.
- Der Trennen-Button setzt den Gast bevorzugt auf der Seite wieder ab, aus der er ursprünglich kam.

### Dritter Ring
- Die Blockiermeldung ist jetzt echtes Hover-Feedback:
  - über einem bereits soft-gemergten Ring sichtbar,
  - beim Wegziehen sofort weg,
  - beim erneuten Darüberziehen wieder sichtbar.

### Flächen / Topology
- Generic Ring-Merge speichert jetzt einen exakten Snapshot aller betroffenen Panel-Boundary-Slots.
- Entmerge stellt `currentId` und den bisherigen Merge-Stack slotgenau wieder her.
- Finalisieren remappt dieselben Slots dauerhaft auf den Host.
- Dadurch soll kein unbeteiligter Boundary-Punkt mehr verloren gehen oder spontan auf einen anderen Ring springen.

### Spiegelringe
- Generic Ring-Merge wird nicht mehr pauschal übersprungen, nur weil der bewegte Ring Teil eines Spiegelpaares ist.
- Wird ein physischer Spiegelring generisch gemergt, wird sein bisheriger Gegenring temporär eigenständig.
- Beim Trennen wird die frühere Mirror-Verknüpfung wiederhergestellt, sofern beide Seiten noch frei sind.
- Damit können Spiegelringe sowohl mit Einzelringen als auch mit Ringen anderer Spiegelpaare mergen.

### Tests
- Reload/Persistenz-Test entfernt: Projektzustand-Persistenz ist bislang kein App-Feature.
- 13 ausführliche Impact-Tests für Snap, Entmerge-Richtung, Hover-Warnung, Panel-Restore,
  Finalisierung, Mirror↔Single, Mirror↔Mirror, Attachments, Undo/Redo und UI.

## V3.2.0 – Ring Merge
- Dynamische Ring-Hitbox für kleine Ringe vergrößert.
- Generic Soft-Merge eingeführt bzw. erweitert.
- Maximal zwei Ringe pro reversiblem Soft-Merge.
- Third-Merge-Warnung.
- Neuer Button für endgültiges Verschmelzen.
- Geführte Ring-/Merge-Debugtests.

## V3.1.0 – Modular Base
- V1.9f2-Golden-Code in austauschbare Quellblöcke zerlegt.
- Preload-all Loader verhindert halb gestartete Builds.
- Module für Core/Body, Nodes, Panels, Riemen, History/UI, Solver, Topology, Interaction und Tests getrennt.
- Erweiterungsslots für Body Lab, Accessoires, Foto, Strap Paint, Materialien, Posing, Export und Generatoren reserviert.

## V3.0.0f – Capture Fix
- Screenshot-Capture für WebGL/Safari mit explizitem Render vor der Aufnahme stabilisiert.
- Schwarze Frames werden erkannt.
- HTML-Testreport enthält Kommentare und Screenshots.
