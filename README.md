# Harness Designer V1.7 — Panels / Flächen

Built on V1.6e.

## New object: Panel
A panel is defined by 3+ existing nodes (rings, anchors or points).

Workflow:
1. Tap `▰ Fläche` next to `↔ Verbinden`
2. Tap boundary nodes in order
3. From 3 nodes onward `Fläche erstellen` becomes available
4. Confirm once; tool returns to normal build mode

Panels:
- are independent geometry objects
- follow their boundary nodes dynamically
- use a subdivided triangulated surface mesh
- project their mesh vertices onto the mannequin surface
- have a dark neutral placeholder material
- are selectable and deletable
- are included in robust Undo/Redo snapshots

## Surface raster
Select a panel and tap `+ Punkt`.
A cyan projected raster appears inside the panel boundary.
Tap one raster point to add a local surface control point.
Camera drag remains available while waiting for a tap.

`- Punkt` removes the last surface control.
`Auto` clears manual panel controls.

## Symmetry
If all boundary nodes have mirrored counterparts, a panel can create a mirrored
partner. The partner uses mirrored boundary IDs and mirrored surface-control data.

Material types, leather/mesh, edge/border rendering and photo-mode baking are
intentionally deferred to the later Material/Bake pipeline.
