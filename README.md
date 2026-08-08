# Harness Designer V0.5f

## Strap anchors
- Strap anchors are now white spheres.
- Size can be adjusted from 2–30 mm.
- Strap anchors are valid connection targets in Connect mode.
- Connections can therefore run ring -> strap anchor, strap anchor -> ring, or strap anchor -> strap anchor.
- Strap anchors remain tied to their percentage on the exact rendered strap.

## Size ranges
- Strap width now allows 0–60 mm.
- Ring diameter now allows 0–100 mm.
- Ring material thickness now allows 0–15 mm.
- Internally a tiny epsilon is used so Three.js geometry remains valid at zero.

## Model distance
- Manual model menu now includes global "Abstand zum Modell" 0–30 mm.
- Body-attached rings are repositioned from their stored surface point/normal.
- Strap paths are rebuilt to use the new offset.

## Existing
- true Mirror toggle bubble
- manual X/Y/Z mannequin rotation
- centre-axis floor guide
- ring editor / strap editor split
