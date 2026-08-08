# Harness Designer V0.4b — Flat Straps

## Neu
- Riemen sind jetzt flache Bänder statt TubeGeometry
- sichtbare Breite entspricht tatsächlich der Riemenbreite
- erste reale Lederdicke (intern ca. 2,5 mm)
- Bandfläche orientiert sich entlang des Pfads an der Körperoberfläche
- Riemenpfad wird in viele Punkte zerlegt und bei niedriger Lockerheit an die Körperoberfläche gezogen
- damit schneiden straffe Riemen deutlich seltener durch Brust, Schulter oder Rücken
- bestehendes Anchor-/Ring-System bleibt erhalten

## Technischer Stand
Das ist bewusst noch kein perfekter geodätischer Solver. Für straffe Riemen wird der Pfad aktuell
mehrfach auf die sichtbare Körperoberfläche projiziert. Das ist ein deutlicher Schritt nach vorn und
liefert die richtige flache Ledergeometrie als Grundlage für den späteren Grid-/Strap-Editor.

## Weiter
- manuelle Ring-Slots
- Riemenanker auf bestehenden Riemen
- später echte geodätische/meshbasierte Surface-Following-Logik
