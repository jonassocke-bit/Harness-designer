# Harness Designer V1.7c — auto-fit panels + persistent topology

Built on V1.7b.

## Panels no longer use manual surface points
The panel editor now has only one geometry control:
- `Abstand zum Körper` (0–12 mm)

Panel shape is fitted automatically to the mannequin.

Interaction policy:
- while a boundary ring is being dragged: very cheap flat preview
- after pointer-up: one dense surface fit is calculated
- no expensive panel surface raycasts run continuously during drag

The committed fit projects panel vertices along the panel's own local normal,
which prevents the solver from jumping sideways to unrelated body surfaces.

## Persistent logical boundary
A panel stores logical boundary slots independently from the currently visible
merged nodes.

Example:
- original panel has A, B, C, D
- A + B merge on the center axis
- visible panel boundary becomes [AB, C, D] (three points)
- the two original logical slots A and B still exist internally
- when AB is entmerged, those two slots automatically become A and B again

If the currently distinct boundary nodes produce fewer than 3 points or become
collinear, the panel temporarily has no visible geometry. The Panel object and
all logical slots remain stored. As soon as the nodes separate again, the panel
reappears automatically.

Merge stacks are serialized in Undo/Redo, so this survives history operations.

## Rendering hierarchy
Panel distance is measured from the mannequin and defaults to 1 mm. Panels stay
closer to the body than straps; straps keep their higher render priority.
Boundary rings are cut out of the committed panel mesh using fine subdivision.
