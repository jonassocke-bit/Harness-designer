# Patchnotes

## V3.3.2b – Duplicate Function Fix
- Konkreter Runtime-Fehler gefunden: `projectedChordSamplesStrip()` war zweimal vorhanden.
- Die spätere alte V3.3.1-Surface-Walker-Version überschieb die neue Projection-Continuity-Version.
- Diese alte Funktion rief `edgeFirstNominalSample()` auf, die in V3.3.2 absichtlich entfernt wurde.
- Folge: Riemen-Rebuild brach direkt nach der billigen Direktvorschau ab; `methodRoute` und `debugTrace` wurden nie erzeugt.
- Alte Doppeldefinition vollständig entfernt.
- Es existiert jetzt genau eine `projectedChordSamplesStrip()`-Definition.
- Keine Referenz auf `edgeFirstNominalSample()` mehr.
- Projection-Continuity-Logik selbst unverändert.

## V3.3.2a – Projection Hotfix
- Reiner Runtime-Hotfix auf V3.3.2.
- Die Glättungsstufe verwendete weiterhin `projectEdgeCandidateToBody()`, die beim Umbau auf Projection Continuity versehentlich entfernt worden war.
- Dadurch brach `rebuildAutoProjection()` beim Riemenbau ab; deshalb wurden weder Riemen noch Debug-Trace fertig erzeugt.
- Die Hilfsfunktion ist wieder vorhanden.
- Keine Schwellenwerte, L/R-Frame-Regeln, Winkelkontinuität, Triangulation oder Debuglogik geändert.

## V3.3.2 – Projection Continuity
- Surface-Walker aus V3.3.1 entfernt; keine rekursive Pfadsuche mehr.
- L/R-Außenkanten besitzen eine feste Identität und dürfen nicht mehr die Seiten tauschen.
- Die nominelle Seitenrichtung darf sich kontinuierlich drehen; abrupte Frame-Flips werden verhindert.
- Surface-Hits werden primär nach Kontinuität des Projektionsvektors bewertet, Distanz ist nur sekundär.
- Referenz ist der gleitende Mittelwert der letzten bis zu vier Projektionsvektoren.
- Debug Schritt 2 zeigt den L/R Frame Lock.
- Debug Schritt 3 zeigt Winkelabweichungen: normal, >25° gelb, >60° rot; stark abweichende verworfene Kandidaten schwach rot.
- Kein rekursiver Retry im Problemfall; der Kopf-Stresstest sollte dadurch erheblich günstiger werden.
- Live-/Mirror-Breite, Triangulation, Screenshot-Reihe und Abschlussseite bleiben unverändert.

## V3.3.1 – Strap Stabilization

- Surface-Walker bewertet jeden neuen Außenkantenpunkt gegen vorherigen Punkt, Normale und erwarteten Fortschritt.
- Segmente durch das Mannequin werden stark bestraft; bei Sprüngen wird die gegenüberliegende Trefferfamilie geprüft.
- Links/rechts dürfen ihre Orientierung nicht spontan vertauschen; problematische Segmente werden lokal weiter unterteilt.
- Live-Breite skaliert sofort; finaler Edge-first Solve erfolgt beim Loslassen.
- Spiegelriemen übernehmen Breite gekoppelt vom Master und werden nach Rebuild zentral reconciled.
- Riemen-Lift nutzt mindestens den globalen Harness-Abstand; Endsegmente werden zum Ringanschluss geblendet.
- Guided Test: Abschlussseite nach letzter beantworteter Frage, horizontale Screenshot-Reihe, vertikal scrollbares Menü.

## V3.3.0 – Strap Geometry


### Neuer Edge-first Solver
- Die Mittellinie ist nicht mehr die geometrische Wahrheit des Riemens.
- Ausgangspunkt sind die sichtbaren Ringanschlussstellen und deren direkte Verbindung.
- Daraus werden sofort die nominelle linke und rechte Außenkante mit ± halber Riemenbreite gebildet.
- Beide Außenkanten werden unabhängig auf die Mannequin-Oberfläche projiziert.
- Segmente werden nur dort zusätzlich unterteilt, wo eine Außenkante zwischen zwei gültigen Punkten durch den Körper schneiden würde.
- Eine konservative Glättung der Außenkanten erfolgt anschließend; nur bei drohendem Körper-Clipping wird erneut projiziert.
- Die Mittellage kann jederzeit aus `(links + rechts) / 2` abgeleitet werden, steuert den Solver aber nicht mehr.

### Riemen-Mesh
- Die Orientierung des Lederbands wird direkt aus linker/rechter Außenkante + Laufrichtung abgeleitet.
- Dadurch darf der Riemen sich natürlich kontinuierlich verdrehen, ohne einen separaten Frame willkürlich um 90° zu drehen.
- Füllung besteht explizit aus Dreiecken.
- Pro Segment wird zwischen den beiden möglichen Diagonalen die geometrisch ruhigere Variante gewählt.
- Dicke wird entlang der aus den Außenkanten abgeleiteten lokalen Flächennormale aufgebaut.

### Riemen Debug
- `Debug` im Riemeneditor öffnet einen visuellen 7-Schritt-Debugger.
- 1: direkte Ringverbindung
- 2: nominelle Außenkanten
- 3: Mess-/Projektionslinien zur Körperoberfläche
- 4: projizierte Kontaktpunkte
- 5: rohe Außenkanten
- 6: finale Außenkanten
- 7: Triangulation
- `Alles` blendet die Debugebenen gemeinsam ein.
- Mannequin wird im Debug halbtransparent und rendert nur Frontfaces; die gegenüberliegende Körperrückseite soll deshalb nicht doppelt durchscheinen.
- Der Debugger visualisiert die echten Daten des Solvers, keine nachträglich rekonstruierte Näherung.

### Guided Tester
- aktuelle Frage bleibt nach Schließen/Öffnen erhalten
- Vor/Zurück ist zyklisch
- Screenshot-Vorschau als 3-spaltige Galerie
- mehrere Screenshots pro Frage einzeln sichtbar/löschbar
- 13 ausführliche Riemen-Impact-Tests

## V3.2.2 – Topology Integrity

- Flächen behalten ihre Boundary-Ringe als feste Mitglieder.
- Sichtbare Flächenkontur wird dynamisch als aktuelle Außenhülle dieser Mitglieder berechnet.
- Innenliegende Mitgliedsringe dürfen temporär aus der Außenkante verschwinden und werden beim Zurückziehen automatisch wieder Außenpunkt.
- Spiegelpaar↔Spiegelpaar wird als doppelte Paartransaktion gemergt.
- Trennen einer solchen Transaktion stellt beide Seiten gemeinsam wieder her.
- Bei Entmerge aus einem Mirror-Verbund hat die gespiegelte Sollposition Vorrang vor der Herkunftsrichtung.
- Reale Riemen-Endpunkte werden nach dem Restore erneut aus den tatsächlichen Ringpositionen aufgebaut.
- Endgültiges Verschmelzen ist auch beim Mittelachsen-Merge verfügbar.
- Debug-Kommentare bleiben beim Screenshot erhalten.
- Pro Testfrage sind mehrere Screenshots möglich; Report exportiert alle.
- Guided Test auf 12 Topology-Impact-Fragen angepasst.

## V3.2.1 – Ring Merge Fix
- Größere Snap-Schwelle.
- Richtungsgetreues Trennen.
- Dauerhafte Third-Ring-Hovermeldung.
- Exakter Panel-Snapshot.
- Generic Merge für Spiegelringe.

## V3.2.0 – Ring Merge
- Dynamische Ring-Hitbox.
- Soft-Merge max. zwei Ringe.
- Endgültiges Verschmelzen.

## V3.1.0 – Modular Base
- Golden-Code in austauschbare Blöcke getrennt.
- Preload-all Loader.
- Erweiterungsslots für Body Lab, Accessoires, Foto, Strap Paint, Materialien, Posing, Export und Generatoren.

## V3.0.0f – Capture Fix
- Zuverlässiger WebGL-Screenshot-Capture.
