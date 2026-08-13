# Patchnotes

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
