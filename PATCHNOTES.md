# Patchnotes

## V3.4.2 – Unified Strap Guide
- Guided-Projektionsrichtung aus V3.4.1 invertiert: der gespeicherte Guide lockt jetzt die gegenüberliegende globale ± Hypothese.
- Jeder ausgewählte Riemen besitzt einen mittleren Guide-Handle.
- Direct-Riemen zeigen zunächst einen automatisch positionierten cyanfarbenen Handle; erst beim Ziehen wird ein expliziter Guide gespeichert.
- Explizite Guides werden gelb dargestellt und bestimmen die Riemenorientierung.
- Guide-Handle kann direkt über die Körperoberfläche gezogen werden; der Riemen wird live neu berechnet.
- Spiegelriemen übernehmen den Guide gespiegelt.
- Während Ring → Körperpunkt → Ring bleibt der gewählte Guide-Punkt als gelber Marker sichtbar.
- Debug-Modus ist read-only: erlaubt sind Kamera und Auswahl eines anderen Riemens; Geometrieänderungen/Neubau sind blockiert.
- Globaler Körperabstand 0 entfernt den alten versteckten längenabhängigen 6–22-mm-Lift; übrig bleibt nur ca. 1.2 mm Anti-Z-Fighting-Clearance.
- Endpoint-Blend verwendet denselben Clearance-Wert statt eines zweiten Offset-Modells.
- Abschlussseite des Testers hat jetzt ein persistentes mehrzeiliges Gesamtkommentar-Feld; es landet auch im HTML-Report.
- Testcheckliste auf die neue Unified-Guide-Architektur angepasst.

## V3.4.0 – Strap Routing Rebuild
- Bewusster Rücksprung auf V3.3.1 als funktionale Riemenbasis.
- V3.3.2 bis V3.3.4 Solver-Experimente nicht weitergepatcht.
- Direct: Verbinden → Ring A → Ring B.
- Guided: Verbinden → Ring A → Körperpunkt → Ring B.
- Der optionale Körperpunkt erzeugt keinen Ring und ist keine zusätzliche Kurvenstütze.
- Er bestimmt ausschließlich einmal die Orientierungsebene der beiden nominellen Außenlinien.
- Nominelle Mittellinie bleibt immer die direkte Gerade A→B.
- Beide nominellen Außenlinien verwenden einen konstanten Breitenvektor und sind mathematisch parallel.
- Surface-Projektion wird als zwei komplette globale Hypothesen (+ / −) gelöst.
- Linke und rechte Außenkante eines Riemens können dadurch niemals unterschiedliche Projektionsseiten wählen.
- Route-Scoring: harte Gültigkeits-/Breitenkohärenz zuerst, danach Gesamtpfadlänge.
- Mirror-Guided spiegelt auch den optionalen Körperpunkt.
- Guided-Routing wird in Undo/Redo gespeichert.

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
