# Harness Designer V1.7b

Panel UX/performance pass:
- “Fläche erstellen” is a separate transient button, no longer part of the segmented tool control
- selected boundary nodes stay cyan while building a panel
- selected panels are cyan
- ring regions are cut from panel geometry
- live ring dragging uses a cheap panel preview; expensive body projection runs after the drag
- panel control grid is generated only where the panel position corresponds to mannequin surface
- panels sit below straps visually; straps retain render priority

This build is based on V1.7a and does not intentionally alter the established strap/waypoint logic.
