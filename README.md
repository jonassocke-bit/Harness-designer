# Harness Designer V1.9d — PANEL EXTRACT TEST

This is deliberately a panel-only experiment based on V1.9c.

Rings and straps are not redesigned in this build.

## New panel algorithm
The committed panel no longer:
- triangulates a new flat polygon
- recursively subdivides it
- raycasts every generated vertex onto the mannequin

Instead it:
1. reads the actual current body mesh triangles
2. uses `Mesh.getVertexPosition()` so active morph targets are included
3. tests body-triangle centroids against the panel boundary
4. rejects triangles outside the local curved surface slab / wrong-facing shell
5. reuses the original mannequin vertex positions and vertex normals
6. copies those body triangles
7. offsets each copied vertex along its existing normal by the panel offset

This is a direct body-mesh extraction prototype.

## Expected tradeoff
The body conformity should be essentially exact and generation should be much faster.
The boundary will initially follow the mannequin's triangle grid and can therefore
look jagged. If this test proves fast and reliable, V2 can add a second boundary
clipping pass only along the edge, instead of rebuilding/raycasting the entire panel.

Ring holes remain centroid-based for this experiment.
Dragging still uses the cheap flat preview; extraction happens after release.
