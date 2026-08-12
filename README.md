# Harness Designer V1.9e — PANEL CLEAN EDGE

Based directly on the successful V1.9d mesh-extraction panel prototype.

## What changed
The panel still copies the actual mannequin mesh triangles and offsets them
along their original normals.

Only the outer boundary has changed:

- mannequin triangles are projected into the panel's local 2D basis
- the panel polygon is triangulated once
- source body triangles that cross the panel boundary are clipped against those
  boundary triangles
- newly created boundary vertices are reconstructed on the ORIGINAL body
  triangle using barycentric interpolation
- interpolated mannequin normals are used for the panel offset

This means the new edge follows the requested panel boundary instead of the
mannequin's triangle grid, while the panel surface itself is still taken
directly from the mannequin.

No per-vertex body raycasts are reintroduced.

## Known intentional limitation of this test
Ring holes still use the previous centroid-based triangle rejection.
The OUTER panel edge is the part being tested here.

Dragging still uses the cheap preview and the mesh extraction / edge clipping
runs only after release.
