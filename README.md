# Harness Designer V1.9f — PANEL FILLED EDGE

Fixes the remaining staircase/gaps seen in V1.9e.

The V1.9e problem was not the clipping itself. The extraction stage discarded
body triangles whose CENTROID was outside the panel before the clipping stage
ever saw them. A triangle could therefore cross the requested panel boundary
but disappear completely.

V1.9f:
- keeps the fast direct mannequin-mesh extraction
- keeps morph-aware body vertices and original/interpolated normals
- keeps the cheap drag preview
- uses a cheap panel AABB first
- then retains every source body triangle that actually overlaps the panel
- clips those crossing triangles to the requested boundary
- fan-triangulates each resulting convex clipped polygon
- reconstructs every new edge vertex on its original mannequin triangle with
  barycentric interpolation
- performs no dense panel raycast pass

So the missing pieces along the outer edge are now actually generated rather
than merely cutting away the old body triangles.
